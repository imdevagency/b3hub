/**
 * Field Passes page — /dashboard/field-passes
 * TODO: B3 FIELDS — FUTURE FEATURE
 * Hidden from sidebar navigation until B3 Field physical locations are operational.
 * Re-enable sidebar link in app-sidebar.tsx (buyer-procurement section) when ready.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Download,
  Ticket,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Truck,
  CalendarCheck,
  Receipt,
  Hourglass,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
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
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDate } from '@/lib/format';
import {
  getFieldPasses,
  createFieldPass,
  getFrameworkContracts,
  getMyVehicles,
  getAdvanceInvoices,
  type ApiFieldPass,
  type FieldPassStatus,
  type ApiFrameworkContract,
  type Vehicle,
  type ApiAdvanceInvoice,
} from '@/lib/api';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_META: Record<
  FieldPassStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    icon: React.ElementType;
  }
> = {
  ACTIVE: { label: 'Aktīva', variant: 'default', icon: CheckCircle2 },
  EXPIRED: { label: 'Beigusies', variant: 'secondary', icon: Clock },
  REVOKED: { label: 'Atcelta', variant: 'destructive', icon: XCircle },
};

// ─── Pass card ────────────────────────────────────────────────────────────────

function PassCard({ pass }: { pass: ApiFieldPass }) {
  const meta = STATUS_META[pass.status];
  const Icon = meta.icon;
  const isExpired = pass.status === 'ACTIVE' && new Date(pass.validTo) < new Date();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Ticket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{pass.passNumber}</span>
                <Badge variant={isExpired ? 'secondary' : meta.variant} className="text-xs">
                  <Icon className="h-3 w-3 mr-1" />
                  {isExpired ? 'Termiņš beidzies' : meta.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {pass.vehiclePlate}
                {pass.driverName ? ` · ${pass.driverName}` : ''}
              </p>
            </div>
          </div>

          {pass.fileUrl && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={pass.fileUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                PDF
              </a>
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground/70">Derīgs no: </span>
            {fmtDate(pass.validFrom)}
          </div>
          <div>
            <span className="font-medium text-foreground/70">Derīgs līdz: </span>
            {fmtDate(pass.validTo)}
          </div>
          {pass.wasteClassCode && (
            <div>
              <span className="font-medium text-foreground/70">Atkritumu kods: </span>
              {pass.wasteClassCode}
            </div>
          )}
          {pass.unloadingPoint && (
            <div>
              <span className="font-medium text-foreground/70">Izkraušana: </span>
              {pass.unloadingPoint}
            </div>
          )}
          {pass.contract && (
            <div className="col-span-2 mt-1 pt-1.5 border-t">
              <span className="font-medium text-foreground/70">Līgums: </span>
              {pass.contract.contractNumber} — {pass.contract.title}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Balance strip ─────────────────────────────────────────────────────────────

function BalanceStrip({ contract }: { contract: ApiFrameworkContract }) {
  const balance = contract.prepaidBalance ?? 0;
  const used = contract.prepaidUsed ?? 0;
  const available = balance - used;
  const pct = balance > 0 ? Math.min(100, (used / balance) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          {contract.contractNumber} — {contract.title}
        </span>
        <span
          className={`text-sm font-semibold ${available <= 0 ? 'text-destructive' : 'text-emerald-600'}`}
        >
          {available <= 0 ? (
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Bilance izsmelita
            </span>
          ) : (
            `${used} / ${balance} caurlaides`
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-destructive' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FieldPassesPage() {
  const { token } = useAuth();
  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [contracts, setContracts] = useState<ApiFrameworkContract[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [advanceInvoices, setAdvanceInvoices] = useState<ApiAdvanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [contractId, setContractId] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [wasteClassCode, setWasteClassCode] = useState('');
  const [wasteDescription, setWasteDescription] = useState('');
  const [unloadingPoint, setUnloadingPoint] = useState('');
  const [estimatedTonnes, setEstimatedTonnes] = useState('');
  const [manualPlate, setManualPlate] = useState(false);

  // Vehicle type label helper
  const VEHICLE_LABELS: Record<string, string> = {
    DUMP_TRUCK: 'Pašizgāzējs',
    FLATBED_TRUCK: 'Platforma',
    SEMI_TRAILER: 'Puspiekabe',
    HOOK_LIFT: 'Āķa pacēlājs',
    SKIP_LOADER: 'Konteinerauto',
    TANKER: 'Cisternas auto',
    VAN: 'Furgons',
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [p, c, v] = await Promise.all([
        getFieldPasses(token),
        getFrameworkContracts(token),
        getMyVehicles(token),
      ]);
      setPasses(p);
      // Only show field contracts
      const fieldContracts = c.filter((c) => c.isFieldContract && c.status === 'ACTIVE');
      setContracts(fieldContracts);
      // Only active/in-use vehicles
      setVehicles(v.filter((v) => v.status === 'ACTIVE' || v.status === 'IN_USE'));
      // Fetch advance invoices for all field contracts
      const allAdvances = await Promise.all(
        fieldContracts.map((fc) =>
          getAdvanceInvoices(fc.id, token).catch(() => [] as ApiAdvanceInvoice[]),
        ),
      );
      setAdvanceInvoices(allAdvances.flat());
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!token || !contractId || !vehiclePlate || !validFrom || !validTo) return;
    setSaving(true);
    setError(null);
    try {
      await createFieldPass(
        {
          contractId,
          vehiclePlate,
          driverName: driverName || undefined,
          validFrom,
          validTo,
          wasteClassCode: wasteClassCode || undefined,
          wasteDescription: wasteDescription || undefined,
          unloadingPoint: unloadingPoint || undefined,
          estimatedTonnes: estimatedTonnes ? Number(estimatedTonnes) : undefined,
        },
        token,
      );
      setSheetOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setContractId('');
    setVehiclePlate('');
    setDriverName('');
    setValidFrom('');
    setValidTo('');
    setWasteClassCode('');
    setWasteDescription('');
    setUnloadingPoint('');
    setEstimatedTonnes('');
    setManualPlate(false);
  };

  const active = passes.filter((p) => p.status === 'ACTIVE' && new Date(p.validTo) >= new Date());
  const past = passes.filter((p) => p.status !== 'ACTIVE' || new Date(p.validTo) < new Date());

  // Passes valid today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const onSiteToday = passes.filter(
    (p) =>
      p.status === 'ACTIVE' && new Date(p.validFrom) <= tomorrow && new Date(p.validTo) >= today,
  );

  // Pending advance invoices
  const pendingAdvances = advanceInvoices.filter((inv) => inv.paymentStatus === 'PENDING');
  const paidAdvances = advanceInvoices.filter((inv) => inv.paymentStatus === 'PAID');

  const fmtEur = (n: number) =>
    new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' }).format(n);

  return (
    <>
      <PageHeader
        title="Caurlaides"
        description="Pārvaldiet kravas automašīnu ieejas caurlaides B3 laukumam"
        action={
          <Button onClick={() => setSheetOpen(true)} disabled={contracts.length === 0}>
            <Plus className="h-4 w-4 mr-1.5" />
            Jauna caurlaide
          </Button>
        }
      />

      {/* Balance strips for active field contracts */}
      {contracts.length > 0 && (
        <div className="space-y-2">
          {contracts.map((c) => (
            <BalanceStrip key={c.id} contract={c} />
          ))}
        </div>
      )}

      {/* On-site today strip */}
      {!loading && onSiteToday.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarCheck className="h-4 w-4 text-sky-600" />
            <span className="text-sm font-semibold text-sky-800">
              Šodien laukumā — {onSiteToday.length}{' '}
              {onSiteToday.length === 1 ? 'transportlīdzeklis' : 'transportlīdzekļi'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {onSiteToday.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-md bg-white border border-sky-100 px-2.5 py-1.5 text-xs"
              >
                <Truck className="h-3 w-3 text-sky-500" />
                <span className="font-semibold">{p.vehiclePlate}</span>
                {p.driverName && <span className="text-muted-foreground">· {p.driverName}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending advance invoices */}
      {!loading && pendingAdvances.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Hourglass className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">
              Gaida apstiprinājumu — {pendingAdvances.length}{' '}
              {pendingAdvances.length === 1 ? 'avansa rēķins' : 'avansa rēķini'}
            </span>
          </div>
          <div className="space-y-1.5">
            {pendingAdvances.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md bg-white border border-amber-100 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-mono font-medium">{inv.invoiceNumber}</span>
                  <span className="text-muted-foreground">· Termiņš {fmtDate(inv.dueDate)}</span>
                </div>
                <span className="font-semibold">{fmtEur(inv.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paid advance invoices (recent, collapsed feel) */}
      {!loading && paidAdvances.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none list-none">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {paidAdvances.length} apmaksāti avansa rēķini
            <span className="group-open:hidden">▸</span>
            <span className="hidden group-open:inline">▾</span>
          </summary>
          <div className="mt-2 space-y-1.5 pl-4">
            {paidAdvances.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md bg-muted/40 border px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  {inv.paidDate && (
                    <span className="text-muted-foreground">
                      · Apmaksāts {fmtDate(inv.paidDate)}
                    </span>
                  )}
                </div>
                <span className="text-emerald-700 font-semibold">{fmtEur(inv.total)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {contracts.length === 0 && !loading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Nav aktīvu lauka piekļuves līgumu. Lūdzu, sazinieties ar B3, lai noslēgtu līgumu.
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : passes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nav caurlaiţu"
          description="Izveidojiet pirmo kravas automašīnas ieejas caurlaidi"
          action={
            contracts.length > 0 ? (
              <Button onClick={() => setSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Jauna caurlaide
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Aktīvās ({active.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((p) => (
                  <PassCard key={p.id} pass={p} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Vēsture ({past.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((p) => (
                  <PassCard key={p.id} pass={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Jauna caurlaide</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Contract */}
            <div className="space-y-1.5">
              <Label>Līgums *</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlieties līgumu" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contractNumber} — {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle — fleet picker or manual entry */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Transportlīdzeklis *</Label>
                {vehicles.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={() => {
                      setManualPlate((v) => !v);
                      setVehiclePlate('');
                    }}
                  >
                    {manualPlate ? '← Izvēlēties no autoparka' : 'Ievadīt manuāli'}
                  </button>
                )}
              </div>

              {vehicles.length === 0 || manualPlate ? (
                <Input
                  placeholder="AA-0000"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                />
              ) : (
                <Select
                  value={vehiclePlate}
                  onValueChange={(plate) => {
                    setVehiclePlate(plate);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izvēlēties no autoparka">
                      {vehiclePlate ? (
                        <span className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          {vehiclePlate}
                        </span>
                      ) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.licensePlate}>
                        <span className="flex items-center gap-2">
                          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{v.licensePlate}</span>
                          <span className="text-muted-foreground">
                            {v.make} {v.model} · {VEHICLE_LABELS[v.vehicleType] ?? v.vehicleType} ·{' '}
                            {v.capacity}t
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Driver */}
            <div className="space-y-1.5">
              <Label>Šofera vārds</Label>
              <Input
                placeholder="Vārds Uzvārds"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Derīgs no *</Label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Derīgs līdz *</Label>
                <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
              </div>
            </div>

            {/* Waste details */}
            <div className="space-y-1.5">
              <Label>Atkritumu klasifikācijas kods</Label>
              <Input
                placeholder="piem. 17 05 04"
                value={wasteClassCode}
                onChange={(e) => setWasteClassCode(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Atkritumu apraksts</Label>
              <Textarea
                placeholder="Rakāšanas zemes, būvgružus u.c."
                value={wasteDescription}
                onChange={(e) => setWasteDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Izkraušanas vieta</Label>
              <Input
                placeholder="piem. Sekcija A"
                value={unloadingPoint}
                onChange={(e) => setUnloadingPoint(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Paredzamais svars (t)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={estimatedTonnes}
                onChange={(e) => setEstimatedTonnes(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                {error}
              </p>
            )}

            <Button
              className="w-full mt-2"
              onClick={handleCreate}
              disabled={saving || !contractId || !vehiclePlate || !validFrom || !validTo}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Izveidot caurlaidi
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
