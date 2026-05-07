/**
 * Construction — Equipment (Tehnika)
 * /dashboard/construction/equipment
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getConstructionEquipment,
  createConstructionEquipment,
  updateConstructionEquipment,
  deleteConstructionEquipment,
  type ConstructionEquipment,
  type EquipmentType,
  type EquipmentStatus,
} from '@/lib/api/construction';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wrench, Plus, RefreshCw, MoreHorizontal, Trash2 } from 'lucide-react';

const TYPE_LABELS: Record<EquipmentType, string> = {
  EXCAVATOR: 'Ekskavators',
  DUMPER: 'Pašizgāzējs',
  ROLLER: 'Rullis',
  COMPACTOR: 'Kompaktors',
  CRANE: 'Celtnis',
  OTHER: 'Cits',
};

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: 'Aktīvs',
  MAINTENANCE: 'Remonts',
  IDLE: 'Brīvs',
};

const STATUS_VARIANTS: Record<
  EquipmentStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  ACTIVE: 'default',
  MAINTENANCE: 'destructive',
  IDLE: 'secondary',
};

const EMPTY_FORM = {
  name: '',
  type: 'EXCAVATOR' as EquipmentType,
  licensePlate: '',
  yearManufactured: new Date().getFullYear(),
  status: 'IDLE' as EquipmentStatus,
  hourlyRate: 0,
  assignedProject: '',
  notes: '',
};

export default function EquipmentPage() {
  const { token } = useAuth();

  const [equipment, setEquipment] = useState<ConstructionEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ConstructionEquipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getConstructionEquipment(token);
      setEquipment(res.data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const openEdit = (item: ConstructionEquipment) => {
    setEditItem(item);
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
  };

  const handleSave = async () => {
    if (!form.name || !form.licensePlate) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        assignedProject: form.assignedProject || undefined,
        notes: form.notes || undefined,
      };
      if (editItem) {
        const updated = await updateConstructionEquipment(editItem.id, payload, token);
        setEquipment((prev) => prev.map((e) => (e.id === editItem.id ? updated : e)));
        setEditItem(null);
      } else {
        const created = await createConstructionEquipment(payload, token);
        setEquipment((prev) => [...prev, created]);
        setCreateOpen(false);
      }
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Dzēst šo tehniku?')) return;
    await deleteConstructionEquipment(id, token);
    setEquipment((prev) => prev.filter((e) => e.id !== id));
  };

  const FormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nosaukums *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="CAT 317 Ekskavators"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tips *</Label>
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
        <div className="space-y-1.5">
          <Label>Reģistrācijas nr. *</Label>
          <Input
            value={form.licensePlate}
            onChange={(e) => setForm((f) => ({ ...f, licensePlate: e.target.value.toUpperCase() }))}
            placeholder="AA-0000"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Izlaiduma gads</Label>
          <Input
            type="number"
            value={form.yearManufactured}
            onChange={(e) => setForm((f) => ({ ...f, yearManufactured: Number(e.target.value) }))}
            min={1980}
            max={new Date().getFullYear() + 1}
          />
        </div>
        <div className="space-y-1.5">
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
        <div className="space-y-1.5">
          <Label>Stundas likme (€)</Label>
          <Input
            type="number"
            value={form.hourlyRate}
            onChange={(e) => setForm((f) => ({ ...f, hourlyRate: Number(e.target.value) }))}
            min={0}
            step={0.5}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Piešķirtais projekts</Label>
        <Input
          value={form.assignedProject}
          onChange={(e) => setForm((f) => ({ ...f, assignedProject: e.target.value }))}
          placeholder="Projekta nosaukums"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Piezīmes</Label>
        <Input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tehnika"
        description="Celtniecības tehnikas reģistrs"
        icon={Wrench}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={load}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Pievienot
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : equipment.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Nav tehnikas"
              description="Pievienojiet pirmo celtniecības mašīnu"
              action={
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Pievienot tehniku
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nosaukums</TableHead>
                  <TableHead>Tips</TableHead>
                  <TableHead>Reģ. nr.</TableHead>
                  <TableHead>Gads</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Likme/h</TableHead>
                  <TableHead>Projekts</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-medium">{eq.name}</TableCell>
                    <TableCell>{TYPE_LABELS[eq.type]}</TableCell>
                    <TableCell className="font-mono">{eq.licensePlate}</TableCell>
                    <TableCell>{eq.yearManufactured}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[eq.status]}>{STATUS_LABELS[eq.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {eq.hourlyRate > 0 ? `€${eq.hourlyRate.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {eq.assignedProject ?? '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(eq)}>Rediģēt</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(eq.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Dzēst
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pievienot tehniku</DialogTitle>
          </DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.licensePlate}>
              {saving ? 'Saglabā...' : 'Pievienot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rediģēt tehniku</DialogTitle>
          </DialogHeader>
          <FormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.licensePlate}>
              {saving ? 'Saglabā...' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
