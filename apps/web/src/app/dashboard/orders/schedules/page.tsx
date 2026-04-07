/**
 * Recurring order schedules page — /dashboard/orders/schedules
 * Lists all active recurring material order schedules for the current buyer.
 * Allows pausing / resuming / deleting schedules.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  listSchedules,
  pauseSchedule,
  resumeSchedule,
  deleteSchedule,
  createSchedule,
  getMaterials,
} from '@/lib/api';
import type { ApiOrderSchedule, CreateOrderScheduleInput, ApiMaterial } from '@/lib/api';

const INTERVAL_LABELS: Record<number, string> = {
  7: 'Katru nedēļu',
  14: 'Reizi divās nedēļās',
  30: 'Reizi mēnesī',
};

function intervalLabel(days: number): string {
  return INTERVAL_LABELS[days] ?? `Ik ${days} dienas`;
}

// ── New schedule form state ───────────────────────────────────────────────────

const EMPTY_FORM: CreateOrderScheduleInput = {
  orderType: 'MATERIAL',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryState: 'Latvija',
  deliveryPostal: '',
  items: [{ materialId: '', quantity: 1, unit: 'TONNE' }],
  intervalDays: 7,
  nextRunAt: '',
  endsAt: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const { token } = useAuth();
  const [schedules, setSchedules] = useState<ApiOrderSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateOrderScheduleInput>(EMPTY_FORM);
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listSchedules(token);
      setSchedules(data);
    } catch {
      setError('Neizdevās ielādēt grafikus. Mēģiniet vēlreiz.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePause(id: string) {
    if (!token) return;
    try {
      const updated = await pauseSchedule(id, token);
      setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {
      setError('Neizdevās apturēt grafiku.');
    }
  }

  async function handleResume(id: string) {
    if (!token) return;
    try {
      const updated = await resumeSchedule(id, token);
      setSchedules((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch {
      setError('Neizdevās atsākt grafiku.');
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      await deleteSchedule(id, token);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('Neizdevās dzēst grafiku.');
    }
  }

  async function handleCreate() {
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const payload: CreateOrderScheduleInput = {
        ...form,
        nextRunAt: form.nextRunAt || undefined,
        endsAt: form.endsAt || undefined,
      };
      const created = await createSchedule(payload, token);
      setSchedules((prev) => [created, ...prev]);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch {
      setError('Neizdevās izveidot grafiku. Pārbaudiet aizpildītos laukus.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regulārie pasūtījumi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automātiski atkārtoti piegādes grafiki
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (open && token && materials.length === 0) {
                setLoadingMaterials(true);
                getMaterials(token)
                  .then(setMaterials)
                  .catch(() => {})
                  .finally(() => setLoadingMaterials(false));
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Jauns grafiks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Izveidot regulāro pasūtījumu</DialogTitle>
                <DialogDescription>
                  Aizpildiet piegādes datus un atkārtošanas intervālu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label>Piegādes adrese *</Label>
                    <Input
                      placeholder="Iela 1, Rīga"
                      value={form.deliveryAddress}
                      onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Pilsēta *</Label>
                    <Input
                      placeholder="Rīga"
                      value={form.deliveryCity}
                      onChange={(e) => setForm((f) => ({ ...f, deliveryCity: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Pasta indekss *</Label>
                    <Input
                      placeholder="LV-1001"
                      value={form.deliveryPostal}
                      onChange={(e) => setForm((f) => ({ ...f, deliveryPostal: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Atkārtošanas biežums *</Label>
                    <Select
                      value={String(form.intervalDays)}
                      onValueChange={(val) => setForm((f) => ({ ...f, intervalDays: Number(val) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Katru nedēļu</SelectItem>
                        <SelectItem value="14">Reizi divās nedēļās</SelectItem>
                        <SelectItem value="30">Reizi mēnesī</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Pirmais pasūtījums (pēc izvēles)</Label>
                    <Input
                      type="date"
                      value={form.nextRunAt ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, nextRunAt: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Beigu datums (pēc izvēles)</Label>
                    <Input
                      type="date"
                      value={form.endsAt ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Materiāls *</Label>
                    {loadingMaterials ? (
                      <p className="text-xs text-muted-foreground py-2">Ielādē materiālus...</p>
                    ) : (
                      <Select
                        value={form.items[0]?.materialId ?? ''}
                        onValueChange={(val) =>
                          setForm((f) => ({
                            ...f,
                            items: [{ ...f.items[0], materialId: val }],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Izvēlieties materiālu" />
                        </SelectTrigger>
                        <SelectContent>
                          {materials.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} — {m.supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label>Daudzums *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.items[0]?.quantity ?? 1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          items: [{ ...f.items[0], quantity: Number(e.target.value) }],
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Vienība</Label>
                    <Select
                      value={form.items[0]?.unit ?? 'TONNE'}
                      onValueChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          items: [{ ...f.items[0], unit: val }],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TONNE">Tonna</SelectItem>
                        <SelectItem value="M3">m³</SelectItem>
                        <SelectItem value="LOAD">Kravas vienība</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Atcelt
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={
                    creating ||
                    !form.deliveryAddress ||
                    !form.deliveryCity ||
                    !form.deliveryPostal ||
                    !form.items[0]?.materialId
                  }
                >
                  {creating ? 'Veido...' : 'Izveidot grafiku'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error banner */}
      {error && !dialogOpen && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          Ielādē grafikus...
        </div>
      )}

      {/* Empty state */}
      {!loading && schedules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <CalendarClock className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-muted-foreground">Nav regulāro pasūtījumu</p>
            <p className="text-sm text-muted-foreground mt-1">
              Izveidojiet grafiku, lai automātiski atkārtotu piegādes.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Jauns grafiks
          </Button>
        </div>
      )}

      {/* Schedule list */}
      {!loading && schedules.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onPause,
  onResume,
  onDelete,
}: {
  schedule: ApiOrderSchedule;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Card className={schedule.enabled ? '' : 'opacity-60'}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            {schedule.deliveryCity}
            {schedule.deliveryAddress ? (
              <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                {schedule.deliveryAddress}
              </span>
            ) : null}
          </CardTitle>
          <Badge variant={schedule.enabled ? 'default' : 'secondary'} className="shrink-0">
            {schedule.enabled ? 'Aktīvs' : 'Apturēts'}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1.5 mt-1">
          <CalendarClock className="h-3.5 w-3.5" />
          {intervalLabel(schedule.intervalDays)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Items snapshot */}
        <ul className="text-sm text-muted-foreground space-y-0.5">
          {schedule.itemsSnapshot.map((item, i) => (
            <li key={i}>
              {item.quantity} {item.unit.toLowerCase()} ·{' '}
              <span className="font-mono text-xs text-foreground">
                {item.materialId.slice(0, 8)}…
              </span>
            </li>
          ))}
        </ul>

        {/* Dates */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>
            Nākamais: <strong className="text-foreground">{fmtDate(schedule.nextRunAt)}</strong>
          </p>
          {schedule.endsAt && (
            <p>
              Beidzas: <strong className="text-foreground">{fmtDate(schedule.endsAt)}</strong>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {schedule.enabled ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onPause(schedule.id)}
            >
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Apturēt
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onResume(schedule.id)}
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Atsākt
            </Button>
          )}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Dzēst grafiku?</DialogTitle>
                <DialogDescription>
                  Šī darbība ir neatgriezeniska. Grafiks tiks dzēsts un turpmākie pasūtījumi netiks
                  izpildīti.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Atcelt
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    onDelete(schedule.id);
                    setConfirmOpen(false);
                  }}
                >
                  Dzēst
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
