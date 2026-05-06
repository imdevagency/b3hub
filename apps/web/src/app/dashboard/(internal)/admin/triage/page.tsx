/**
 * Admin Triage hub — /dashboard/admin/triage
 * Tabbed hub: Strīdi · Atbalsts · Incidenti
 */
'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  X,
  MessageSquare,
  Send,
  CheckCheck,
  RotateCcw,
  User,
  CheckCircle2,
  Search,
  Clock,
  Building2,
  Package,
  ExternalLink,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import {
  listDisputes,
  updateDispute,
  type ApiDispute,
  type DisputeStatus,
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  getDisputeStatusColor,
} from '@/lib/api/disputes';
import {
  adminListSupportThreads,
  adminGetSupportThread,
  adminReplySupportThread,
  adminSetSupportThreadStatus,
  type SupportThread,
  type SupportMessage,
} from '@/lib/api/support';
import {
  adminGetExceptions,
  adminResolveException,
  adminSetExceptionInReview,
  adminGetUser,
  type AdminException,
  type AdminUserDetail,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Disputes tab ─────────────────────────────────────────────────────────────

const DISPUTE_STATUS_FILTERS: { value: 'ALL' | DisputeStatus; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'OPEN', label: 'Jauni' },
  { value: 'UNDER_REVIEW', label: 'Izskatīšanā' },
  { value: 'RESOLVED', label: 'Atrisināti' },
  { value: 'REJECTED', label: 'Noraidīti' },
];

function DisputesTab({ token }: { token: string }) {
  const [disputes, setDisputes] = useState<ApiDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DisputeStatus>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApiDispute | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [updateStatus, setUpdateStatus] = useState<DisputeStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setDisputes(await listDisputes(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selected) {
      setResolutionText(selected.resolution ?? '');
      setUpdateStatus(selected.status);
      setSaveError('');
    }
  }, [selected]);

  const handleSave = async () => {
    if (!token || !selected || !updateStatus) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateDispute(
        selected.id,
        { status: updateStatus as DisputeStatus, resolution: resolutionText || undefined },
        token,
      );
      setDisputes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setSelected(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kļūda saglabājot');
    } finally {
      setSaving(false);
    }
  };

  const filtered = disputes.filter((d) => {
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      d.order.orderNumber.toLowerCase().includes(q) ||
      `${d.raisedBy.firstName} ${d.raisedBy.lastName}`.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 pt-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt pēc pasūtījuma nr., iesniedzēja vai apraksta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {DISPUTE_STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${statusFilter === f.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
          >
            {f.label}
            {f.value !== 'ALL' && (
              <span className="ml-1.5 text-xs opacity-75">
                ({disputes.filter((d) => d.status === f.value).length})
              </span>
            )}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <AlertTriangle className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nav sūdzību šajā kategorijā</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="w-full text-left rounded-2xl border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDisputeStatusColor(d.status)}`}
                    >
                      {DISPUTE_STATUS_LABELS[d.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {DISPUTE_REASON_LABELS[d.reason]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold truncate">
                    Pasūtījums #{d.order.orderNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {d.raisedBy.firstName} {d.raisedBy.lastName} · {d.order.deliveryAddress}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {d.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString('lv-LV')}
                  </span>
                  <span className="rounded-full bg-orange-100 text-orange-700 text-xs px-2 py-0.5 font-medium">
                    {Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 86400000)}d
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/30 backdrop-blur-sm">
          <div className="w-full sm:w-120 h-full sm:h-auto sm:max-h-[90vh] bg-white shadow-2xl flex flex-col overflow-hidden sm:rounded-2xl sm:mr-4 sm:my-4">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <p className="font-bold">Sūdzība — #{selected.order.orderNumber}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {DISPUTE_REASON_LABELS[selected.reason]}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 hover:bg-muted transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="rounded-xl bg-muted/40 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iesniedzējs</span>
                  <span className="font-medium">
                    {selected.raisedBy.firstName} {selected.raisedBy.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-pasts</span>
                  <span className="font-medium">{selected.raisedBy.email ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iesniegts</span>
                  <span className="font-medium">
                    {new Date(selected.createdAt).toLocaleDateString('lv-LV', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pasūtījums</span>
                  <Link
                    href={`/dashboard/orders/${selected.orderId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    #{selected.order.orderNumber}
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Apraksts
                </p>
                <p className="text-sm leading-relaxed">{selected.description}</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Atjaunināt statusu
                </p>
                <Select
                  value={updateStatus}
                  onValueChange={(v) => setUpdateStatus(v as DisputeStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izvēlēties statusu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Jauns</SelectItem>
                    <SelectItem value="UNDER_REVIEW">Izskatīšanā</SelectItem>
                    <SelectItem value="RESOLVED">Atrisināts</SelectItem>
                    <SelectItem value="REJECTED">Noraidīts</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Paskaidrojiet lēmumu..."
                  rows={3}
                />
                {saveError && <p className="text-xs text-destructive">{saveError}</p>}
                <Button onClick={handleSave} disabled={saving || !updateStatus} className="w-full">
                  {saving ? 'Saglabā...' : 'Saglabāt izmaiņas'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Support tab ──────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'tikko';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' });
}

/** Returns age label + urgency color for a thread's createdAt */
function ticketAge(createdAt: string): { label: string; cls: string } {
  const diffMin = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (diffMin < 60) return { label: `${diffMin}min`, cls: 'text-emerald-600 bg-emerald-50' };
  const h = Math.floor(diffMin / 60);
  if (h < 4) return { label: `${h}h`, cls: 'text-yellow-600 bg-yellow-50' };
  if (h < 24) return { label: `${h}h`, cls: 'text-orange-600 bg-orange-50' };
  const d = Math.floor(h / 24);
  return { label: `${d}d`, cls: 'text-red-600 bg-red-50' };
}

function userName(thread: SupportThread) {
  const u = thread.user;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
}

function SupportTab({ token }: { token: string }) {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [supportStatusFilter, setSupportStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('OPEN');
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    try {
      setThreads(await adminListSupportThreads(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  const selectThread = useCallback(
    async (threadId: string) => {
      if (!token) return;
      setLoadingThread(true);
      setUserDetail(null);
      try {
        const thread = await adminGetSupportThread(threadId, token);
        setActiveThread(thread);
        setReply('');
        setSendError('');
        // Fetch user context in parallel
        setLoadingUser(true);
        adminGetUser(thread.user.id, token)
          .then((u) => setUserDetail(u))
          .catch(() => {})
          .finally(() => setLoadingUser(false));
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
      setActiveThread((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      setReply('');
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
      /* silent */
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div
      className="flex border border-border rounded-2xl overflow-hidden mt-4"
      style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}
    >
      <aside className="w-72 shrink-0 border-r border-border overflow-y-auto bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sarakste
            </span>
            <div className="flex text-[10px] rounded-lg overflow-hidden border border-border">
              {(['OPEN', 'ALL', 'CLOSED'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSupportStatusFilter(v)}
                  className={`px-2 py-0.5 transition-colors ${supportStatusFilter === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >
                  {v === 'OPEN' ? 'Aktīvi' : v === 'CLOSED' ? 'Slēgti' : 'Visi'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={loadThreads} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {threads.filter((t) => supportStatusFilter === 'ALL' || t.status === supportStatusFilter)
          .length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nav sarakstu"
            description="Lietotāju ziņojumi parādīsies šeit"
          />
        ) : (
          threads
            .filter((t) => supportStatusFilter === 'ALL' || t.status === supportStatusFilter)
            .map((t) => {
              const lastMsg = t.messages[0];
              const age = ticketAge(t.createdAt);
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                    activeThread?.id === t.id ? 'bg-accent' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{userName(t)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.status === 'OPEN' && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${age.cls}`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {age.label}
                        </span>
                      )}
                      <Badge
                        variant={t.status === 'OPEN' ? 'default' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {t.status === 'OPEN' ? 'Atvērts' : 'Slēgts'}
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
            })
        )}
      </aside>

      {activeThread ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Chat pane ── */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{userName(activeThread)}</p>
                  <p className="text-xs text-muted-foreground">{activeThread.user.email}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleToggleStatus}>
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
                    <div
                      key={m.id}
                      className={`flex ${m.fromAdmin ? 'justify-end' : 'justify-start'} mb-2`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                          m.fromAdmin
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {!m.fromAdmin && (
                          <p className="text-[11px] font-medium opacity-70 mb-0.5">
                            {m.senderName}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap wrap-break-word">{m.body}</p>
                        <p className="text-[10px] mt-1 opacity-60 text-right">
                          {new Date(m.createdAt).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>
            {activeThread.status === 'OPEN' ? (
              <div className="px-4 py-3 border-t border-border shrink-0">
                {sendError && <p className="text-sm text-destructive mb-2">{sendError}</p>}
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
                <p className="text-[11px] text-muted-foreground mt-1">Cmd+Enter — nosūtīt</p>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-border bg-muted/30 text-center text-sm text-muted-foreground shrink-0">
                Sarakste slēgta — atveriet to, lai atbildētu
              </div>
            )}
          </div>

          {/* ── Customer context panel ── */}
          <aside className="w-60 shrink-0 border-l border-border overflow-y-auto bg-muted/20">
            {loadingUser ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : userDetail ? (
              <div className="p-4 space-y-4">
                {/* User profile */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Lietotājs
                    </span>
                    <a
                      href={`/dashboard/admin/users?id=${userDetail.id}`}
                      className="text-muted-foreground hover:text-foreground"
                      title="Atvērt profilu"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                      {(
                        (userDetail.firstName?.[0] ?? '') + (userDetail.lastName?.[0] ?? '')
                      ).toUpperCase() || <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {[userDetail.firstName, userDetail.lastName].filter(Boolean).join(' ') ||
                          '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {userDetail.email}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Pievienojies</span>
                      <span className="text-foreground">
                        {new Date(userDetail.createdAt).toLocaleDateString('lv-LV')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tips</span>
                      <span className="text-foreground">{userDetail.userType}</span>
                    </div>
                  </div>
                </div>

                {/* Company */}
                {userDetail.company && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Uzņēmums
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{userDetail.company.name}</p>
                        {userDetail.company.companyType && (
                          <p className="text-[10px] text-muted-foreground">
                            {userDetail.company.companyType}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent orders */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Pēdējie pasūtījumi
                  </p>
                  {userDetail.ordersCreated.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nav pasūtījumu</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userDetail.ordersCreated.slice(0, 8).map((o) => (
                        <a
                          key={o.id}
                          href={`/dashboard/admin/orders?q=${o.orderNumber}`}
                          className="flex items-center justify-between rounded-lg border border-border bg-background px-2.5 py-1.5 hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[11px] font-mono truncate">{o.orderNumber}</span>
                          </div>
                          <span
                            className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 shrink-0 ml-1 ${
                              o.status === 'DELIVERED'
                                ? 'bg-green-100 text-green-700'
                                : o.status === 'CANCELLED'
                                  ? 'bg-red-100 text-red-600'
                                  : o.status === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {o.status}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <User className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Konteksts nav pieejams</p>
              </div>
            )}
          </aside>
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
  );
}

// ─── Exceptions tab ───────────────────────────────────────────────────────────

const EXC_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_REVIEW: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
};
const EXC_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Atvērts',
  IN_REVIEW: 'Izskatīšanā',
  RESOLVED: 'Atrisināts',
};
const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  DRIVER_NO_SHOW: 'Šoferis neieradās',
  LATE_DELIVERY: 'Kavēta piegāde',
  DAMAGED_GOODS: 'Bojāta krava',
  WRONG_QUANTITY: 'Nepareizs daudzums',
  WRONG_MATERIAL: 'Nepareizs materiāls',
  VEHICLE_BREAKDOWN: 'Transporta bojājums',
  CUSTOMER_REFUSED: 'Klients atteicās',
  SITE_INACCESSIBLE: 'Objekts nepieejams',
  WEIGHT_MISMATCH: 'Svara neatbilstība',
  OTHER: 'Cits',
};
const EXC_STATUS_FILTERS = [
  { value: 'ALL', label: 'Visi' },
  { value: 'OPEN', label: '🔴 Atvērti' },
  { value: 'IN_REVIEW', label: '🟡 Izskatīšanā' },
  { value: 'RESOLVED', label: '✅ Atrisināti' },
];

function ExceptionsTab({ token }: { token: string }) {
  const [exceptions, setExceptions] = useState<AdminException[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [resolveTarget, setResolveTarget] = useState<AdminException | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const fetchExceptions = useCallback(
    async (status?: string) => {
      if (!token) return;
      setLoading(true);
      try {
        setExceptions(
          await adminGetExceptions(token, status && status !== 'ALL' ? status : undefined),
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) fetchExceptions(statusFilter);
  }, [token, fetchExceptions, statusFilter]);

  const filtered = exceptions.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.type.toLowerCase().includes(q) ||
      (e.notes ?? '').toLowerCase().includes(q) ||
      (e.transportJob?.jobNumber ?? '').toLowerCase().includes(q) ||
      (e.reportedBy
        ? `${e.reportedBy.firstName} ${e.reportedBy.lastName}`.toLowerCase().includes(q)
        : false)
    );
  });

  const openCount = exceptions.filter((e) => e.status === 'OPEN').length;

  async function handleSetInReview(id: string) {
    setReviewingId(id);
    try {
      const updated = await adminSetExceptionInReview(id, token);
      setExceptions((prev) =>
        prev.map((e) => (e.id === updated.id ? { ...e, status: updated.status } : e)),
      );
    } catch (err) {
      alert((err as Error).message || 'Statusa maiņa neizdevās');
    } finally {
      setReviewingId(null);
    }
  }

  async function handleResolve() {
    if (!resolveTarget || !token || !resolution.trim()) return;
    setResolving(true);
    try {
      const updated = await adminResolveException(resolveTarget.id, resolution.trim(), token);
      setExceptions((prev) =>
        prev.map((e) =>
          e.id === resolveTarget.id
            ? { ...e, status: updated.status, resolution: updated.resolution }
            : e,
        ),
      );
      setResolveTarget(null);
      setResolution('');
    } catch (err) {
      alert((err as Error).message || 'Atrisināšana neizdevās');
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-5 pt-4">
      {openCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{openCount} neapstrādāti incidenti.</span>
          <button
            type="button"
            className="ml-auto text-xs underline underline-offset-2"
            onClick={() => setStatusFilter('OPEN')}
          >
            Skatīt
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Meklēt pēc tipa, darba nr., šofera..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {EXC_STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${statusFilter === value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nav incidentu"
          description="Nav atrasts neviens incidents ar šiem filtriem."
        />
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tips
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Darbs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Ziņotājs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Apraksts
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Datums
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className={`hover:bg-gray-50 transition-colors ${e.status === 'OPEN' ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-xs text-gray-800">
                        {EXCEPTION_TYPE_LABELS[e.type] ?? e.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.transportJob ? (
                        <div className="text-xs">
                          <Link
                            href={`/dashboard/admin/triage?tab=transport&job=${e.transportJob.jobNumber}`}
                            className="font-mono text-blue-600 hover:underline"
                          >
                            {e.transportJob.jobNumber}
                          </Link>
                          {e.transportJob.order && (
                            <p className="text-muted-foreground">
                              {e.transportJob.order.orderNumber}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {e.reportedBy ? (
                        `${e.reportedBy.firstName} ${e.reportedBy.lastName}`
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-48 truncate">
                      {e.notes ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${EXC_STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {EXC_STATUS_LABELS[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString('lv-LV')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={!!reviewingId}
                            onClick={() => handleSetInReview(e.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-yellow-700 hover:bg-yellow-50 border border-yellow-200 transition-colors disabled:opacity-50"
                          >
                            {reviewingId === e.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            Izskatīšanā
                          </button>
                        )}
                        {e.status !== 'RESOLVED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setResolveTarget(e);
                              setResolution('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Atrisināt
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Atrisināt incidentu —{' '}
              {resolveTarget &&
                (EXCEPTION_TYPE_LABELS[resolveTarget.type] ??
                  resolveTarget.type.replace(/_/g, ' '))}
            </DialogTitle>
            <DialogDescription>
              {resolveTarget?.transportJob && (
                <>
                  Darbs: <strong>{resolveTarget.transportJob.jobNumber}</strong>.{' '}
                </>
              )}
              Ievadiet atrisināšanas aprakstu.
            </DialogDescription>
          </DialogHeader>
          {resolveTarget?.notes && (
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Ziņotais apraksts:</p>
              <p>{resolveTarget.notes}</p>
            </div>
          )}
          <Textarea
            placeholder="Atrisināšanas apraksts (obligāts)..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={resolving}>
              Atcelt
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolving || !resolution.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {resolving ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Atzīmēt kā atrisinātu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

function TriageHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token: rawToken, isLoading } = useAuth();
  const token = rawToken ?? '';
  const tab = searchParams.get('tab') ?? 'disputes';

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Operacionālā triāža"
        description="Strīdi, atbalsta sarakste un incidenti vienuviet"
      />
      <Tabs value={tab} onValueChange={(t) => router.push(`?tab=${t}`)}>
        <TabsList>
          <TabsTrigger value="disputes">Strīdi</TabsTrigger>
          <TabsTrigger value="support">Atbalsts</TabsTrigger>
          <TabsTrigger value="exceptions">Incidenti</TabsTrigger>
        </TabsList>
        <TabsContent value="disputes">
          <DisputesTab token={token} />
        </TabsContent>
        <TabsContent value="support">
          <SupportTab token={token} />
        </TabsContent>
        <TabsContent value="exceptions">
          <ExceptionsTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function TriageHubPage() {
  return (
    <Suspense>
      <TriageHubContent />
    </Suspense>
  );
}
