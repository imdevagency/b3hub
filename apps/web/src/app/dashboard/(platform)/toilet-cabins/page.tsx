/**
 * Toilet Cabin Operator Dashboard — /dashboard/toilet-cabins
 * Two tabs:
 *   "Pasūtījumi"  — incoming orders to manage (status lifecycle)
 *   "Mana flote"  — fleet settings: configure cabin types, pricing, cities
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getCarrierToiletCabinOrders,
  updateToiletCabinCarrierStatus,
  getCarrierToiletCabinSettings,
  upsertCarrierToiletCabinSettings,
  type CarrierToiletCabinOrder,
  type CarrierToiletCabinSettings,
  type SetToiletCabinSettingsPayload,
  type ToiletCabinStatus,
  type ToiletCabinType,
} from '@/lib/api/toilet-cabins';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent } from '@/components/ui/card';
import { SKIP_HIRE_STATUS, StatusBadgeTw } from '@/lib/status-config';
import {
  Calendar,
  Home,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Toilet,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { lv } from 'date-fns/locale';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Gaida' },
  { value: 'CONFIRMED', label: 'Apstiprināti' },
  { value: 'DELIVERED', label: 'Piegādāti' },
  { value: 'IN_USE', label: 'Lietošanā' },
  { value: 'COLLECTED', label: 'Savākti' },
  { value: 'COMPLETED', label: 'Pabeigti' },
];

const NEXT_STATUS: Partial<Record<ToiletCabinStatus, ToiletCabinStatus>> = {
  CONFIRMED: 'DELIVERED',
  DELIVERED: 'IN_USE',
  IN_USE: 'COLLECTED',
  COLLECTED: 'COMPLETED',
};

const NEXT_STATUS_LABEL: Partial<Record<ToiletCabinStatus, string>> = {
  CONFIRMED: 'Atzīmēt piegādātu',
  DELIVERED: 'Aktivizēt nomu',
  IN_USE: 'Savākta',
  COLLECTED: 'Pabeigt',
};

const CABIN_TYPE_LABELS: Record<ToiletCabinType, string> = {
  STANDARD: 'Standarta',
  DISABLED_ACCESS: 'Pieejamības kabīne',
  VIP: 'VIP',
  HEATED: 'Sildāmā',
};

const ALL_CABIN_TYPES: ToiletCabinType[] = ['STANDARD', 'DISABLED_ACCESS', 'VIP', 'HEATED'];

const BLANK_FORM: SetToiletCabinSettingsPayload = {
  cabinType: 'STANDARD',
  pricePerCabinPerDay: 0,
  maxCabins: 1,
  serviceCities: [],
  isActive: true,
};

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'orders' | 'fleet';

export default function ToiletCabinsOperatorPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('orders');

  // Orders
  const [orders, setOrders] = useState<CarrierToiletCabinOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fleet
  const [fleet, setFleet] = useState<CarrierToiletCabinSettings[]>([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SetToiletCabinSettingsPayload>(BLANK_FORM);
  const [citiesInput, setCitiesInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      setOrders(await getCarrierToiletCabinOrders(token, statusFilter));
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [token, statusFilter]);

  const loadFleet = useCallback(async () => {
    if (!token) return;
    setFleetLoading(true);
    try {
      setFleet(await getCarrierToiletCabinSettings(token));
    } catch {
      setFleet([]);
    } finally {
      setFleetLoading(false);
    }
  }, [token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { if (tab === 'fleet') loadFleet(); }, [tab, loadFleet]);

  async function handleAdvance(order: CarrierToiletCabinOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next || !token) return;
    setUpdatingId(order.id);
    try {
      await updateToiletCabinCarrierStatus(order.id, next, token);
      await loadOrders();
    } finally {
      setUpdatingId(null);
    }
  }

  function openEdit(s: CarrierToiletCabinSettings) {
    setForm({ cabinType: s.cabinType, pricePerCabinPerDay: s.pricePerCabinPerDay, maxCabins: s.maxCabins, serviceCities: s.serviceCities, isActive: s.isActive });
    setCitiesInput(s.serviceCities.join(', '));
    setSaveError('');
    setDialogOpen(true);
  }

  function openAdd(type?: ToiletCabinType) {
    setForm({ ...BLANK_FORM, cabinType: type ?? 'STANDARD' });
    setCitiesInput('');
    setSaveError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaveError('');
    try {
      await upsertCarrierToiletCabinSettings(
        { ...form, serviceCities: citiesInput.split(',').map((c) => c.trim()).filter(Boolean) },
        token,
      );
      setDialogOpen(false);
      await loadFleet();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Kļūda saglabājot');
    } finally {
      setSaving(false);
    }
  }

  const isEditing = fleet.some((s) => s.cabinType === form.cabinType);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tualetes kabīnes"
        description="Pārvaldiet savu kabīņu floti un pasūtījumus"
        action={
          tab === 'fleet' ? (
            <Button size="sm" onClick={() => openAdd()}>
              <Plus className="size-4 mr-2" /> Pievienot kabīnes tipu
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={loadOrders} disabled={ordersLoading}>
              <RefreshCw className={`size-4 mr-2 ${ordersLoading ? 'animate-spin' : ''}`} /> Atjaunot
            </Button>
          )
        }
      />

      {/* Tab switch */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {(['orders', 'fleet'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'orders' ? 'Pasūtījumi' : 'Mana flote'}
          </button>
        ))}
      </div>

      {/* ── ORDERS ─────────────────────────────────── */}
      {tab === 'orders' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground font-medium">Statuss:</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${statusFilter === f.value ? 'bg-foreground text-background' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {ordersLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : orders.length === 0 ? (
            <EmptyState icon={Home} title="Nav pasūtījumu" description="Šobrīd nav piešķirtu tualetes kabīņu pasūtījumu šajā kategorijā." />
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Pasūtījums</TableHead>
                    <TableHead>Adrese</TableHead>
                    <TableHead>Kabīnes</TableHead>
                    <TableHead>Piegāde</TableHead>
                    <TableHead>Periods</TableHead>
                    <TableHead>Kontakts</TableHead>
                    <TableHead>Statuss</TableHead>
                    <TableHead className="text-right">Darbības</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-sm font-semibold">{order.orderNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium leading-tight">{order.address}</p>
                            <p className="text-xs text-muted-foreground">{order.city}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{order.cabinCount} kab.</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                          {format(parseISO(order.deliveryDate), 'd MMM yyyy', { locale: lv })}
                          {order.deliveryWindow && <span className="text-xs text-muted-foreground">({order.deliveryWindow})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.hireDays} d.</TableCell>
                      <TableCell>
                        {order.contactPhone ? (
                          <a href={`tel:${order.contactPhone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                            <Phone className="size-3.5 shrink-0" />{order.contactPhone}
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><StatusBadgeTw cfg={SKIP_HIRE_STATUS[order.status]} /></TableCell>
                      <TableCell className="text-right">
                        {NEXT_STATUS[order.status] && (
                          <Button size="sm" variant="outline" className="text-xs h-8" disabled={updatingId === order.id} onClick={() => handleAdvance(order)}>
                            {NEXT_STATUS_LABEL[order.status]}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* ── FLEET ─────────────────────────────────── */}
      {tab === 'fleet' && (
        <>
          {fleetLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fleet.map((s) => (
                <Card key={s.id} className="rounded-2xl border border-border">
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-base font-semibold">{CABIN_TYPE_LABELS[s.cabinType]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.cabinType}</p>
                      </div>
                      <Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Aktīvs' : 'Neaktīvs'}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Cena / kabīne / d.</p>
                        <p className="font-semibold">€{s.pricePerCabinPerDay.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Maks. kabīnes</p>
                        <p className="font-semibold">{s.maxCabins}</p>
                      </div>
                    </div>
                    {s.serviceCities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.serviceCities.slice(0, 4).map((city) => (
                          <span key={city} className="px-2 py-0.5 bg-muted text-xs rounded-full capitalize">{city}</span>
                        ))}
                        {s.serviceCities.length > 4 && <span className="px-2 py-0.5 bg-muted text-xs rounded-full text-muted-foreground">+{s.serviceCities.length - 4}</span>}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => openEdit(s)}>
                      <Pencil className="size-3.5 mr-1.5" /> Rediģēt
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Empty-slot cards for unregistered types */}
              {ALL_CABIN_TYPES.filter((t) => !fleet.some((s) => s.cabinType === t)).map((t) => (
                <button
                  key={t}
                  onClick={() => openAdd(t)}
                  className="rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-muted/20 transition-colors p-5 text-left"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="size-4 shrink-0" />
                    <span className="text-sm font-medium">{CABIN_TYPE_LABELS[t]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Pievienot šo tipu</p>
                </button>
              ))}

              {fleet.length === 0 && ALL_CABIN_TYPES.every((t) => !fleet.some((s) => s.cabinType === t)) && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <EmptyState
                    icon={Toilet}
                    title="Flote nav konfigurēta"
                    description="Pievienojiet kabīņu tipus, cenas un apkalpojamās pilsētas, lai saņemtu pasūtījumus."
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── DIALOG ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? `Rediģēt — ${CABIN_TYPE_LABELS[form.cabinType]}` : 'Pievienot kabīnes tipu'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            {!isEditing && (
              <div className="space-y-2">
                <Label>Kabīnes tips</Label>
                <Select value={form.cabinType} onValueChange={(v) => setForm((f) => ({ ...f, cabinType: v as ToiletCabinType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_CABIN_TYPES.map((t) => <SelectItem key={t} value={t}>{CABIN_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cena / kabīne / dienā (€)</Label>
                <Input type="number" min={0} step={0.01} value={form.pricePerCabinPerDay} onChange={(e) => setForm((f) => ({ ...f, pricePerCabinPerDay: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Maks. kabīnes</Label>
                <Input type="number" min={1} value={form.maxCabins} onChange={(e) => setForm((f) => ({ ...f, maxCabins: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Apkalpojamās pilsētas</Label>
              <Input placeholder="Rīga, Jūrmala, Jelgava" value={citiesInput} onChange={(e) => setCitiesInput(e.target.value)} />
              <p className="text-xs text-muted-foreground">Atdaliet ar komatiem</p>
            </div>
            <div className="flex items-center justify-between p-4 border border-border rounded-xl">
              <div>
                <Label className="text-sm font-medium">Aktīvs</Label>
                <p className="text-xs text-muted-foreground">Šis tips saņems jaunus pasūtījumus</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
            </div>
            {saveError && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{saveError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>Atcelt</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Saglabā...' : 'Saglabāt'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
