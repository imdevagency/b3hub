/**
 * Garage / containers page — /dashboard/garage
 * Manage physical container inventory (skips, bins) owned by the carrier.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Car, ChevronDown, Pencil, Plus, RefreshCw, Search, Trash2, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';
import {
  getMyVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  type Vehicle,
  type VehicleType,
  type VehicleStatus,
  type CreateVehicleInput,
} from '@/lib/api';

// ── Constants ──────────────────────────────────────────────────

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Vilcējs ar puspiekabi',
  HOOK_LIFT: 'Āķa pacēlājs',
  SKIP_LOADER: 'Konteinerauto',
  TANKER: 'Cisternas auto',
  VAN: 'Furgons',
};

const STATUS_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Aktīvs', className: 'bg-green-100 text-green-700 border-green-200' },
  IN_USE: { label: 'Darbā', className: 'bg-blue-100  text-blue-700  border-blue-200' },
  MAINTENANCE: { label: 'Apkope', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  INACTIVE: { label: 'Neaktīvs', className: 'bg-gray-100  text-gray-500  border-gray-200' },
};

const DRIVE_TYPES = ['2WD', '4WD', 'AWD'] as const;

const EMPTY_FORM: CreateVehicleInput = {
  vehicleType: 'DUMP_TRUCK',
  make: '',
  model: '',
  year: new Date().getFullYear(),
  licensePlate: '',
  vin: '',
  capacity: 0,
  maxGrossWeight: undefined,
  volumeCapacity: undefined,
  driveType: '',
  status: 'ACTIVE',
};

// ── Component ──────────────────────────────────────────────────

export default function GaragePage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VehicleType | ''>('');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateVehicleInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getMyVehicles(token);
      setVehicles(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  // ── Filtering ──────────────────────────────────────────────

  const filtered = vehicles.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      v.make.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.licensePlate.toLowerCase().includes(q) ||
      VEHICLE_TYPE_LABELS[v.vehicleType].toLowerCase().includes(q);
    const matchesType = !typeFilter || v.vehicleType === typeFilter;
    return matchesSearch && matchesType;
  });

  // ── Form helpers ───────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setSheetOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm({
      vehicleType: v.vehicleType,
      make: v.make,
      model: v.model,
      year: v.year,
      licensePlate: v.licensePlate,
      vin: v.vin ?? '',
      capacity: v.capacity,
      maxGrossWeight: v.maxGrossWeight,
      volumeCapacity: v.volumeCapacity,
      driveType: v.driveType ?? '',
      status: v.status,
    });
    setError('');
    setSheetOpen(true);
  };

  const patch = (key: keyof CreateVehicleInput, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!token) return;
    setError('');
    setSaving(true);
    try {
      const payload: CreateVehicleInput = {
        ...form,
        capacity: Number(form.capacity),
        maxGrossWeight: form.maxGrossWeight ? Number(form.maxGrossWeight) : undefined,
        volumeCapacity: form.volumeCapacity ? Number(form.volumeCapacity) : undefined,
        year: Number(form.year),
        vin: form.vin || undefined,
        driveType: form.driveType || undefined,
      };

      if (editingId) {
        const updated = await updateVehicle(editingId, payload, token);
        setVehicles((prev) => prev.map((v) => (v.id === editingId ? updated : v)));
      } else {
        const created = await createVehicle(payload, token);
        setVehicles((prev) => [created, ...prev]);
      }
      setSheetOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Neizdevās saglabāt transportlīdzekli');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteVehicle(id, token);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch {
      /* silent */
    } finally {
      setDeleteConfirm(null);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────

  if (isLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <PageHeader
        title="Mans Autoparks"
        description={`${vehicles.length} transportlīdzekļ${vehicles.length === 1 ? 'is' : 'i'} reģistrēt${vehicles.length === 1 ? 's' : 'i'}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Pievienot Transportu
            </Button>
          </div>
        }
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-50 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Meklēt transportlīdzekļus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent transition-colors"
            onClick={() => setShowTypeMenu((x) => !x)}
          >
            {typeFilter ? VEHICLE_TYPE_LABELS[typeFilter] : 'Transportlīdzekļa veids'}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {showTypeMenu && (
            <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-md border bg-background shadow-lg">
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setTypeFilter('');
                  setShowTypeMenu(false);
                }}
              >
                Visi veidi
              </button>
              {(Object.entries(VEHICLE_TYPE_LABELS) as [VehicleType, string][]).map(([k, v]) => (
                <button
                  key={k}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setTypeFilter(k);
                    setShowTypeMenu(false);
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter chip */}
        {typeFilter && (
          <button
            className="flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 transition-colors"
            onClick={() => setTypeFilter('')}
          >
            {VEHICLE_TYPE_LABELS[typeFilter]}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState hasVehicles={vehicles.length > 0} onAdd={openAdd} />
      ) : (
        <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_8rem] gap-4 border-b bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div />
            <div>Transportlīdzeklis</div>
            <div>Valsts numurzīme</div>
            <div>Kravnesība</div>
            <div>Maks. pilnmasa</div>
            <div>Statuss</div>
            <div />
          </div>

          {/* Rows */}
          {filtered.map((v) => (
            <VehicleRow
              key={v.id}
              vehicle={v}
              onEdit={() => openEdit(v)}
              onDelete={() => setDeleteConfirm(v.id)}
              confirmingDelete={deleteConfirm === v.id}
              onConfirmDelete={() => handleDelete(v.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
            />
          ))}
        </div>
      )}

      {/* ── Add/Edit Sheet ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-red-600" />
              {editingId ? 'Rediģēt transportlīdzekli' : 'Pievienot jaunu transportlīdzekli'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-6 pb-6">
            {/* Vehicle type */}
            <div className="flex flex-col gap-1.5">
              <Label>Transportlīdzekļa veids *</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.vehicleType}
                onChange={(e) => patch('vehicleType', e.target.value as VehicleType)}
              >
                {(Object.entries(VEHICLE_TYPE_LABELS) as [VehicleType, string][]).map(
                  ([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {/* Make + Model */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Marka *</Label>
                <Input
                  placeholder="MAN, Volvo, DAF..."
                  value={form.make}
                  onChange={(e) => patch('make', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Modelis *</Label>
                <Input
                  placeholder="TGX 18.500, FH16..."
                  value={form.model}
                  onChange={(e) => patch('model', e.target.value)}
                />
              </div>
            </div>

            {/* Year + License plate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Izlaiduma gads *</Label>
                <Input
                  type="number"
                  min={1950}
                  max={2100}
                  value={form.year}
                  onChange={(e) => patch('year', Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valsts numurzīme *</Label>
                <Input
                  placeholder="LV-1234"
                  value={form.licensePlate}
                  onChange={(e) => patch('licensePlate', e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {/* VIN */}
            <div className="flex flex-col gap-1.5">
              <Label>
                VIN numurs <span className="text-muted-foreground text-xs">(neobligāts)</span>
              </Label>
              <Input
                placeholder="WDB9634031L123456"
                value={form.vin ?? ''}
                onChange={(e) => patch('vin', e.target.value)}
              />
            </div>

            {/* Capacity + Max gross weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Kravnesība (t) *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="18.0"
                  value={form.capacity || ''}
                  onChange={(e) => patch('capacity', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Maks. pilnmasa (t)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="40.0"
                  value={form.maxGrossWeight ?? ''}
                  onChange={(e) => patch('maxGrossWeight', e.target.value || undefined)}
                />
              </div>
            </div>

            {/* Volume capacity + Drive type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Tilpums (m³)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="22.0"
                  value={form.volumeCapacity ?? ''}
                  onChange={(e) => patch('volumeCapacity', e.target.value || undefined)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Piedziņa</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={form.driveType ?? ''}
                  onChange={(e) => patch('driveType', e.target.value || undefined)}
                >
                  <option value="">— Nav norādīts —</option>
                  {DRIVE_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <Label>Statuss</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                value={form.status ?? 'ACTIVE'}
                onChange={(e) => patch('status', e.target.value as VehicleStatus)}
              >
                {(Object.entries(STATUS_CONFIG) as [VehicleStatus, { label: string }][]).map(
                  ([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={
                  saving || !form.make || !form.model || !form.licensePlate || !form.capacity
                }
              >
                {saving
                  ? 'Saglabā...'
                  : editingId
                    ? 'Saglabāt izmaiņas'
                    : 'Pievienot transportlīdzekli'}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
                Atcelt
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function VehicleRow({
  vehicle: v,
  onEdit,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  vehicle: Vehicle;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const status = STATUS_CONFIG[v.status];

  return (
    <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_8rem] gap-4 items-center border-b last:border-0 px-5 py-4 hover:bg-muted/30 transition-colors">
      {/* Icon */}
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
        <Truck className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Vehicle type + make/model */}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {VEHICLE_TYPE_LABELS[v.vehicleType]}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {v.make} {v.model} · {v.year}
          {v.driveType && (
            <span className="ml-1 text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded">
              {v.driveType}
            </span>
          )}
        </p>
      </div>

      {/* License plate */}
      <div>
        <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-sm font-semibold tracking-wider">
          {v.licensePlate}
        </span>
      </div>

      {/* Load capacity */}
      <div className="text-sm">
        <span className="font-semibold">{(v.capacity * 1000).toLocaleString('lv-LV')}</span>
        <span className="ml-1 text-muted-foreground text-xs">kg</span>
      </div>

      {/* Max gross weight */}
      <div className="text-sm">
        {v.maxGrossWeight ? (
          <>
            <span className="font-semibold">
              {(v.maxGrossWeight * 1000).toLocaleString('lv-LV')}
            </span>
            <span className="ml-1 text-muted-foreground text-xs">kg</span>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>

      {/* Status */}
      <div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        {confirmingDelete ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              onClick={onConfirmDelete}
            >
              Dzēst
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={onCancelDelete}
            >
              Atcelt
            </Button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Rediģēt"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Dzēst"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasVehicles, onAdd }: { hasVehicles: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Car className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {hasVehicles ? 'Nav atbilstošu transportlīdzekļu' : 'Jūsu autoparks ir tukšs'}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasVehicles
          ? 'Mēģiniet mainīt meklēšanas vai filtrēšanas kritērijus.'
          : 'Pievienojiet savu pirmo transportlīdzekli, lai sāktu saņemt atbilstošus pasūtījumus.'}
      </p>
      {!hasVehicles && (
        <Button className="mt-6 gap-2" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Pievienot pirmo transportlīdzekli
        </Button>
      )}
    </div>
  );
}
