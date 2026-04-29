'use client';

/**
 * Admin B3 Field detail — /dashboard/admin/b3-fields/[id]
 * Tabs: Inventory | Pickup Slots | Settings
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  getB3Field,
  updateB3Field,
  getFieldInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createPickupSlot,
  getB3FieldSlots,
  getTodayArrivals,
  bulkCreateSlots,
  scanPass,
  getFieldCameras,
  getCameraToken,
  type ApiB3Field,
  type ApiInventoryItem,
  type ApiPickupSlot,
  type ApiTodayArrivals,
  type ApiPassScanResult,
  type ApiCamera,
  type ApiCameraToken,
  type B3FieldService,
  type InventoryItemInput,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  Recycle,
  Truck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Users,
  Loader2,
  RefreshCw,
  DoorOpen,
  ScanLine,
  VideoOff,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Autocomplete, GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

const MAPS_KEY = getGoogleMapsPublicKey();
const MAPS_LIBRARIES: 'places'[] = ['places'];

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: 'P',
  tuesday: 'O',
  wednesday: 'T',
  thursday: 'C',
  friday: 'Pk',
  saturday: 'S',
  sunday: 'Sv',
};

const SERVICE_META: Record<B3FieldService, { label: string; icon: React.ElementType }> = {
  MATERIAL_PICKUP: { label: 'Materiālu paņemšana', icon: Package },
  WASTE_DISPOSAL: { label: 'Atkritumu nodošana', icon: Recycle },
  TRAILER_RENTAL: { label: 'Piekabe īrei', icon: Truck },
};

const TABS = ['inventory', 'slots', 'gate', 'cameras', 'settings'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  inventory: 'Inventārs',
  slots: 'Laika sloti',
  gate: 'Vārti',
  cameras: 'Kameras',
  settings: 'Iestatījumi',
};

// ─── Inventory tab ────────────────────────────────────────────────────────────

type InventoryForm = {
  name: string;
  unit: string;
  pricePerUnit: string;
  stockQty: string;
  minStockQty: string;
  available: boolean;
  notes: string;
};
const emptyInventoryForm = (): InventoryForm => ({
  name: '',
  unit: 't',
  pricePerUnit: '',
  stockQty: '0',
  minStockQty: '0',
  available: true,
  notes: '',
});

function InventoryTab({ fieldId, token }: { fieldId: string; token: string }) {
  const [items, setItems] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiInventoryItem | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyInventoryForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getFieldInventory(token, fieldId));
    } finally {
      setLoading(false);
    }
  }, [token, fieldId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyInventoryForm());
    setError('');
    setSheetOpen(true);
  };
  const openEdit = (item: ApiInventoryItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      pricePerUnit: String(item.pricePerUnit),
      stockQty: String(item.stockQty),
      minStockQty: String(item.minStockQty),
      available: item.available,
      notes: item.notes ?? '',
    });
    setError('');
    setSheetOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.unit || !form.pricePerUnit) {
      setError('Nosaukums, vienība un cena ir obligāti');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data: InventoryItemInput = {
        name: form.name,
        unit: form.unit,
        pricePerUnit: parseFloat(form.pricePerUnit),
        stockQty: parseFloat(form.stockQty) || 0,
        minStockQty: parseFloat(form.minStockQty) || 0,
        available: form.available,
        notes: form.notes || undefined,
      };
      if (editing) {
        await updateInventoryItem(token, fieldId, editing.id, data);
      } else {
        await createInventoryItem(token, fieldId, data);
      }
      setSheetOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ApiInventoryItem) => {
    if (!confirm(`Dzēst "${item.name}"?`)) return;
    setDeleting(item.id);
    try {
      await deleteInventoryItem(token, fieldId, item.id);
      load();
    } catch {
      /* ignore */
    } finally {
      setDeleting(null);
    }
  };

  const lowStock = (item: ApiInventoryItem) =>
    item.minStockQty > 0 && item.stockQty <= item.minStockQty;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{items.length} pozīcija(-s)</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> Pievienot
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nav inventāra"
          description="Pievienojiet materiālus, kas pieejami šajā punktā"
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border p-4',
                !item.available && 'opacity-60',
                lowStock(item) && 'border-amber-400/60 bg-amber-50/40',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-foreground">{item.name}</p>
                  {!item.available && (
                    <Badge variant="secondary" className="text-xs">
                      Nav pieejams
                    </Badge>
                  )}
                  {lowStock(item) && (
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Maz krājuma
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.stockQty} {item.unit} krājumā · €{item.pricePerUnit}/{item.unit}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(item)}
                  disabled={deleting === item.id}
                >
                  {deleting === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Rediģēt pozīciju' : 'Jauna pozīcija'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Nosaukums *</Label>
              <Input
                placeholder="piem. Grants 0-32mm"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vienība *</Label>
                <Input
                  placeholder="t / m³ / gab."
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cena (€/vienība) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm((p) => ({ ...p, pricePerUnit: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Krājums</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.stockQty}
                  onChange={(e) => setForm((p) => ({ ...p, stockQty: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Minimālais brīdinājums</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.minStockQty}
                  onChange={(e) => setForm((p) => ({ ...p, minStockQty: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Piezīmes (iekšējas)</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <Label>Pieejams pasūtījumos</Label>
              <Switch
                checked={form.available}
                onCheckedChange={(v) => setForm((p) => ({ ...p, available: v }))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Saglabāt'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Slots tab ────────────────────────────────────────────────────────────────

function SlotsTab({ fieldId, token }: { fieldId: string; token: string }) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<ApiPickupSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bulkSheetOpen, setBulkSheetOpen] = useState(false);
  const [slotForm, setSlotForm] = useState({
    date: today,
    startTime: '08:00',
    endTime: '09:00',
    capacity: '4',
  });
  const [bulkForm, setBulkForm] = useState({
    startDate: today,
    endDate: today,
    slotTimes: '08:00,10:00,12:00',
    durationMinutes: '60',
    capacity: '4',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon–Fri
  });
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState('');
  const [bulkResult, setBulkResult] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSlots(await getB3FieldSlots(fieldId, date));
    } finally {
      setLoading(false);
    }
  }, [fieldId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const createSlot = async () => {
    setSaving(true);
    setError('');
    try {
      const slotStart = `${slotForm.date}T${slotForm.startTime}:00`;
      const slotEnd = `${slotForm.date}T${slotForm.endTime}:00`;
      await createPickupSlot(token, {
        fieldId,
        slotStart,
        slotEnd,
        capacity: parseInt(slotForm.capacity) || 4,
      });
      setSheetOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  };

  const createBulkSlots = async () => {
    setBulkSaving(true);
    setBulkResult('');
    try {
      const times = bulkForm.slotTimes
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const { created } = await bulkCreateSlots(token, fieldId, {
        startDate: bulkForm.startDate,
        endDate: bulkForm.endDate,
        slotTimes: times,
        durationMinutes: parseInt(bulkForm.durationMinutes) || 60,
        capacity: parseInt(bulkForm.capacity) || 4,
        daysOfWeek: bulkForm.daysOfWeek,
      });
      setBulkResult(`Izveidoti ${created} sloti`);
      load();
    } catch (e) {
      setBulkResult(`Kļūda: ${e instanceof Error ? e.message : 'Nezināma kļūda'}`);
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleBulkDay = (d: number) => {
    setBulkForm((p) => ({
      ...p,
      daysOfWeek: p.daysOfWeek.includes(d)
        ? p.daysOfWeek.filter((x) => x !== d)
        : [...p.daysOfWeek, d].sort(),
    }));
  };

  const fillPct = (slot: ApiPickupSlot) => Math.round((slot.booked / slot.capacity) * 100);
  const WEEK_DAYS = [
    { d: 1, l: 'P' },
    { d: 2, l: 'O' },
    { d: 3, l: 'T' },
    { d: 4, l: 'C' },
    { d: 5, l: 'Pk' },
    { d: 6, l: 'S' },
    { d: 0, l: 'Sv' },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkSheetOpen(true)}>
            <CalendarDays className="h-4 w-4 mr-1.5" /> Ģenerēt
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSlotForm((p) => ({ ...p, date }));
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Jauns slots
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nav slotu"
          description={`Izvēlētajā datumā (${date}) nav izveidotu laika slotu`}
          action={
            <Button size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot slotu
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => {
            const pct = fillPct(slot);
            const full = slot.booked >= slot.capacity;
            return (
              <div
                key={slot.id}
                className={cn(
                  'flex items-center gap-4 rounded-xl border p-4',
                  full && 'border-muted-foreground/30 bg-muted/30',
                )}
              >
                <Clock
                  className={cn(
                    'h-4 w-4 shrink-0',
                    full ? 'text-muted-foreground' : 'text-foreground',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">
                    {new Date(slot.slotStart).toLocaleTimeString('lv-LV', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' – '}
                    {new Date(slot.slotEnd).toLocaleTimeString('lv-LV', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-muted rounded-full h-1.5 max-w-24">
                      <div
                        className={cn(
                          'h-1.5 rounded-full transition-all',
                          full ? 'bg-destructive' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {slot.booked}/{slot.capacity}
                    </span>
                  </div>
                </div>
                {full ? (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Pilns
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 border-emerald-500/40 text-emerald-700"
                  >
                    {slot.capacity - slot.booked} brīvi
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Jauns laika slots</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Datums</Label>
              <Input
                type="date"
                value={slotForm.date}
                onChange={(e) => setSlotForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sākums</Label>
                <Input
                  type="time"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Beigas</Label>
                <Input
                  type="time"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Kapacitāte (transportlīdzekļi)</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={slotForm.capacity}
                onChange={(e) => setSlotForm((p) => ({ ...p, capacity: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={createSlot} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Izveidot slotu'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bulk slot generator */}
      <Sheet open={bulkSheetOpen} onOpenChange={setBulkSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ģenerēt laika slotus</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>No datuma</Label>
                <Input
                  type="date"
                  value={bulkForm.startDate}
                  onChange={(e) => setBulkForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Līdz datumam</Label>
                <Input
                  type="date"
                  value={bulkForm.endDate}
                  onChange={(e) => setBulkForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Slotu laiki (ar komatu)</Label>
              <Input
                placeholder="08:00,10:00,12:00,14:00"
                value={bulkForm.slotTimes}
                onChange={(e) => setBulkForm((p) => ({ ...p, slotTimes: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Katrs laiks = viens slots dienā</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ilgums (min)</Label>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={bulkForm.durationMinutes}
                  onChange={(e) => setBulkForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kapacitāte/slots</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={bulkForm.capacity}
                  onChange={(e) => setBulkForm((p) => ({ ...p, capacity: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nedēļas dienas</Label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEK_DAYS.map(({ d, l }) => (
                  <button
                    key={d}
                    onClick={() => toggleBulkDay(d)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-xs font-bold border transition-colors',
                      bulkForm.daysOfWeek.includes(d)
                        ? 'bg-foreground text-background border-foreground'
                        : 'bg-background text-muted-foreground border-border',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {bulkResult && (
              <p
                className={cn(
                  'text-sm',
                  bulkResult.startsWith('Kļūda') ? 'text-destructive' : 'text-emerald-600',
                )}
              >
                {bulkResult}
              </p>
            )}
            <Button className="w-full" onClick={createBulkSlots} disabled={bulkSaving}>
              {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ģenerēt slotus'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Gate tab ─────────────────────────────────────────────────────────────────

function GateTab({ fieldId, token }: { fieldId: string; token: string }) {
  const [data, setData] = useState<ApiTodayArrivals | null>(null);
  const [loading, setLoading] = useState(true);
  // Scan state
  const [scanInput, setScanInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ApiPassScanResult | null>(null);
  const [scanError, setScanError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getTodayArrivals(token, fieldId));
    } finally {
      setLoading(false);
    }
  }, [token, fieldId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const handleScan = async () => {
    const pn = scanInput.trim().toUpperCase();
    if (!pn) return;
    setScanLoading(true);
    setScanError('');
    setScanResult(null);
    try {
      const result = await scanPass(token, fieldId, pn);
      setScanResult(result);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Kļūda skenēšanas laikā');
    } finally {
      setScanLoading(false);
    }
  };

  const passStatusMeta: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: 'Aktīvs', className: 'border-emerald-500/50 text-emerald-700' },
    EXPIRED: { label: 'Beidzies', className: 'border-muted text-muted-foreground' },
    REVOKED: { label: 'Atsaukts', className: 'border-destructive/50 text-destructive' },
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString('lv-LV', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* ── Pass scan card ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Skenēt / ievadīt caurlaides numuru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="FP-2026-00001"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              className="font-mono uppercase tracking-widest"
            />
            <Button onClick={handleScan} disabled={scanLoading || !scanInput.trim()}>
              {scanLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ScanLine className="h-4 w-4 mr-1.5" />
                  Pārbaudīt
                </>
              )}
            </Button>
          </div>
          {scanError && <p className="text-sm text-destructive">{scanError}</p>}
          {scanResult && (
            <div
              className={cn(
                'rounded-xl border-2 p-4 space-y-2 transition-colors',
                scanResult.isValid
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                  : 'border-destructive bg-destructive/5',
              )}
            >
              <div className="flex items-center gap-2">
                {scanResult.isValid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <span
                  className={cn(
                    'font-bold text-base',
                    scanResult.isValid ? 'text-emerald-700' : 'text-destructive',
                  )}
                >
                  {scanResult.isValid ? 'ATĻAUTS' : 'NORAIDĪTS'}
                </span>
                <span className="font-mono text-sm text-muted-foreground ml-auto">
                  {scanResult.pass.passNumber}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Auto: </span>
                  <span className="font-semibold">{scanResult.pass.vehiclePlate}</span>
                </div>
                {scanResult.pass.driverName && (
                  <div>
                    <span className="text-muted-foreground">Šoferis: </span>
                    {scanResult.pass.driverName}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Uzņēmums: </span>
                  {scanResult.pass.company.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Līgums: </span>
                  {scanResult.pass.contract.contractNumber}
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Derīgs: </span>
                  {fmt(scanResult.pass.validFrom)} – {fmt(scanResult.pass.validTo)}
                </div>
                {!scanResult.isValid && scanResult.pass.revokedReason && (
                  <div className="col-span-2 text-destructive">{scanResult.pass.revokedReason}</div>
                )}
                {scanResult.pass.wasteClassCode && !scanResult.wasteAccepted && (
                  <div className="col-span-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 text-xs font-semibold">
                    ⚠️ Atkritumu veids &quot;{scanResult.pass.wasteClassCode}&quot; nav pieņemts
                    šajā laukā.
                    {scanResult.acceptedWasteTypes.length > 0 && (
                      <> Pieņemtie: {scanResult.acceptedWasteTypes.join(', ')}.</>
                    )}
                  </div>
                )}
              </div>
              {scanResult.pass.weighingSlips.length > 0 && (
                <p className="text-xs text-emerald-600 font-medium">
                  Iepriekšējie svēršanas:{' '}
                  {scanResult.pass.weighingSlips
                    .map((w) => `${w.slipNumber}${w.netTonnes ? ` (${w.netTonnes}t)` : ''}`)
                    .join(', ')}
                </p>
              )}
              <p className="text-xs text-muted-foreground text-right">
                Skenēts: {fmt(scanResult.scannedAt)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Šodienas ({new Date().toLocaleDateString('lv-LV')}) ieraksti — automātiski atjaunojas ik
          30s
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1.5', loading && 'animate-spin')} /> Atjaunot
        </Button>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Orders with pickup slots */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pasūtījumi ar laika slotos ({data?.orders.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.orders.length ? (
                <EmptyState icon={Clock} title="Nav pasūtījumu šodienai" />
              ) : (
                <div className="space-y-3">
                  {data.orders.map((order) => (
                    <div key={order.id} className="rounded-xl border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">#{order.orderNumber}</p>
                        <Badge variant="outline" className="text-xs">
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{order.buyer.name}</p>
                      {order.pickupSlot && (
                        <p className="text-xs text-foreground font-medium">
                          {new Date(order.pickupSlot.slotStart).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' – '}
                          {new Date(order.pickupSlot.slotEnd).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {order.items.map((item, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {item.quantity} {item.unit} {item.material.name}
                          </Badge>
                        ))}
                      </div>
                      {order.fieldPasses.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.fieldPasses.map((pass) => {
                            const meta = passStatusMeta[pass.status] ?? passStatusMeta.ACTIVE;
                            return (
                              <Badge
                                key={pass.id}
                                variant="outline"
                                className={cn('text-xs', meta.className)}
                              >
                                {pass.passNumber} · {pass.vehiclePlate}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active field passes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                Caurlaides ({data?.passes.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data?.passes.length ? (
                <EmptyState icon={DoorOpen} title="Nav aktīvu caurlaiž" />
              ) : (
                <div className="space-y-3">
                  {data.passes.map((pass) => {
                    const meta = passStatusMeta[pass.status] ?? passStatusMeta.ACTIVE;
                    return (
                      <div key={pass.id} className="rounded-xl border p-4 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{pass.passNumber}</p>
                          <Badge variant="outline" className={cn('text-xs', meta.className)}>
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{pass.company.name}</p>
                        <p className="text-xs">
                          <span className="font-medium">{pass.vehiclePlate}</span>
                          {pass.driverName && <> · {pass.driverName}</>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(pass.validFrom).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' – '}
                          {new Date(pass.validTo).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {pass.weighingSlips.length > 0 && (
                          <p className="text-xs text-emerald-600 font-medium">
                            Pasverts:{' '}
                            {pass.weighingSlips.reduce((s, w) => s + w.netTonnes, 0).toFixed(2)} t
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Cameras tab ─────────────────────────────────────────────────────────────

type GridMode = '1x1' | '2x2' | '3col';

function CameraTile({
  camera,
  viewerToken,
  loading,
}: {
  camera: ApiCamera;
  viewerToken: string | null;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="text-xs font-medium text-zinc-300 truncate">{camera.name}</span>
      </div>
      <div className="aspect-video bg-zinc-950 flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
        ) : viewerToken ? (
          <iframe
            src={`https://open.ezvizlife.com/player/index.html?accessToken=${viewerToken}&deviceSerial=${encodeURIComponent(camera.deviceSerial)}&channelNo=${camera.channelNo}`}
            className="w-full h-full border-0"
            allowFullScreen
            title={camera.name}
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <VideoOff className="h-7 w-7 text-zinc-600" />
            <p className="text-xs text-zinc-500">Nav savienojuma</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CamerasTab({ fieldId, token }: { fieldId: string; token: string }) {
  const [cameras, setCameras] = useState<ApiCamera[]>([]);
  const [viewerTokens, setViewerTokens] = useState<Record<string, string>>({});
  const [tokenLoading, setTokenLoading] = useState<Record<string, boolean>>({});
  const [camLoading, setCamLoading] = useState(true);
  const [arrivals, setArrivals] = useState<ApiTodayArrivals | null>(null);
  const [arrLoading, setArrLoading] = useState(true);
  const [gridMode, setGridMode] = useState<GridMode | null>(null);

  const loadCameras = useCallback(async () => {
    setCamLoading(true);
    try {
      const cams = await getFieldCameras(token, fieldId);
      setCameras(cams);
      if (cams.length > 0) {
        setTokenLoading(Object.fromEntries(cams.map((c) => [c.id, true])));
        await Promise.allSettled(
          cams.map(async (cam) => {
            try {
              const res = await getCameraToken(token, fieldId, cam.id);
              setViewerTokens((prev) => ({ ...prev, [cam.id]: res.viewerToken }));
            } catch {
              // no token — tile shows placeholder
            } finally {
              setTokenLoading((prev) => ({ ...prev, [cam.id]: false }));
            }
          }),
        );
      }
    } finally {
      setCamLoading(false);
    }
  }, [token, fieldId]);

  const loadArrivals = useCallback(async () => {
    try {
      setArrivals(await getTodayArrivals(token, fieldId));
    } finally {
      setArrLoading(false);
    }
  }, [token, fieldId]);

  useEffect(() => {
    loadCameras();
    loadArrivals();
    const interval = setInterval(loadArrivals, 30_000);
    return () => clearInterval(interval);
  }, [loadCameras, loadArrivals]);

  const effectiveGrid: GridMode =
    gridMode ?? (cameras.length <= 1 ? '1x1' : cameras.length <= 4 ? '2x2' : '3col');
  const gridClass =
    effectiveGrid === '1x1'
      ? 'grid-cols-1 max-w-2xl'
      : effectiveGrid === '2x2'
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const todayEntries = arrivals?.passes.filter((p) => p.weighingSlips.length > 0).length ?? 0;
  const onSite = arrivals?.passes.filter((p) => p.status === 'ACTIVE').length ?? 0;
  const openPasses = arrivals?.passes.length ?? 0;
  const todayOrders = arrivals?.orders.length ?? 0;

  const events = arrivals
    ? [...arrivals.passes]
        .sort((a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())
        .slice(0, 25)
    : [];

  const STAT_ITEMS = [
    { label: 'Iebraukumi šodien', value: arrLoading ? '—' : todayEntries, icon: DoorOpen },
    { label: 'Uz vietas', value: arrLoading ? '—' : onSite, icon: Users },
    { label: 'Caurlaidēs', value: arrLoading ? '—' : openPasses, icon: LayoutGrid },
    { label: 'Pasūtījumi', value: arrLoading ? '—' : todayOrders, icon: Package },
  ];

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_ITEMS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Camera grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold">
            Kameras{cameras.length > 0 ? ` (${cameras.length})` : ''}
          </p>
          {cameras.length > 1 && (
            <div className="flex items-center gap-0.5 border rounded-lg p-1">
              {(['1x1', '2x2', '3col'] as GridMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setGridMode(gridMode === m ? null : m)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                    effectiveGrid === m
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {camLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : cameras.length === 0 ? (
          <EmptyState
            icon={VideoOff}
            title="Nav konfigurētu kameru"
            description="Kameras tiek pievienotas caur Ezviz Open Platform. Sazinieties ar sistēmas administratoru, lai konfigurētu kameras šim laukumam."
          />
        ) : (
          <div className={cn('grid gap-4', gridClass)}>
            {cameras.map((cam) => (
              <CameraTile
                key={cam.id}
                camera={cam}
                viewerToken={viewerTokens[cam.id] ?? null}
                loading={tokenLoading[cam.id] ?? false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Live event log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Notikumi šodien
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadArrivals}
              disabled={arrLoading}
              className="h-7 text-xs gap-1.5"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', arrLoading && 'animate-spin')} />
              Atjaunot
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {arrLoading && !arrivals ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState icon={Clock} title="Nav notikumu šodienai" />
          ) : (
            <div className="divide-y divide-border">
              {events.map((pass) => {
                const weighedTonnes = pass.weighingSlips.reduce((s, w) => s + w.netTonnes, 0);
                const isActive = pass.status === 'ACTIVE';
                return (
                  <div
                    key={pass.id}
                    className="flex items-center gap-3 px-1 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground w-11 shrink-0 tabular-nums">
                      {new Date(pass.validFrom).toLocaleTimeString('lv-LV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="font-mono text-xs font-medium text-foreground w-28 shrink-0 truncate">
                      {pass.passNumber}
                    </span>
                    <span className="text-xs font-semibold w-20 shrink-0">{pass.vehiclePlate}</span>
                    <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">
                      {pass.company.name}
                      {weighedTonnes > 0 && (
                        <span className="ml-2 text-emerald-600 font-medium">
                          {weighedTonnes.toFixed(1)} t
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-md shrink-0',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isActive ? 'Aktīvs' : pass.status === 'EXPIRED' ? 'Beidzies' : 'Atsaukts'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  field,
  token,
  onSaved,
}: {
  field: ApiB3Field;
  token: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: field.name,
    address: field.address,
    city: field.city,
    postalCode: field.postalCode,
    lat: String(field.lat),
    lng: String(field.lng),
    services: field.services,
    active: field.active,
    notes: field.notes ?? '',
    openingHours: field.openingHours as Record<string, { open: string; close: string } | null>,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // ── Google Maps / Places ──────────────────────────────────────────────────
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { isLoaded: mapsLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY,
    libraries: MAPS_LIBRARIES,
  });

  const onAutocompleteLoad = (ac: google.maps.places.Autocomplete) => {
    autocompleteRef.current = ac;
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const comps = place.address_components ?? [];
    const get = (t: string) => comps.find((c) => c.types.includes(t))?.long_name ?? '';
    const getShort = (t: string) => comps.find((c) => c.types.includes(t))?.short_name ?? '';
    const streetNum = get('street_number');
    const route = get('route');
    const addressStr =
      [route, streetNum].filter(Boolean).join(' ') || place.formatted_address || '';
    const city =
      get('locality') ||
      get('postal_town') ||
      get('administrative_area_level_2') ||
      get('administrative_area_level_1');
    const postalCode = getShort('postal_code');
    setForm((p) => ({
      ...p,
      address: addressStr || p.address,
      city: city || p.city,
      postalCode: postalCode || p.postalCode,
      lat: String(lat),
      lng: String(lng),
    }));
  };

  const mapCenter = useMemo(() => {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  }, [form.lat, form.lng]);

  const toggleService = (svc: B3FieldService) => {
    setForm((p) => ({
      ...p,
      services: p.services.includes(svc)
        ? p.services.filter((s) => s !== svc)
        : [...p.services, svc],
    }));
  };

  const toggleDay = (day: (typeof DAYS)[number]) => {
    setForm((p) => ({
      ...p,
      openingHours: {
        ...p.openingHours,
        [day]: p.openingHours[day] ? null : { open: '07:00', close: '19:00' },
      },
    }));
  };

  const setHour = (day: (typeof DAYS)[number], key: 'open' | 'close', val: string) => {
    setForm((p) => ({
      ...p,
      openingHours: {
        ...p.openingHours,
        [day]: { ...(p.openingHours[day] as { open: string; close: string }), [key]: val },
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateB3Field(token, field.id, {
        name: form.name,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        services: form.services,
        active: form.active,
        notes: form.notes || undefined,
        openingHours: form.openingHours,
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Pamata informācija</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nosaukums</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pilsēta</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Adrese</Label>
            {mapsLoaded ? (
              <Autocomplete
                onLoad={onAutocompleteLoad}
                onPlaceChanged={onPlaceChanged}
                restrictions={{ country: 'lv' }}
                fields={['address_components', 'geometry', 'formatted_address']}
              >
                <Input
                  placeholder="Sāc rakstīt adresi..."
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </Autocomplete>
            ) : (
              <Input
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Pasta indekss</Label>
            <Input
              value={form.postalCode}
              onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
            />
          </div>
          {/* Map pin preview */}
          {mapsLoaded && mapCenter && (
            <div className="rounded-xl overflow-hidden border border-border h-44">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={15}
                options={{
                  disableDefaultUI: true,
                  gestureHandling: 'none',
                  clickableIcons: false,
                }}
              >
                <MarkerF position={mapCenter} />
              </GoogleMap>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Iekšējas piezīmes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border px-4 py-3">
            <Label>Punkts aktīvs</Label>
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Pakalpojumi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(
            Object.entries(SERVICE_META) as [
              B3FieldService,
              { label: string; icon: React.ElementType },
            ][]
          ).map(([svc, meta]) => {
            const Icon = meta.icon;
            const active = form.services.includes(svc);
            return (
              <button
                key={svc}
                onClick={() => toggleService(svc)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  active
                    ? 'border-foreground bg-foreground/5'
                    : 'border-border hover:border-foreground/30',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {meta.label}
                </span>
                {active && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />}
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Darba laiki</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DAYS.map((day) => {
            const hours = form.openingHours[day];
            return (
              <div key={day} className="flex items-center gap-3">
                <button
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-bold shrink-0 border transition-colors',
                    hours
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border',
                  )}
                >
                  {DAY_LABELS[day]}
                </button>
                {hours ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="time"
                      value={hours.open}
                      onChange={(e) => setHour(day, 'open', e.target.value)}
                      className="h-8 text-sm w-28"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input
                      type="time"
                      value={hours.close}
                      onChange={(e) => setHour(day, 'close', e.target.value)}
                      className="h-8 text-sm w-28"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Slēgts</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button className="w-full" onClick={save} disabled={saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <>
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Saglabāts
          </>
        ) : (
          'Saglabāt izmaiņas'
        )}
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminB3FieldDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token: rawToken, user, isLoading } = useAuth();
  const token = rawToken ?? '';

  const [field, setField] = useState<ApiB3Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('inventory');

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) router.push('/dashboard');
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setField(await getB3Field(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!field) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/b3-fields">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={field.name}
          description={`${field.address}, ${field.city}`}
          action={
            <div className="flex items-center gap-2">
              {field.active ? (
                <Badge variant="outline" className="border-emerald-500/50 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Aktīvs
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Neaktīvs
                </Badge>
              )}
              {field.services.map((svc) => {
                const meta = SERVICE_META[svc];
                const Icon = meta.icon;
                return (
                  <Badge key={svc} variant="outline" className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {meta.label}
                  </Badge>
                );
              })}
            </div>
          }
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'inventory' && <InventoryTab fieldId={field.id} token={token} />}
        {tab === 'slots' && <SlotsTab fieldId={field.id} token={token} />}
        {tab === 'gate' && <GateTab fieldId={field.id} token={token} />}
        {tab === 'cameras' && <CamerasTab fieldId={field.id} token={token} />}
        {tab === 'settings' && <SettingsTab field={field} token={token} onSaved={load} />}
      </div>
    </div>
  );
}
