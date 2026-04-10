/**
 * Web per-job chat — /dashboard/chat/[jobId]
 * Allows buyers, sellers, and drivers to message each other on a specific
 * transport job. Mirrors the mobile chat/[jobId] screen.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getChatMessages, sendChatMessage, type ChatMessage } from '@/lib/api/chat';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeft, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { PageSpinner } from '@/components/ui/page-spinner';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: 'short',
  });
}

// Group messages by calendar day
function groupByDay(messages: ChatMessage[]): { day: string; msgs: ChatMessage[] }[] {
  const groups: { day: string; msgs: ChatMessage[] }[] = [];
  let currentDay = '';
  for (const m of messages) {
    const day = new Date(m.createdAt).toLocaleDateString('lv-LV');
    if (day !== currentDay) {
      groups.push({ day, msgs: [m] });
      currentDay = day;
    } else {
      groups[groups.length - 1].msgs.push(m);
    }
  }
  return groups;
}

function Bubble({ msg, myId }: { msg: ChatMessage; myId: string }) {
  const isMe = msg.senderId === myId;
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
        {!isMe && (
          <p className="text-[11px] font-semibold opacity-70 mb-0.5">{msg.senderName}</p>
        )}
        <p className="text-sm whitespace-pre-wrap wrap-break-word">{msg.body}</p>
        <p className={`text-[10px] mt-0.5 opacity-60 ${isMe ? 'text-right' : 'text-left'}`}>
          {formatTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function JobChatPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const { token, user, isLoading } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchMessages = useCallback(async () => {
    if (!token || !jobId) return;
    try {
      const data = await getChatMessages(jobId, token);
      setMessages(data);
    } catch {
      // silently ignore poll errors
    }
  }, [token, jobId]);

  // Initial load
  useEffect(() => {
    if (!token || !jobId) return;
    fetchMessages().finally(() => setLoading(false));
  }, [token, jobId, fetchMessages]);

  // Poll every 5s for new messages
  useEffect(() => {
    if (!token) return;
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages, token]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!token || !jobId || !text.trim()) return;
    setSending(true);
    setSendError('');
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      jobId,
      senderId: user?.id ?? '',
      senderName: user?.email ?? 'Es',
      body: text.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    try {
      const sent = await sendChatMessage(jobId, optimistic.body, token);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? sent : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(optimistic.body);
      setSendError('Neizdevās nosūtīt ziņu');
    } finally {
      setSending(false);
    }
  };

  if (isLoading || loading) return <PageSpinner />;

  const groups = groupByDay(messages);
  const myId = user?.id ?? '';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="px-6 pt-6 pb-3 shrink-0">
        <PageHeader
          title={`Sarakste · ${jobId.slice(0, 8).toUpperCase()}`}
          description="Darba grupu sarakste starp pircēju, pārvadātāju un autovadītāju"
          action={
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Atpakaļ
            </Button>
          }
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-2 border-t border-border">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nav ziņojumu"
            description="Sāciet sarunu zemāk"
          />
        ) : (
          <>
            {groups.map((g) => (
              <div key={g.day}>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground px-2">{g.day}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {g.msgs.map((m) => (
                  <Bubble key={m.id} msg={m} myId={myId} />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border bg-background shrink-0">
        {sendError && <p className="text-sm text-destructive mb-2">{sendError}</p>}
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ierakstiet ziņu…"
            rows={2}
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={sending || !text.trim()} className="self-end">
            {sending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Cmd+Enter / Ctrl+Enter — nosūtīt</p>
      </div>
    </div>
  );
}
