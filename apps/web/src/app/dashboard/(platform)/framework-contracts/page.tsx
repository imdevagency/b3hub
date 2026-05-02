/**
 * Framework contracts (Projekti) page — /dashboard/framework-contracts
 * Long-term supply contracts with call-off tracking.
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, RefreshCw, Layers, Calendar, Package, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fmtDate } from '@/lib/format';
import {
  getFrameworkContracts,
  createFrameworkContract,
  activateFrameworkContract,
  getMaterials,
  type ApiFrameworkContract,
  type ApiMaterial,
  type FrameworkContractStatus,
  type FrameworkPositionType,
} from '@/lib/api';
import { AddressAutocomplete, type PlaceAddress } from '@/components/ui/AddressAutocomplete';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  FrameworkContractStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  DRAFT: { label: 'Melnraksts', variant: 'outline' },
  ACTIVE: { label: 'Aktīvs', variant: 'default' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  EXPIRED: { label: 'Beidzies', variant: 'outline' },
  CANCELLED: { label: 'Atcelts', variant: 'destructive' },
};

const POS_TYPE_OPTIONS: { value: FrameworkPositionType; label: string }[] = [
  { value: 'MATERIAL_DELIVERY', label: 'Materiālu piegāde' },
  { value: 'WASTE_DISPOSAL', label: 'Atkritumu izvešana' },
  { value: 'FREIGHT_TRANSPORT', label: 'Kravas transports' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ContractCard({
  contract,
  onActivate,
}: {
  contract: ApiFrameworkContract;
  onActivate?: (id: string) => void;
}) {
  const meta = STATUS_META[contract.status];
  const pct = contract.totalProgressPct ?? 0;
  const isDraft = contract.status === 'DRAFT';
  return (
    <div className="relative">
      <Link href={`/dashboard/framework-contracts/${contract.id}`}>
        <Card
          className={`group cursor-pointer relative overflow-hidden rounded-2xl transition-all ring-1 shadow-sm border-0 h-full ${
            isDraft
              ? 'bg-amber-50/60 hover:bg-amber-50 ring-amber-200 hover:ring-amber-300'
              : 'bg-white hover:bg-slate-50/50 ring-black/5 hover:ring-black/10'
          } hover:shadow-md`}
        >
          <CardContent className="p-5 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    {contract.contractNumber}
                  </p>
                  <p className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {contract.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={meta.variant}
                    className="text-[10px] h-5 rounded-full px-2.5 font-medium"
                  >
                    {meta.label}
                  </Badge>
                </div>
              </div>

              {isDraft ? (
                <p className="text-xs text-amber-700 bg-amber-100/70 rounded-lg px-3 py-2 mb-4">
                  Projekts gaida aktivizāciju, lai varētu veikt pasūtījumus.
                </p>
              ) : (
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Izpilde</span>
                    <span className="font-semibold text-foreground">{pct.toFixed(0)}%</span>
                  </div>
                  <ProgressBar pct={pct} />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>
                      {contract.totalConsumedQty.toFixed(1)} / {contract.totalAgreedQty.toFixed(1)}
                    </span>
                    <span className="font-medium">{contract.totalCallOffs} pasūtījumi</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-slate-50/80 -mx-5 -mb-5 px-5 py-3 mt-4 border-t border-black/5">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 opacity-70" />
                {fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 opacity-70" />
                {contract.positions.length} pozīcijas
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
      {isDraft && onActivate && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onActivate(contract.id);
          }}
          className="absolute bottom-13 right-3 z-10 flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full shadow-md hover:bg-primary/90 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Aktivizēt
        </button>
      )}
    </div>
  );
}

// ─── Create dialog ────────────────────────────────────────────────────────────

interface NewPosition {
  positionType: FrameworkPositionType;
  materialName: string;
  materialId?: string;
  supplierId?: string;
  unit: string;
  agreedQty: string;
  unitPrice: string;
  pickupAddress: string;
  deliveryAddress: string;
}

const emptyPosition = (): NewPosition => ({
  positionType: 'MATERIAL_DELIVERY',
  materialName: '',
  unit: 't',
  agreedQty: '',
  unitPrice: '',
  pickupAddress: '',
  deliveryAddress: '',
});

// ─── Material catalog search combobox ──────────────────────────────────────────────

function MaterialSearchInput({
  token,
  value,
  onChange,
  onMaterialSelect,
}: {
  token: string;
  value: string;
  onChange: (name: string) => void;
  onMaterialSelect: (m: ApiMaterial | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [results, setResults] = useState<ApiMaterial[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (value.length < 2) {
        setResults([]);
        return;
      }
      setFetching(true);
      getMaterials(token, { search: value })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setFetching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [value, token]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Input
          placeholder="Materiāls (meklēt katalogā vai rakstīt)"
          className="bg-background border-none shadow-sm h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-[15px] pr-8"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onMaterialSelect(null);
            setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
        />
        {fetching && (
          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground pointer-events-none" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-9999 top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto">
          {results.slice(0, 8).map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(m.name);
                onMaterialSelect(m);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 flex items-center justify-between gap-3 border-b border-gray-50 last:border-0 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.supplier.name}</p>
              </div>
              <span className="text-xs font-bold shrink-0 text-muted-foreground">
                €{m.basePrice.toFixed(2)}/{m.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateContractDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    startDate: string;
    endDate: string;
    notes: string;
    positions: NewPosition[];
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [positions, setPositions] = useState<NewPosition[]>([emptyPosition()]);
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    // Validate each position has a qty >= 0.01
    for (let i = 0; i < positions.length; i++) {
      const qty = parseFloat(positions[i].agreedQty);
      if (!positions[i].agreedQty.trim() || isNaN(qty) || qty < 0.01) {
        setFormError(`Pozīcijai ${i + 1} ir jānorāda daudzums (min 0.01)`);
        return;
      }
    }
    setFormError(null);
    setSaving(true);
    try {
      await onCreate({ title, startDate, endDate, notes, positions });
      setTitle('');
      setStartDate('');
      setEndDate('');
      setNotes('');
      setPositions([emptyPosition()]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const updatePos = (i: number, field: keyof NewPosition, value: string) => {
    setPositions((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const mergePos = (i: number, fields: Partial<NewPosition>) => {
    setPositions((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...fields } : p)));
  };

  const inputClasses =
    'mt-1.5 bg-muted/40 border-0 shadow-none h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-[15px] transition-colors';

  return (
    <Sheet open={open} onOpenChange={(o) => (!o && !saving ? onClose() : null)}>
      <SheetContent className="sm:max-w-xl w-full overflow-hidden p-0 flex flex-col border-l shadow-2xl">
        <div className="px-6 pt-8 pb-4">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold tracking-tight">Jauns Projekts</SheetTitle>
            <p className="text-[15px] text-muted-foreground leading-relaxed pt-1">
              Projekts tiks izveidots kā melnraksts. Aktivizējiet to, kad esat gatavs veikt
              pasūtījumus.
            </p>
          </SheetHeader>
        </div>

        <div className="flex-1 px-6 space-y-8 overflow-y-auto pb-32">
          {/* Main Info */}
          <div className="space-y-5">
            <div>
              <Label className="text-sm font-medium ml-1">Nosaukums *</Label>
              <Input
                className={inputClasses}
                placeholder="Projekta nosaukums"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium ml-1">Sākuma datums</Label>
                <Input
                  type="date"
                  className={inputClasses}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">Beigu datums</Label>
                <Input
                  type="date"
                  className={inputClasses}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium ml-1">Piezīmes</Label>
              <Textarea
                className="mt-1.5 bg-muted/40 border-0 shadow-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 p-4 text-[15px] min-h-25 resize-none transition-colors"
                placeholder="Papildu informācija..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Positions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-bold">Pozīcijas</Label>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-full bg-muted/60 hover:bg-muted font-semibold h-9 px-4 text-xs"
                onClick={() => setPositions((p) => [...p, emptyPosition()])}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Pievienot
              </Button>
            </div>

            <div className="space-y-4">
              {positions.map((pos, i) => (
                <div
                  key={i}
                  className="bg-muted/20 border-none rounded-2xl p-5 space-y-4 relative group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider">
                      Pozīcija {i + 1}
                    </span>
                    {positions.length > 1 && (
                      <button
                        className="text-[13px] font-medium text-destructive hover:opacity-80 transition-opacity"
                        onClick={() => setPositions((p) => p.filter((_, idx) => idx !== i))}
                      >
                        Dzēst
                      </button>
                    )}
                  </div>

                  <Select
                    value={pos.positionType}
                    onValueChange={(v) => updatePos(i, 'positionType', v as FrameworkPositionType)}
                  >
                    <SelectTrigger className="bg-background border-none shadow-sm h-12 rounded-xl focus:ring-1 focus:ring-primary/30 text-[15px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-lg">
                      {POS_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="rounded-lg">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Material — catalog search for MATERIAL_DELIVERY, free text for others */}
                  {pos.positionType === 'MATERIAL_DELIVERY' ? (
                    <MaterialSearchInput
                      token={token ?? ''}
                      value={pos.materialName}
                      onChange={(name) =>
                        mergePos(i, {
                          materialName: name,
                          materialId: undefined,
                          supplierId: undefined,
                        })
                      }
                      onMaterialSelect={(m) => {
                        if (m)
                          mergePos(i, {
                            materialName: m.name,
                            materialId: m.id,
                            supplierId: m.supplierId,
                            unit: m.unit,
                            unitPrice: String(m.basePrice),
                          });
                      }}
                    />
                  ) : (
                    <Input
                      placeholder={
                        pos.positionType === 'WASTE_DISPOSAL'
                          ? 'Atkritumu veids'
                          : 'Kravas apraksts'
                      }
                      className="bg-background border-none shadow-sm h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-[15px]"
                      value={pos.materialName}
                      onChange={(e) => updatePos(i, 'materialName', e.target.value)}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Input
                        placeholder="Vienība (t, m³)"
                        className="bg-background border-none shadow-sm h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-[15px]"
                        value={pos.unit}
                        onChange={(e) => updatePos(i, 'unit', e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        placeholder="Daudzums"
                        min="0.01"
                        step="0.01"
                        className="bg-background border-none shadow-sm h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-[15px]"
                        value={pos.agreedQty}
                        onChange={(e) => {
                          updatePos(i, 'agreedQty', e.target.value);
                          setFormError(null);
                        }}
                      />
                    </div>
                    <div>
                      <Input
                        type="number"
                        placeholder="Cena/vienību (€)"
                        min="0"
                        step="0.01"
                        className="bg-background border-none shadow-sm h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-[15px] font-medium"
                        value={pos.unitPrice}
                        onChange={(e) => updatePos(i, 'unitPrice', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <AddressAutocomplete
                      value={pos.pickupAddress}
                      onChange={(v) => updatePos(i, 'pickupAddress', v)}
                      onSelect={(place: PlaceAddress) =>
                        updatePos(i, 'pickupAddress', place.address)
                      }
                      placeholder="No (iekraušanas adrese)"
                      className="bg-background border border-border/30 h-12 rounded-xl text-[15px]"
                    />
                    <AddressAutocomplete
                      value={pos.deliveryAddress}
                      onChange={(v) => updatePos(i, 'deliveryAddress', v)}
                      onSelect={(place: PlaceAddress) =>
                        updatePos(i, 'deliveryAddress', place.address)
                      }
                      placeholder="Uz (piegādes adrese)"
                      className="bg-background border border-border/30 h-12 rounded-xl text-[15px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fixed Footer with Uber-like button */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-background/90 backdrop-blur-xl border-t border-border/50 space-y-2">
          {formError && (
            <p className="text-sm text-destructive font-medium text-center">{formError}</p>
          )}
          <Button
            className="w-full h-14 rounded-2xl text-[16px] font-semibold bg-foreground hover:bg-foreground/90 text-background shadow-lg transition-all"
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
          >
            {saving ? 'Saglabā...' : 'Izveidot melnrakstu'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function FrameworkContractsPage() {
  const { token } = useAuth();
  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getFrameworkContracts(token);
      setContracts(data);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate = !!token;

  const handleActivate = async (id: string) => {
    if (!token || activating) return;
    setActivating(id);
    try {
      const updated = await activateFrameworkContract(id, token);
      setContracts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } finally {
      setActivating(null);
    }
  };

  const handleCreate = async (form: {
    title: string;
    startDate: string;
    endDate: string;
    notes: string;
    positions: NewPosition[];
  }) => {
    if (!token) return;
    const created = await createFrameworkContract(
      {
        title: form.title,
        startDate: form.startDate || new Date().toISOString(),
        endDate: form.endDate || undefined,
        notes: form.notes || undefined,
        positions: form.positions.map((p) => ({
          positionType: p.positionType,
          materialName: p.materialName,
          unit: p.unit,
          agreedQty: parseFloat(p.agreedQty),
          unitPrice: parseFloat(p.unitPrice) || 0,
          pickupAddress: p.pickupAddress || undefined,
          deliveryAddress: p.deliveryAddress || undefined,
        })),
      },
      token,
    );
    setContracts((prev) => [created, ...prev]);
  };

  const drafts = contracts.filter((c) => c.status === 'DRAFT');
  const active = contracts.filter((c) => c.status === 'ACTIVE');
  const rest = contracts.filter((c) => c.status !== 'ACTIVE' && c.status !== 'DRAFT');

  return (
    <div className="w-full h-full pb-20 space-y-8">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 mb-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projekti</h1>
          <p className="text-muted-foreground mt-1">
            Bloku līgumi ar fiksētiem apjomiem — pasūtiet daļās, kad nepieciešāms
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-0 sm:mr-1.5" />
            <span className="hidden sm:inline">Atjaunot</span>
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns projekts
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nav projektu"
          description="Izveidojiet pirmo projektu līgumu, lai pārvaldītu apjoma pasūtijumus par fiksētu cenu"
          action={
            canCreate ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Jauns projekts
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {drafts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-4">
                Melnraksti — gaida aktivizāciju
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {drafts.map((c) => (
                  <ContractCard
                    key={c.id}
                    contract={c}
                    onActivate={canCreate ? handleActivate : undefined}
                  />
                ))}
              </div>
            </section>
          )}
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Aktīvie
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {active.map((c) => (
                  <ContractCard key={c.id} contract={c} />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Citi
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rest.map((c) => (
                  <ContractCard key={c.id} contract={c} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <CreateContractDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
