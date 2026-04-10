/**
 * Admin Support Inbox — /dashboard/admin/support
 * Lists all user support threads. Admins can select a thread, read the
 * conversation, reply, and close/reopen threads.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminListSupportThreads,
  adminGetSupportThread,
  adminReplySupportThread,
  adminSetSupportThreadStatus,
  type SupportThread,
  type SupportMessage,
} from '@/lib/api/support';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  MessageSquare,
  RefreshCw,
  Send,
  CheckCheck,
  RotateCcw,
  User,
  Clock,
} from 'lucide-react';

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'tikko';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  return d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' });
}

function userName(thread: SupportThread) {
  const u = thread.user;
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return full || u.email;
}

// ── Thread list item ──────────────────────────────────────────────────────────

function ThreadItem({
  thread,
  active,
  onClick,
}: {
  thread: SupportThread;
  active: boolean;
  onClick: () => void;
}) {
  const lastMsg = thread.messages[0];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
        active ? 'bg-accent' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-medium text-sm truncate">{userName(thread)}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted-foreground">{formatTime(thread.updatedAt)}</span>
          <Badge
            variant={thread.status === 'OPEN' ? 'default' : 'secondary'}
            className="text-[10px] px-1.5 py-0"
          >
            {thread.status === 'OPEN' ? 'Atvērts' : 'Slēgts'}
          </Badge>
        </div>
      </div>
      {lastMsg && (
        <p className="text-xs text-muted-foreground truncate">
          {lastMsg.fromAdmin ? '↩ ' : ''}
          {lastMsg.body}
        </p>
      )}
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: SupportMessage }) {
  const isAdmin = msg.fromAdmin;
  return (
    <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
          isAdmin
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {!isAdmin && (
          <p className="text-[11px] font-medium opacity-70 mb-0.5">{msg.senderName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={`text-[10px] mt-1 opacity-60 text-right`}>
          {new Date(msg.createdAt).toLocaleTimeString('lv-LV', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminSupportPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();

  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Redirect non-admins
  useEffect(() => {
    if (!isLoading && user && user.userType !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    try {
      const data = await adminListSupportThreads(token);
      setThreads(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  const selectThread = useCallback(
    async (threadId: string) => {
      if (!token) return;
      setLoadingThread(true);
      try {
        const data = await adminGetSupportThread(threadId, token);
        setActiveThread(data);
        setReply('');
        setSendError('');
      } finally {
        setLoadingThread(false);
      }
    },
    [token],
  );

  const handleSend = async () => {
    if (!token || !activeThread || !reply.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const msg = await adminReplySupportThread(activeThread.id, reply.trim(), token);
      setActiveThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
      setReply('');
      // Refresh thread list to update last-message preview
      loadThreads();
    } catch {
      setSendError('Neizdevās nosūtīt ziņu');
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!token || !activeThread) return;
    const next = activeThread.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      const updated = await adminSetSupportThreadStatus(activeThread.id, next, token);
      setActiveThread((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setThreads((prev) =>
        prev.map((t) => (t.id === updated.id ? { ...t, status: updated.status } : t)),
      );
    } catch {
      // silently ignore
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 pt-6 pb-3">
        <PageHeader
          title="Atbalsta Iesūtne"
          description="Lietotāju atbalsta sarakste"
          action={
            <Button variant="outline" size="sm" onClick={loadThreads}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Atjaunot
            </Button>
          }
        />
      </div>

      <div className="flex flex-1 overflow-hidden border-t border-border">
        {/* Thread list */}
        <aside className="w-80 shrink-0 border-r border-border overflow-y-auto">
          {threads.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Nav sarakstu"
              description="Lietotāju ziņojumi parādīsies šeit"
            />
          ) : (
            threads.map((t) => (
              <ThreadItem
                key={t.id}
                thread={t}
                active={activeThread?.id === t.id}
                onClick={() => selectThread(t.id)}
              />
            ))
          )}
        </aside>

        {/* Chat pane */}
        {activeThread ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Thread header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{userName(activeThread)}</p>
                  <p className="text-xs text-muted-foreground">{activeThread.user.email}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleStatus}
              >
                {activeThread.status === 'OPEN' ? (
                  <>
                    <CheckCheck className="h-4 w-4 mr-1.5" />
                    Slēgt
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Atvērt
                  </>
                )}
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {loadingThread ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activeThread.messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nav ziņojumu"
                  description="Šajā sarakstē vēl nav ziņojumu"
                />
              ) : (
                <>
                  {activeThread.messages.map((m) => (
                    <Bubble key={m.id} msg={m} />
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Reply box */}
            {activeThread.status === 'OPEN' && (
              <div className="px-4 py-3 border-t border-border bg-background shrink-0">
                {sendError && (
                  <p className="text-sm text-destructive mb-2">{sendError}</p>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Ierakstiet atbildi…"
                    rows={2}
                    className="resize-none flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sending || !reply.trim()}
                    className="self-end"
                  >
                    {sending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Cmd+Enter / Ctrl+Enter — nosūtīt
                </p>
              </div>
            )}
            {activeThread.status === 'CLOSED' && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-center text-sm text-muted-foreground shrink-0">
                Sarakste slēgta — atveriet to, lai atbildētu
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Izvēlieties saraksti, lai skatītu ziņojumus
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
