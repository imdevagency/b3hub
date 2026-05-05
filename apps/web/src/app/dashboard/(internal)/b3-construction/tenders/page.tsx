/**
 * B3 Construction — Piedāvājumi (Tender Pipeline)
 * /dashboard/b3-construction/tenders
 *
 * Frontend-only tender pipeline. Data stored in localStorage under 'b3-tenders'
 * until a backend ConstructionTender model is added.
 *
 * TODO: Wire to backend once ConstructionTender model is added to schema.
 */
'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Edit2, Gavel, Loader2, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── types ────────────────────────────────────────────────────────────────────

type TenderStatus = 'PROSPECT' | 'TENDERING' | 'SUBMITTED' | 'WON' | 'LOST';

interface Tender {
  id: string;
  title: string;
  clientName: string;
  value: number;
  status: TenderStatus;
  submissionDate?: string;
  expectedStart?: string;
  notes?: string;
  createdAt: string;
}

// ─── labels / styles ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TenderStatus, string> = {
  PROSPECT: 'Potenciāls',
  TENDERING: 'Gatavo piedāvājumu',
  SUBMITTED: 'Iesniegts',
  WON: 'Uzvarēts',
  LOST: 'Zaudēts',
};

const STATUS_STYLE: Record<TenderStatus, string> = {
  PROSPECT: 'bg-gray-100 text-gray-600',
  TENDERING: 'bg-blue-100 text-blue-800',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  WON: 'bg-green-100 text-green-800',
  LOST: 'bg-red-100 text-red-800',
};

const STATUS_ORDER: TenderStatus[] = ['PROSPECT', 'TENDERING', 'SUBMITTED', 'WON', 'LOST'];

const STORAGE_KEY = 'b3-tenders';

function uid() {
  return `tn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): Tender[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveToStorage(items: Tender[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function fmtEur(n: number) {
  return `€${n.toLocaleString('lv-LV', { maximumFractionDigits: 0 })}`;
}

const EMPTY_FORM: Omit<Tender, 'id' | 'createdAt'> = {
  title: '',
  clientName: '',
  value: 0,
  status: 'PROSPECT',
  submissionDate: '',
  expectedStart: '',
  notes: '',
};

// ─── Pipeline column ──────────────────────────────────────────────────────────

function PipelineColumn({
  status,
  tenders,
  onEdit,
  onDelete,
}: {
  status: TenderStatus;
  tenders: Tender[];
  onEdit: (t: Tender) => void;
  onDelete: (id: string) => void;
}) {
  const total = tenders.reduce((s, t) => s + t.value, 0);

  return (
    <div className="flex min-w-50 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <Badge className={STATUS_STYLE[status]} variant="secondary">
          {STATUS_LABELS[status]}
        </Badge>
        {tenders.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {tenders.length} · {fmtEur(total)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {tenders.map((t) => (
          <Card key={t.id} className="cursor-pointer hover:shadow-sm transition-shadow">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-sm leading-tight">{t.title}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3 flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{t.clientName}</p>
              <p className="text-sm font-semibold">{fmtEur(t.value)}</p>
              {t.submissionDate && (
                <p className="text-xs text-muted-foreground">
                  Iesniegšana: {format(new Date(t.submissionDate), 'dd.MM.yyyy')}
                </p>
              )}
              {t.notes && <p className="text-xs text-muted-foreground line-clamp-2">{t.notes}</p>}
              <div className="flex items-center gap-1 mt-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(t)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-500 hover:text-red-700"
                  onClick={() => onDelete(t.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {tenders.length === 0 && (
          <div className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
            Nav piedāvājumu
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TendersPage() {
  const [items, setItems] = useState<Tender[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tender | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadFromStorage());
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(item: Tender) {
    setEditing(item);
    setForm({
      title: item.title,
      clientName: item.clientName,
      value: item.value,
      status: item.status,
      submissionDate: item.submissionDate ?? '',
      expectedStart: item.expectedStart ?? '',
      notes: item.notes ?? '',
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    setTimeout(() => {
      const clean = {
        ...form,
        submissionDate: form.submissionDate || undefined,
        expectedStart: form.expectedStart || undefined,
        notes: form.notes || undefined,
      };
      let updated: Tender[];
      if (editing) {
        updated = items.map((i) => (i.id === editing.id ? { ...editing, ...clean } : i));
      } else {
        updated = [...items, { id: uid(), ...clean, createdAt: new Date().toISOString() }];
      }
      saveToStorage(updated);
      setItems(updated);
      setSaving(false);
      setDialogOpen(false);
    }, 100);
  }

  function handleDelete(id: string) {
    const updated = items.filter((i) => i.id !== id);
    saveToStorage(updated);
    setItems(updated);
    setDeleteId(null);
  }

  // Derived summary
  const wonTotal = items.filter((t) => t.status === 'WON').reduce((s, t) => s + t.value, 0);
  const pipelineTotal = items.filter((t) => t.status !== 'LOST').reduce((s, t) => s + t.value, 0);
  const winRate =
    items.filter((t) => t.status === 'WON' || t.status === 'LOST').length > 0
      ? (items.filter((t) => t.status === 'WON').length /
          items.filter((t) => t.status === 'WON' || t.status === 'LOST').length) *
        100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Piedāvājumi"
        description="Tenderu pipeline — izsekojiet visus aktīvos un iesniegtos piedāvājumus"
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Jauns piedāvājums
          </Button>
        }
      />

      {/* Notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Piezīme:</strong> Piedāvājumu dati tiek glabāti lokāli šajā pārlūkā.
        Aizmugursistēmas modelis vēl nav ieviests.
      </div>

      {/* KPIs */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pipeline vērtība
              </p>
              <p className="text-xl font-bold">{fmtEur(pipelineTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Uzvarēts</p>
              <p className="text-xl font-bold text-green-600">{fmtEur(wonTotal)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Win rate</p>
              <p className="text-xl font-bold">{winRate.toFixed(0)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Aktīvie</p>
              <p className="text-xl font-bold">
                {items.filter((t) => t.status !== 'WON' && t.status !== 'LOST').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban board */}
      {items.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="Nav piedāvājumu"
          description="Pievienojiet pirmos piedāvājumus, lai izsekotu tenderu pipeline."
          action={
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Jauns piedāvājums
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_ORDER.map((status) => (
            <PipelineColumn
              key={status}
              status={status}
              tenders={items.filter((t) => t.status === status)}
              onEdit={openEdit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Rediģēt piedāvājumu' : 'Jauns piedāvājums'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nosaukums *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Dzīvojamo māju pamati Rīgā"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Klients</Label>
                <Input
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder="SIA Klients"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Vērtība (€)</Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                  min={0}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Statuss</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as TenderStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Iesniegšanas datums</Label>
                <Input
                  type="date"
                  value={form.submissionDate}
                  onChange={(e) => setForm((f) => ({ ...f, submissionDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Paredzētais sākums</Label>
                <Input
                  type="date"
                  value={form.expectedStart}
                  onChange={(e) => setForm((f) => ({ ...f, expectedStart: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Piezīmes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Papildinformācija"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={!form.title.trim() || saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editing ? 'Saglabāt' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst piedāvājumu?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Šo darbību nevar atsaukt.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              Dzēst
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
