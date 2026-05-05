/**
 * Waste Supply-Demand Signals — /dashboard/admin/waste-signals
 *
 * Temporal matching view: for each waste type, how much is declared
 * available vs how much recycling capacity exists — month by month.
 * Also shows forward material demand from project declarations.
 *
 * This is the data-driven circular economy gap detector:
 * RED = more waste declared than capacity → need more recycling partners
 * GREEN = capacity exceeds declared supply → room to onboard more projects
 */
'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Recycle,
  ShoppingCart,
  Building2,
  Leaf,
  Zap,
  Droplets,
  Circle,
  Package,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  adminGetWasteSignals,
  type WasteSignalsData,
  type WasteSignalRow,
  type WasteSignalStatus,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Label maps ───────────────────────────────────────────────────────────────

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Grunts',
  MIXED: 'Jaukti',
  HAZARDOUS: 'Bīstami',
  ASPHALT: 'Asfalta',
  GREEN_WASTE: 'Zaļais',
  WEEE: 'Elektronika',
  OIL_WASTE: 'Eļļas',
  TIRES: 'Riepas',
  PACKAGING_WASTE: 'Iepakojums',
};

const MATERIAL_LABELS: Record<string, string> = {
  SAND: 'Smiltis', GRAVEL: 'Grants', STONE: 'Akmens', CONCRETE: 'Betons',
  SOIL: 'Grunts', RECYCLED_CONCRETE: 'RC betons', RECYCLED_SOIL: 'RC grunts',
  ASPHALT: 'Asfalta', CLAY: 'Māls', OTHER: 'Cits',
};

const WASTE_ICONS: Record<string, React.ElementType> = {
  CONCRETE: Building2, BRICK: Building2, WOOD: Leaf, METAL: Zap,
  PLASTIC: Package, SOIL: Circle, MIXED: Recycle, HAZARDOUS: AlertTriangle,
  ASPHALT: Circle, GREEN_WASTE: Leaf, WEEE: Zap, OIL_WASTE: Droplets,
  TIRES: Circle, PACKAGING_WASTE: Package,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n === 0) return '—';
  return n >= 1000 ? `${(n / 1000).toFixed(1)}kt` : `${n.toFixed(0)}t`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  return d.toLocaleDateString('lv-LV', { month: 'short', year: '2-digit' });
}

const STATUS_CONFIG: Record<WasteSignalStatus, { label: string; color: string; bg: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  COVERED:      { label: 'Nosegts',    color: 'text-emerald-700', bg: 'bg-emerald-50', variant: 'secondary' },
  OVERCAPACITY: { label: 'Brīva jauda', color: 'text-blue-700',  bg: 'bg-blue-50',    variant: 'default' },
  GAP:          { label: 'Trūkst jaudas', color: 'text-red-700', bg: 'bg-red-50',     variant: 'destructive' },
  NO_DATA:      { label: 'Nav datu',   color: 'text-muted-foreground', bg: 'bg-muted/30', variant: 'outline' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MonthCell({ supplyTonnes, capacityTonnes, status }: {
  supplyTonnes: number;
  capacityTonnes: number;
  status: WasteSignalStatus;
}) {
  const cfg = STATUS_CONFIG[status];
  if (status === 'NO_DATA') {
    return <td className="px-2 py-2 text-center text-xs text-muted-foreground">—</td>;
  }
  const fillPct = capacityTonnes > 0
    ? Math.min(100, Math.round((supplyTonnes / capacityTonnes) * 100))
    : supplyTonnes > 0 ? 100 : 0;
  return (
    <td className="px-2 py-1.5 text-center">
      <div className={cn('rounded-lg px-1.5 py-1', cfg.bg)}>
        <p className={cn('text-xs font-bold tabular-nums', cfg.color)}>{fmt(supplyTonnes)}</p>
        {capacityTonnes > 0 && (
          <div className="mt-0.5 h-1 w-full rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', status === 'GAP' ? 'bg-red-500' : 'bg-emerald-500')}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        )}
        <p className={cn('text-[9px] tabular-nums', cfg.color)}>
          {capacityTonnes > 0 ? `/ ${fmt(capacityTonnes)}` : 'jauda: 0'}
        </p>
      </div>
    </td>
  );
}

function WasteSignalTable({ signals, months }: { signals: WasteSignalRow[]; months: string[] }) {
  if (signals.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Nav atkritumu deklarāciju vai aktīvu pārstrādes centru
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-36">Atkritumu veids</th>
            {months.map((m) => (
              <th key={m} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground min-w-20">
                {monthLabel(m)}
              </th>
            ))}
            <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Kopā (t)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {signals.map((row) => {
            const Icon = WASTE_ICONS[row.wasteType] ?? Recycle;
            return (
              <tr key={row.wasteType} className={cn('hover:bg-muted/20 transition-colors', row.hasGap && 'bg-red-50/30')}>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs font-semibold">{WASTE_LABELS[row.wasteType] ?? row.wasteType}</p>
                      {row.totalSellable > 0 && (
                        <p className="text-[9px] text-green-700 font-medium">{fmt(row.totalSellable)} pārdošanai</p>
                      )}
                    </div>
                    {row.hasGap && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                  </div>
                </td>
                {row.monthlyData.map((m) => (
                  <MonthCell
                    key={m.month}
                    supplyTonnes={m.supplyTonnes}
                    capacityTonnes={m.capacityTonnes}
                    status={m.status}
                  />
                ))}
                <td className="py-2 px-3 text-right">
                  <p className="text-xs font-bold tabular-nums">{fmt(row.totalSupply)}</p>
                  <p className="text-[9px] text-muted-foreground tabular-nums">jaud: {fmt(row.totalCapacity)}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WasteSignalsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<WasteSignalsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminGetWasteSignals(token)
      .then(setData)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || !data) return <PageSpinner />;

  const { summary, wasteSignals, materialSignals, months } = data;
  const gapTypes = wasteSignals.filter((w) => w.hasGap);
  const sellableTypes = wasteSignals.filter((w) => w.totalSellable > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprites signāli</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Atkritumu piedāvājums vs. pārstrādes jauda — 6 mēneši uz priekšu. Sarkans = trūkst jaudas, zaļš = jaudas rezerve.
        </p>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <Recycle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Deklarēts</p>
              <p className="text-2xl font-bold">{summary.totalDeclarationTonnes.toFixed(0)}t</p>
              <p className="text-xs text-muted-foreground">{summary.totalDeclarations} deklarācijas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-green-50 p-2.5">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pārdošanai</p>
              <p className="text-2xl font-bold text-green-700">{summary.totalSellableTonnes.toFixed(0)}t</p>
              <p className="text-xs text-muted-foreground">{sellableTypes.length} atkritumu veidi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={cn('rounded-xl p-2.5', gapTypes.length > 0 ? 'bg-red-50' : 'bg-emerald-50')}>
              {gapTypes.length > 0
                ? <AlertTriangle className="h-5 w-5 text-red-600" />
                : <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Jaudas trūkums</p>
              <p className={cn('text-2xl font-bold', gapTypes.length > 0 ? 'text-red-700' : 'text-emerald-700')}>
                {gapTypes.length} veidi
              </p>
              {gapTypes.length > 0 && (
                <p className="text-xs text-red-600">{gapTypes.map((g) => WASTE_LABELS[g.wasteType] ?? g.wasteType).join(', ')}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="rounded-xl bg-muted/40 p-2.5">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Materiālu pieprasījums</p>
              <p className="text-2xl font-bold">{summary.totalMaterialNeedTonnes.toFixed(0)}t</p>
              <p className="text-xs text-muted-foreground">{materialSignals.length} kategorijas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded-sm', cfg.bg, 'ring-1 ring-black/10')} />
            <span className={cfg.color}>{cfg.label}</span>
          </div>
        ))}
        <span className="text-muted-foreground ml-2">Josla = % piepildījums (piedāvājums / jauda)</span>
      </div>

      {/* Waste signals matrix */}
      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Recycle className="h-4 w-4 text-muted-foreground" />
            Atkritumu piedāvājums vs. pārstrādes jauda
          </CardTitle>
          <CardDescription>
            Katra šūna: deklarēts (t) / jauda (t). {summary.activeCenters} aktīvi pārstrādes centri.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <WasteSignalTable signals={wasteSignals} months={months} />
        </CardContent>
      </Card>

      {/* Material demand signals */}
      {materialSignals.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="pb-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              Materiālu pieprasījuma signāli
            </CardTitle>
            <CardDescription>
              Nākotnes materiālu vajadzības no projektu deklarācijām — atspoguļo potenciālo pieprasījumu pēc pārstrādātas produkcijas.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-36">Materiāls</th>
                    {months.map((m) => (
                      <th key={m} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground min-w-20">
                        {monthLabel(m)}
                      </th>
                    ))}
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">Kopā (t)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {materialSignals.map((row) => (
                    <tr key={row.materialCategory} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-3">
                        <p className="text-xs font-semibold">{MATERIAL_LABELS[row.materialCategory] ?? row.materialCategory}</p>
                      </td>
                      {row.monthlyDemand.map((m) => (
                        <td key={m.month} className="px-2 py-2 text-center">
                          {m.demandTonnes > 0 ? (
                            <div className="rounded-lg px-1.5 py-1 bg-blue-50">
                              <p className="text-xs font-bold text-blue-700 tabular-nums">{fmt(m.demandTonnes)}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-xs font-bold tabular-nums">
                        {fmt(row.totalDemand)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gap explanation */}
      {gapTypes.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-red-200 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Jaudas trūkumi — darbības ieteikumi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gapTypes.map((row) => {
              const maxGap = Math.min(...row.monthlyData.filter(m => m.status === 'GAP').map(m => m.gap));
              return (
                <div key={row.wasteType} className="flex items-start gap-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold">{WASTE_LABELS[row.wasteType] ?? row.wasteType}</span>
                    {' — '}pieprasīts {row.totalSupply.toFixed(0)}t, jauda {row.totalCapacity.toFixed(0)}t.
                    Trūkums: ~{Math.abs(maxGap).toFixed(0)}t/mēn.
                    {' '}
                    <span className="text-muted-foreground">
                      {row.wasteType === 'WEEE' || row.wasteType === 'OIL_WASTE' || row.wasteType === 'TIRES'
                        ? 'Nepieciešams licencēts ārējais partneris.'
                        : 'Paplašināt pārstrādes kapacitāti vai piesaistīt jaunu centru.'}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
