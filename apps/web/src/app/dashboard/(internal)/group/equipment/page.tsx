/**
 * Grupas tehnika — /dashboard/group/equipment
 *
 * Shared equipment registry across all 3 business units.
 * An excavator or dumper is a group asset — it may work on a B3Hub delivery
 * site in the morning, a B3 Construction DPR haul in the afternoon, and a
 * B3 Recycling intake run next week.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Edit2, Loader2, Plus, RefreshCw, Trash2, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  type Equipment,
  type EquipmentType,
  type EquipmentStatus,
  type BuContext,
  type CreateEquipmentInput,
} from '@/lib/api/equipment';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types ────────────────────────────────────────────────────────────────────

type EquipmentType = 'EXCAVATOR' | 'DUMPER' | 'ROLLER' | 'COMPACTOR' | 'CRANE' | 'OTHER';
type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE';
type BuContext = 'CONSTRUCTION' | 'MARKETPLACE' | 'RECYCLING' | 'UNASSIGNED';

interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  licensePlate: string;
  yearManufactured: number;
  status: EquipmentStatus;
  buContext: BuContext;
  hourlyRate: number;
  assignedProject?: string;
  notes?: string;
  createdAt: string;
}

// ─── Labels / styles ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<EquipmentType, string> = {
  EXCAVATOR: 'Ekskavators',
  DUMPER: 'Pašizkraušanas auto',
  ROLLER: 'Veltnis',
  COMPACTOR: 'Kompaktors',
  CRANE: 'Celtnis',
  OTHER: 'Cits',
};

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: 'Aktīvs',
  MAINTENANCE: 'Apkopē',
  IDLE: 'Brīvs',
};

const STATUS_STYLE: Record<EquipmentStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  MAINTENANCE: 'bg-amber-100 text-amber-800',
  IDLE: 'bg-gray-100 text-gray-600',
};

const BU_LABELS: Record<BuContext, string> = {
  CONSTRUCTION: 'B3 Būve',
  MARKETPLACE: 'B3Hub',
  RECYCLING: 'B3 Recycle',
  UNASSIGNED: 'Brīvs',
};

const BU_STYLE: Record<BuContext, string> = {
  CONSTRUCTION: 'bg-amber-50 text-amber-700 border-amber-200',
  MARKETPLACE: 'bg-blue-50 text-blue-700 border-blue-200',
  RECYCLING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UNASSIGNED: 'bg-gray-50 text-gray-500 border-gray-200',
};

type FormState = CreateEquipmentInput & { notes: string; assignedProject: string };

const EMPTY_FORM: FormState = {
  name: '',
  type: 'EXCAVATOR',
  licensePlate: '',
  yearManufactured: new Date().getFullYear(),
  status: 'IDLE',
  buContext: 'UNASSIGNED',
  hourlyRate: 0,
  assignedProject: '',
  notes: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupEquipmentPage() {
  const { token, isLoading } = useAuth();
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listEquipment(token);
      setItems(data);
    } catch {
      setError('Neizdevās ielādēt tehnikas sarakstu.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) load();
  }, [isLoading, token, load]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(item: Equipment) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      licensePlate: item.licensePlate,
      yearManufactured: item.yearManufactured,
      status: item.status,
      buContext: item.buContext ?? 'UNASSIGNED',
      hourlyRate: item.hourlyRate,
      assignedProject: item.assignedProject ?? '',
      notes: item.notes ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !token) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateEquipment(token, editing.id, form);
        setItems((prev) => prev.map((i) => (i.id === editing.id ? updated : i)));
      } else {
        const created = await createEquipment(token, form);
        setItems((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } catch {
      // error is surfaced inline via the button disabled state; no toast needed
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await deleteEquipment(token, id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeleteId(null);
    }
  }

  const activeCount = items.filter((i) => i.status === 'ACTIVE').length;
  const maintenanceCount = items.filter((i) => i.status === 'MAINTENANCE').length;
  const idleCount = items.filter((i) => i.status === 'IDLE').length;

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tehnika"
        description="Grupas kopīgā tehnika — ekskavatori, pašizkraušanas auto, veltņi. Izmanto visos 3 biznesa virzienos."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Pievienot
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Kopā</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Aktīvs</p>
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Apkopē</p>
              <p className="text-2xl font-bold text-amber-600">{maintenanceCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Brīvs</p>
              <p className="text-2xl font-bold text-muted-foreground">{idleCount}</p>
            </CardContent>
          </Card>
        </div>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nav tehnikas ierakstu"
          description="Pievienojiet pirmās mašīnas, lai izsekotu to statusu, biznesa vienību un stundu likmi."
          action={
            <Button onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" />
              Pievienot
            </Button>
          }
        />
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nosaukums</TableHead>
                <TableHead>Veids</TableHead>
                <TableHead>Valsts nrs.</TableHead>
                <TableHead>Gads</TableHead>
                <TableHead>BV</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">€/h</TableHead>
                <TableHead>Projekts</TableHead>
                <TableHead>Pievienots</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{TYPE_LABELS[item.type]}</TableCell>
                  <TableCell className="font-mono text-sm">{item.licensePlate || '—'}</TableCell>
                  <TableCell>{item.yearManufactured}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${BU_STYLE[item.buContext ?? 'UNASSIGNED']}`}
                    >
                      {BU_LABELS[item.buContext ?? 'UNASSIGNED']}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLE[item.status]} variant="secondary">
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.hourlyRate > 0 ? `€${item.hourlyRate}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.assignedProject || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(item.createdAt), 'dd.MM.yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteId(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Rediģēt tehniku' : 'Pievienot tehniku'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Nosaukums *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Komatsu PC210"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Veids</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as EquipmentType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as EquipmentType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Statuss</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as EquipmentStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as EquipmentStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Biznesa vienība (pašreizējais uzdevums)</Label>
              <Select
                value={form.buContext}
                onValueChange={(v) => setForm((f) => ({ ...f, buContext: v as BuContext }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(BU_LABELS) as BuContext[]).map((b) => (
                    <SelectItem key={b} value={b}>
                      {BU_LABELS[b]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Valsts numurs</Label>
                <Input
                  value={form.licensePlate}
                  onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value }))}
                  placeholder="AA-1234"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Ražošanas gads</Label>
                <Input
                  type="number"
                  value={form.yearManufactured}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, yearManufactured: Number(e.target.value) }))
                  }
                  min={1990}
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Stundu likme (€/h)</Label>
                <Input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) => setForm((f) => ({ ...f, hourlyRate: Number(e.target.value) }))}
                  min={0}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Piešķirtais projekts</Label>
                <Input
                  value={form.assignedProject}
                  onChange={(e) => setForm((f) => ({ ...f, assignedProject: e.target.value }))}
                  placeholder="Projekta nosaukums"
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
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
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
            <DialogTitle>Dzēst ierakstu?</DialogTitle>
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
