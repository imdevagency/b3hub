/**
 * B3 Construction — Tehnika (Equipment)
 * /dashboard/b3-construction/equipment
 *
 * Frontend-only equipment registry. Data is stored in localStorage under
 * 'b3-equipment' until a backend ConstructionEquipment model is added.
 *
 * TODO: Wire to backend once ConstructionEquipment model is added to schema.
 */
'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Edit2, Loader2, Plus, Trash2, Wrench } from 'lucide-react';
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

// ─── types ────────────────────────────────────────────────────────────────────

type EquipmentType = 'EXCAVATOR' | 'DUMPER' | 'ROLLER' | 'COMPACTOR' | 'CRANE' | 'OTHER';
type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE';

interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  licensePlate: string;
  yearManufactured: number;
  status: EquipmentStatus;
  hourlyRate: number;
  assignedProject?: string;
  notes?: string;
  createdAt: string;
}

// ─── labels / styles ──────────────────────────────────────────────────────────

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

const STORAGE_KEY = 'b3-equipment';

function uid() {
  return `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): Equipment[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveToStorage(items: Equipment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ─── empty form ───────────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<Equipment, 'id' | 'createdAt'> = {
  name: '',
  type: 'EXCAVATOR',
  licensePlate: '',
  yearManufactured: new Date().getFullYear(),
  status: 'IDLE',
  hourlyRate: 0,
  assignedProject: '',
  notes: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
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

  function openEdit(item: Equipment) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      licensePlate: item.licensePlate,
      yearManufactured: item.yearManufactured,
      status: item.status,
      hourlyRate: item.hourlyRate,
      assignedProject: item.assignedProject ?? '',
      notes: item.notes ?? '',
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setTimeout(() => {
      let updated: Equipment[];
      if (editing) {
        updated = items.map((i) => (i.id === editing.id ? { ...editing, ...form } : i));
      } else {
        const newItem: Equipment = {
          id: uid(),
          ...form,
          createdAt: new Date().toISOString(),
        };
        updated = [...items, newItem];
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

  const activeCount = items.filter((i) => i.status === 'ACTIVE').length;
  const maintenanceCount = items.filter((i) => i.status === 'MAINTENANCE').length;
  const idleCount = items.filter((i) => i.status === 'IDLE').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tehnika"
        description="Būvniecības tehnikas reģistrs — traktori, ekskavatori, veltņi u.c."
        action={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" />
            Pievienot
          </Button>
        }
      />

      {/* Notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Piezīme:</strong> Tehnikas dati tiek glabāti lokāli šajā pārlūkā. Aizmugursistēmas
        modelis vēl nav ieviests.
      </div>

      {/* KPIs */}
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

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nav tehnikas ierakstu"
          description="Pievienojiet pirmās mašīnas, lai izsekotu to statusu un stundu likmi."
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

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
