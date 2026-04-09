/**
 * Fleet Management page — /dashboard/fleet-management
 * Tabbed: Transportlīdzekļi (canTransport) + Konteineri (canSkipHire)
 * Replaces /dashboard/garage and /dashboard/containers/fleet.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Car,
  ChevronDown,
  Check,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
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
import {
  type ApiContainer,
  type ContainerType,
  type ContainerSize,
  type CreateContainerInput,
  getMyFleetContainers,
  createContainer,
  updateContainer,
  deleteContainer,
} from '@/lib/api/containers';

type Tab = 'vehicles' | 'containers';

// ── Vehicle constants ─────────────────────────────────────────────────────────

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Vilcējs ar puspiekabi',
  HOOK_LIFT: 'Āķa pacēlājs',
  SKIP_LOADER: 'Konteinerauto',
  TANKER: 'Cisternas auto',
  VAN: 'Furgons',
};

const VEHICLE_STATUS_CONFIG: Record<VehicleStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Aktīvs', className: 'bg-green-100 text-green-700 border-green-200' },
  IN_USE: { label: 'Darbā', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  MAINTENANCE: { label: 'Apkope', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  INACTIVE: { label: 'Neaktīvs', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const DRIVE_TYPES = ['2WD', '4WD', 'AWD'] as const;

const EMPTY_VEHICLE_FORM: CreateVehicleInput = {
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

// ── Container constants ───────────────────────────────────────────────────────

const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
  { value: 'SKIP', label: 'Skip' },
  { value: 'ROLL_OFF', label: 'Roll-Off' },
  { value: 'COMPACTOR', label: 'Kompaktors' },
  { value: 'HOOKLOADER', label: 'Āķkrāvējs' },
  { value: 'FLATBED', label: 'Platforma' },
];

const CONTAINER_SIZES: { value: ContainerSize; label: string }[] = [
  { value: 'SMALL', label: 'Mazs' },
  { value: 'MEDIUM', label: 'Vidējs' },
  { value: 'LARGE', label: 'Liels' },
  { value: 'EXTRA_LARGE', label: 'Ļoti liels' },
];

// ── Vehicle sub-components ────────────────────────────────────────────────────

function VehicleRow({
  vehicle: v,
  isReadOnly,
  onEdit,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  vehicle: Vehicle;
  isReadOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const status = VEHICLE_STATUS_CONFIG[v.status];
  return (
    <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_8rem] gap-4 items-center border-b last:border-0 px-5 py-4 hover:bg-muted/30 transition-colors">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
        <Truck className="h-4 w-4 text-muted-foreground" />
      </div>
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
      <div>
        <span className="inline-flex items-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-sm font-semibold tracking-wider">
          {v.licensePlate}
        </span>
      </div>
      <div className="text-sm">
        <span className="font-semibold">{(v.capacity * 1000).toLocaleString('lv-LV')}</span>
        <span className="ml-1 text-muted-foreground text-xs">kg</span>
      </div>
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
      <div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        {isReadOnly ? null : confirmingDelete ? (
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

function VehicleEmptyState({ hasVehicles, onAdd }: { hasVehicles: boolean; onAdd?: () => void }) {
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
      {!hasVehicles && onAdd && (
        <Button className="mt-6 gap-2" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Pievienot pirmo transportlīdzekli
        </Button>
      )}
    </div>
  );
}

// ── Vehicles tab ──────────────────────────────────────────────────────────────

function VehiclesTab({ token, isReadOnly }: { token: string; isReadOnly: boolean }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<VehicleType | ''>('');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateVehicleInput>(EMPTY_VEHICLE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
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

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_VEHICLE_FORM);
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
    try {
      await deleteVehicle(id, token);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch {
      /* silent */
    } finally {
      setDeleteConfirm(null);
    }
  };

  const inputClasses =
    'bg-muted/40 border-0 shadow-none h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-[15px] transition-colors mt-1.5 focus:ring-1 focus:ring-primary/30';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
          {!isReadOnly && (
            <Button size="sm" onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Pievienot Transportu
            </Button>
          )}
        </div>
      </div>

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <VehicleEmptyState
          hasVehicles={vehicles.length > 0}
          onAdd={isReadOnly ? undefined : openAdd}
        />
      ) : (
        <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_8rem] gap-4 border-b bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div />
            <div>Transportlīdzeklis</div>
            <div>Valsts numurzīme</div>
            <div>Kravnesība</div>
            <div>Maks. pilnmasa</div>
            <div>Statuss</div>
            <div />
          </div>
          {filtered.map((v) => (
            <VehicleRow
              key={v.id}
              vehicle={v}
              isReadOnly={isReadOnly}
              onEdit={() => openEdit(v)}
              onDelete={() => setDeleteConfirm(v.id)}
              confirmingDelete={deleteConfirm === v.id}
              onConfirmDelete={() => handleDelete(v.id)}
              onCancelDelete={() => setDeleteConfirm(null)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(o) => (!o && !saving ? setSheetOpen(false) : null)}>
        <SheetContent className="sm:max-w-xl w-full overflow-hidden p-0 flex flex-col border-l shadow-2xl">
          <div className="px-6 pt-8 pb-4">
            <SheetHeader>
              <SheetTitle className="text-2xl font-bold tracking-tight">
                {editingId ? 'Rediģēt transportlīdzekli' : 'Pievienot transportlīdzekli'}
              </SheetTitle>
              <p className="text-[15px] text-muted-foreground leading-relaxed pt-1">
                Aizpildiet informāciju par transportlīdzekli, lai to varētu izmantot pasūtījumu
                izpildē.
              </p>
            </SheetHeader>
          </div>
          <div className="flex-1 px-6 space-y-6 overflow-y-auto pb-32">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium ml-1">Transportlīdzekļa veids *</Label>
                <select
                  className={`w-full ${inputClasses}`}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium ml-1">Marka *</Label>
                  <Input
                    placeholder="MAN, Volvo, DAF..."
                    value={form.make}
                    onChange={(e) => patch('make', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium ml-1">Modelis *</Label>
                  <Input
                    placeholder="TGX 18.500, FH16..."
                    value={form.model}
                    onChange={(e) => patch('model', e.target.value)}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium ml-1">Izlaiduma gads *</Label>
                  <Input
                    type="number"
                    min={1950}
                    max={2100}
                    value={form.year}
                    onChange={(e) => patch('year', Number(e.target.value))}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium ml-1">Valsts numurzīme *</Label>
                  <Input
                    placeholder="LV-1234"
                    value={form.licensePlate}
                    onChange={(e) => patch('licensePlate', e.target.value.toUpperCase())}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">
                  VIN numurs <span className="text-muted-foreground text-xs">(neobligāts)</span>
                </Label>
                <Input
                  placeholder="WDB9634031L123456"
                  value={form.vin ?? ''}
                  onChange={(e) => patch('vin', e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium ml-1">Kravnesība (t) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="18.0"
                    value={form.capacity || ''}
                    onChange={(e) => patch('capacity', e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium ml-1">Maks. pilnmasa (t)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="40.0"
                    value={form.maxGrossWeight ?? ''}
                    onChange={(e) => patch('maxGrossWeight', e.target.value || undefined)}
                    className={inputClasses}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium ml-1">Tilpums (m³)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="22.0"
                    value={form.volumeCapacity ?? ''}
                    onChange={(e) => patch('volumeCapacity', e.target.value || undefined)}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium ml-1">Piedziņa</Label>
                  <select
                    className={`w-full ${inputClasses}`}
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
              <div>
                <Label className="text-sm font-medium ml-1">Statuss</Label>
                <select
                  className={`w-full ${inputClasses}`}
                  value={form.status ?? 'ACTIVE'}
                  onChange={(e) => patch('status', e.target.value as VehicleStatus)}
                >
                  {(
                    Object.entries(VEHICLE_STATUS_CONFIG) as [VehicleStatus, { label: string }][]
                  ).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-background/90 backdrop-blur-xl border-t border-border/50">
            <Button
              className="w-full h-14 rounded-2xl text-[16px] font-semibold bg-foreground hover:bg-foreground/90 text-background shadow-lg transition-all"
              onClick={handleSave}
              disabled={saving || !form.make || !form.model || !form.licensePlate || !form.capacity}
            >
              {saving ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
              {saving
                ? 'Saglabā...'
                : editingId
                  ? 'Saglabāt izmaiņas'
                  : 'Pievienot transportlīdzekli'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Add Container Modal ───────────────────────────────────────────────────────

interface AddContainerModalProps {
  token: string;
  onClose: () => void;
  onSaved: () => void;
  editing?: ApiContainer | null;
}

function AddContainerModal({ token, onClose, onSaved, editing }: AddContainerModalProps) {
  const [form, setForm] = useState<Partial<CreateContainerInput>>({
    containerType: editing?.containerType ?? 'SKIP',
    size: editing?.size ?? 'SMALL',
    volume: editing?.volume ?? undefined,
    maxWeight: editing?.maxWeight ?? undefined,
    rentalPrice: editing?.rentalPrice ?? undefined,
    deliveryFee: editing?.deliveryFee ?? 0,
    pickupFee: editing?.pickupFee ?? 0,
    location: editing?.location ?? '',
    currency: editing?.currency ?? 'EUR',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CreateContainerInput, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const { containerType, size, volume, maxWeight, rentalPrice, deliveryFee, pickupFee } = form;
    if (
      !containerType ||
      !size ||
      !volume ||
      !maxWeight ||
      rentalPrice == null ||
      deliveryFee == null ||
      pickupFee == null
    )
      return;
    setSaving(true);
    try {
      if (editing) {
        await updateContainer(token, editing.id, form as Partial<CreateContainerInput>);
      } else {
        await createContainer(token, form as CreateContainerInput);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Rediģēt konteineru' : 'Pievienot konteineru'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Tips *</Label>
            <select
              className="w-full h-9 rounded-md border text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={form.containerType}
              onChange={(e) => set('containerType', e.target.value as ContainerType)}
            >
              {CONTAINER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Izmērs *</Label>
            <select
              className="w-full h-9 rounded-md border text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={form.size}
              onChange={(e) => set('size', e.target.value as ContainerSize)}
            >
              {CONTAINER_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tilpums (m³) *</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="6.0"
              className="h-9 text-sm"
              value={form.volume ?? ''}
              onChange={(e) => set('volume', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Maks. svars (t) *</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="5.0"
              className="h-9 text-sm"
              value={form.maxWeight ?? ''}
              onChange={(e) => set('maxWeight', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Nomas cena / dienā (€) *
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="25.00"
              className="h-9 text-sm"
              value={form.rentalPrice ?? ''}
              onChange={(e) => set('rentalPrice', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Piegādes maksa (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="h-9 text-sm"
              value={form.deliveryFee ?? ''}
              onChange={(e) => set('deliveryFee', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Savākšanas maksa (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="h-9 text-sm"
              value={form.pickupFee ?? ''}
              onChange={(e) => set('pickupFee', parseFloat(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Atrašanās vieta</Label>
            <Input
              placeholder="Rīga"
              className="h-9 text-sm"
              value={form.location ?? ''}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Atcelt
          </Button>
          <Button
            size="sm"
            disabled={saving || !form.containerType || !form.volume || form.rentalPrice == null}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            {saving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {editing ? 'Saglabāt' : 'Pievienot'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Containers tab ────────────────────────────────────────────────────────────

function ContainersTab({ token }: { token: string }) {
  const [containers, setContainers] = useState<ApiContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingContainer, setEditingContainer] = useState<ApiContainer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContainers(await getMyFleetContainers(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    setPendingDeleteId(null);
    setDeletingId(id);
    try {
      await deleteContainer(token, id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const containerTypeLabel = (t: ContainerType) =>
    CONTAINER_TYPES.find((x) => x.value === t)?.label ?? t;
  const containerSizeLabel = (s: ContainerSize) =>
    CONTAINER_SIZES.find((x) => x.value === s)?.label ?? s;

  const statusColor: Record<string, string> = {
    AVAILABLE: 'bg-green-50 text-green-700 border-green-200',
    RENTED: 'bg-blue-50 text-blue-700 border-blue-200',
    MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-200',
    RETIRED: 'bg-gray-100 text-gray-400 border-gray-200',
  };
  const statusLabel: Record<string, string> = {
    AVAILABLE: 'Pieejams',
    RENTED: 'Iznomāts',
    MAINTENANCE: 'Remonts',
    RETIRED: 'Izslēgts',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{containers.length} konteineri flotē</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" />
          Pievienot konteineru
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : containers.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Flotē nav konteineru.</p>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            Pievienot pirmo konteineru
          </Button>
        </div>
      ) : (
        <div className="border rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-left">Tips / izmērs</th>
                <th className="px-5 py-3 text-left">Tilpums</th>
                <th className="px-5 py-3 text-left">Noma / dienā</th>
                <th className="px-5 py-3 text-left">Atrašanās</th>
                <th className="px-5 py-3 text-left">Statuss</th>
                <th className="px-5 py-3 text-right">Darbības</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-900">
                      {containerTypeLabel(c.containerType)}
                    </span>
                    <span className="text-muted-foreground"> · {containerSizeLabel(c.size)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.volume} m³</td>
                  <td className="px-5 py-3.5 font-semibold">€ {c.rentalPrice.toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.location || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${
                        statusColor[c.status] ?? 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {statusLabel[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {pendingDeleteId === c.id ? (
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <span className="text-muted-foreground">Dzēst?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                        >
                          Jā
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => setPendingDeleteId(null)}
                        >
                          Atpakaļ
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingContainer(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-red-50"
                          disabled={deletingId === c.id}
                          onClick={() => setPendingDeleteId(c.id)}
                        >
                          {deletingId === c.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(showAdd || editingContainer) && (
        <AddContainerModal
          token={token}
          editing={editingContainer}
          onClose={() => {
            setShowAdd(false);
            setEditingContainer(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditingContainer(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FleetManagementPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('vehicles');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    else if (!isLoading && user && !user.canTransport && !user.canSkipHire)
      router.push('/dashboard');
    else if (!isLoading && user && !user.canTransport && user.canSkipHire)
      queueMicrotask(() => setTab('containers'));
  }, [user, isLoading, router]);

  const isReadOnly = Boolean(
    user?.isCompany && (user.companyRole === 'DRIVER' || user.companyRole === 'MEMBER'),
  );

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showVehicles = Boolean(user?.canTransport);
  const showContainers = Boolean(user?.canSkipHire);

  const tabs: { key: Tab; label: string }[] = [
    ...(showVehicles ? [{ key: 'vehicles' as Tab, label: 'Transportlīdzekļi' }] : []),
    ...(showContainers ? [{ key: 'containers' as Tab, label: 'Konteineri' }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flotes Pārvaldība"
        description="Pārvaldiet savus transportlīdzekļus un konteinerus"
      />

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px ${
                tab === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'vehicles' && showVehicles && <VehiclesTab token={token} isReadOnly={isReadOnly} />}
      {tab === 'containers' && showContainers && <ContainersTab token={token} />}
    </div>
  );
}
