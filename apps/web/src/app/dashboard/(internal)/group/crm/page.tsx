'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  type CrmLead,
  type LeadStatus,
  type PipelineItem,
  addNote,
  addTask,
  createLead,
  deleteLead,
  getLead,
  getPipelineSummary,
  listLeads,
  updateLead,
  updateTask,
} from '@/lib/api/crm';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Jauns',
  CONTACTED: 'Sazināts',
  QUALIFIED: 'Kvalificēts',
  PROPOSAL: 'Piedāvājums',
  WON: 'Noslēgts',
  LOST: 'Zaudēts',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-purple-100 text-purple-800',
  PROPOSAL: 'bg-orange-100 text-orange-800',
  WON: 'bg-green-100 text-green-800',
  LOST: 'bg-gray-100 text-gray-600',
};

const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

const SOURCE_LABELS: Record<string, string> = {
  PLATFORM: 'Platforma',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-pasts',
  PHONE: 'Telefons',
  REFERRAL: 'Ieteikums',
  OTHER: 'Cits',
};

const TYPE_LABELS: Record<string, string> = {
  BUYER: 'Pircējs',
  SUPPLIER: 'Piegādātājs',
  CARRIER: 'Pārvadātājs',
  RECYCLER: 'Pārstrādātājs',
  OTHER: 'Cits',
};

// ─── Pipeline summary cards ───────────────────────────────────────────────────

function PipelineCards({ items }: { items: PipelineItem[] }) {
  const order: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
  const map = Object.fromEntries(items.map((i) => [i.status, i]));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {order.map((s) => {
        const item = map[s] ?? { count: 0, totalValue: 0 };
        return (
          <Card key={s} className="text-center py-3">
            <CardContent className="p-0 px-3">
              <div
                className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-1 ${STATUS_COLORS[s]}`}
              >
                {STATUS_LABELS[s]}
              </div>
              <div className="text-2xl font-bold">{item.count}</div>
              {item.totalValue > 0 && (
                <div className="text-xs text-muted-foreground">€{item.totalValue.toFixed(0)}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── New lead dialog ──────────────────────────────────────────────────────────

interface NewLeadDialogProps {
  open: boolean;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}

function NewLeadDialog({ open, token, onClose, onCreated }: NewLeadDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    type: 'OTHER',
    source: 'OTHER',
    buContext: 'UNASSIGNED',
    value: '',
    description: '',
  });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createLead(token, {
        name: form.name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        type: form.type as any,
        source: form.source as any,
        buContext: form.buContext as any,
        value: form.value ? parseFloat(form.value) : undefined,
        description: form.description || undefined,
      });
      onCreated();
      onClose();
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        type: 'OTHER',
        source: 'OTHER',
        buContext: 'UNASSIGNED',
        value: '',
        description: '',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Jauns vadītājs</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Vārds *</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Jānis Bērziņš"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>E-pasts</Label>
              <Input
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                type="email"
                placeholder="janis@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label>Telefons</Label>
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+371 20000000"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Uzņēmums</Label>
            <Input
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="SIA Celtniecība"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Tips</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Avots</Label>
              <Select value={form.source} onValueChange={(v) => set('source', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vērtība (€)</Label>
              <Input
                value={form.value}
                onChange={(e) => set('value', e.target.value)}
                type="number"
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Apraksts</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Pirmais kontakts, intereses apraksts..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Saglabāt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lead detail sheet ────────────────────────────────────────────────────────

interface LeadSheetProps {
  leadId: string | null;
  token: string;
  onClose: () => void;
  onUpdated: () => void;
}

function LeadSheet({ leadId, token, onClose, onUpdated }: LeadSheetProps) {
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      setLead(await getLead(token, leadId));
    } finally {
      setLoading(false);
    }
  }, [leadId, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(status: LeadStatus) {
    if (!lead) return;
    await updateLead(token, lead.id, { status });
    await load();
    onUpdated();
  }

  async function handleAddNote() {
    if (!lead || !noteText.trim()) return;
    setAddingNote(true);
    try {
      await addNote(token, lead.id, noteText.trim());
      setNoteText('');
      await load();
    } finally {
      setAddingNote(false);
    }
  }

  async function handleAddTask() {
    if (!lead || !taskTitle.trim()) return;
    setAddingTask(true);
    try {
      await addTask(token, lead.id, { title: taskTitle.trim() });
      setTaskTitle('');
      await load();
    } finally {
      setAddingTask(false);
    }
  }

  async function handleToggleTask(taskId: string, done: boolean) {
    if (!lead) return;
    await updateTask(token, lead.id, taskId, { done });
    await load();
  }

  return (
    <Sheet open={!!leadId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && lead && (
          <>
            <SheetHeader className="pb-4">
              <SheetTitle className="text-lg">{lead.name}</SheetTitle>
              <div className="flex flex-wrap gap-2 pt-1">
                {lead.company && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {lead.company}
                  </span>
                )}
                {lead.email && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {lead.phone}
                  </span>
                )}
              </div>
            </SheetHeader>

            {/* Status selector */}
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Statuss</div>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity ${STATUS_COLORS[s]} ${lead.status === s ? 'opacity-100 ring-2 ring-offset-1 ring-current' : 'opacity-50 hover:opacity-80'}`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-4">
              <span className="text-muted-foreground">
                Tips: <strong>{TYPE_LABELS[lead.type] ?? lead.type}</strong>
              </span>
              <span className="text-muted-foreground">
                Avots: <strong>{SOURCE_LABELS[lead.source] ?? lead.source}</strong>
              </span>
              {lead.value != null && (
                <span className="text-muted-foreground">
                  Vērtība: <strong>€{lead.value}</strong>
                </span>
              )}
            </div>

            {lead.description && (
              <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-lg">
                {lead.description}
              </p>
            )}

            {/* Tasks */}
            <div className="mb-5">
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Uzdevumi
              </div>
              <div className="space-y-1.5 mb-2">
                {lead.tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nav uzdevumu.</p>
                )}
                {lead.tasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <button
                      onClick={() => handleToggleTask(t.id, !t.done)}
                      className="mt-0.5 shrink-0"
                    >
                      <CheckCircle2
                        className={`h-4 w-4 ${t.done ? 'text-green-500' : 'text-muted-foreground/40'}`}
                      />
                    </button>
                    <span
                      className={`text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}
                    >
                      {t.title}
                    </span>
                    {t.dueAt && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {new Date(t.dueAt).toLocaleDateString('lv-LV')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Jauns uzdevums..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTask}
                  disabled={addingTask || !taskTitle.trim()}
                >
                  {addingTask ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Piezīmes
              </div>
              <div className="space-y-2 mb-2">
                {lead.notes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nav piezīmju.</p>
                )}
                {lead.notes.map((n) => (
                  <div key={n.id} className="p-2.5 bg-muted rounded-lg">
                    <p className="text-sm">{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString('lv-LV', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Pievienot piezīmi..."
                  rows={2}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="self-end"
                  onClick={handleAddNote}
                  disabled={addingNote || !noteText.trim()}
                >
                  {addingNote ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? '';

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [leadsData, pipelineData] = await Promise.all([
        listLeads(token, {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: search.trim() || undefined,
        }),
        getPipelineSummary(token),
      ]);
      setLeads(leadsData);
      setPipeline(pipelineData);
    } catch {
      setError('Neizdevās ielādēt CRM datus.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Kontaktu un potenciālo klientu pārvaldība"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns vadītājs
            </Button>
          </div>
        }
      />

      {/* Pipeline summary */}
      {pipeline.length > 0 && <PipelineCards items={pipeline} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Meklēt pēc vārda, e-pasta, uzņēmuma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as LeadStatus | 'ALL')}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-48 gap-2">
            <User className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Nav vadītāju. Pievienojiet pirmo kontaktu.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && leads.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">{lead.name}</span>
                      {lead.company && (
                        <span className="text-xs text-muted-foreground truncate">
                          · {lead.company}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </span>
                      )}
                      {lead._count && (
                        <span>
                          {lead._count.notes} piezīmes · {lead._count.tasks} uzdevumi
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.value != null && (
                      <span className="text-sm font-medium">€{lead.value}</span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}
                    >
                      {STATUS_LABELS[lead.status]}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead detail sheet */}
      <LeadSheet
        leadId={selectedId}
        token={token}
        onClose={() => setSelectedId(null)}
        onUpdated={handleRefresh}
      />

      {/* New lead dialog */}
      <NewLeadDialog
        open={newOpen}
        token={token}
        onClose={() => setNewOpen(false)}
        onCreated={handleRefresh}
      />
    </div>
  );
}
