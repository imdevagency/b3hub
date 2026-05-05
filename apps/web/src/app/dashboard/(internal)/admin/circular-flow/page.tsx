/**
 * Circular Economy Flow — /dashboard/admin/circular-flow
 *
 * End-to-end traceability of the B3Hub material loop:
 *   Disposal order → WasteRecord (processing) → RC Material listing → Sold back to construction
 *
 * Shows platform-wide recovery rate, conversion pipeline, CO₂ savings and
 * financial return from recirculated materials.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetCircularEconomyStats,
  type CircularEconomyStats,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Leaf,
  Loader2,
  Package,
  Recycle,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, dp = 1) {
  return n.toFixed(dp).replace(/\.0$/, '');
}

function pct(n: number, dp = 0) {
  return `${n.toFixed(dp)}%`;
}

function eur(n: number) {
  return new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

/** Formats a YYYY-MM key to a short month label */
function monthLabel(key: string) {
  const [year, month] = key.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('lv-LV', { month: 'short', year: '2-digit' });
}

// ─── Pipeline Stage ───────────────────────────────────────────────────────────

function PipelineStage({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  sub,
  tonnes,
  efficiency,
  efficiencyLabel,
  isLast = false,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  sub: string;
  tonnes: number;
  efficiency?: number;
  efficiencyLabel?: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-0">
      <div className="flex-1 flex flex-col items-center text-center gap-3 p-5 rounded-xl border bg-card shadow-sm">
        <div className={cn('p-3 rounded-full', iconBg)}>
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{fmt(tonnes)} t</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
        {efficiency !== undefined && (
          <div className={cn(
            'mt-auto px-2.5 py-1 rounded-full text-xs font-semibold border',
            efficiency >= 70
              ? 'bg-green-50 border-green-200 text-green-700'
              : efficiency >= 40
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-600',
          )}>
            {pct(efficiency)} {efficiencyLabel}
          </div>
        )}
      </div>
      {!isLast && (
        <div className="flex items-center px-1 text-muted-foreground/40 self-center">
          <ArrowRight className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CircularFlowPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CircularEconomyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await adminGetCircularEconomyStats(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived values ────────────────────────────────────────────────────────
  const listingEfficiency = data && data.totalRecyclableTonnes > 0
    ? (data.totalConvertedTonnes / data.totalRecyclableTonnes) * 100
    : 0;

  const saleEfficiency = data && data.totalConvertedTonnes > 0
    ? (data.quantitySoldTonnes / data.totalConvertedTonnes) * 100
    : 0;

  const maxMonthlyWaste = data && data.monthlyTrend.length > 0
    ? Math.max(...data.monthlyTrend.map((m) => m.wasteIn), 1)
    : 1;

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-red-800">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-350 mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="Aprites Ekonomikas Plūsma"
          description="Atkritumi → Pārstrāde → Saraksts tirgū → Pārdots atpakaļ būvniecībai. Pilns cilpas pārskats."
        />
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          {loading ? 'Atjauno...' : 'Atjaunot'}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Aprēķina aprites plūsmu...</p>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* ── Top KPIs ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Pieņemts atkritumos"
              value={`${fmt(data.totalWasteInTonnes)} t`}
              sub="visi laiki, visa platforma"
              icon={Truck}
              iconBg="bg-slate-100"
              iconColor="text-slate-600"
            />
            <StatCard
              label="Atgūšanas koeficients"
              value={pct(data.avgRecoveryRate)}
              sub={`${fmt(data.totalRecyclableTonnes)} t pārstrādāts`}
              icon={Recycle}
              iconBg={data.avgRecoveryRate >= 60 ? 'bg-green-100' : 'bg-amber-100'}
              iconColor={data.avgRecoveryRate >= 60 ? 'text-green-600' : 'text-amber-600'}
              accent={data.avgRecoveryRate >= 60 ? 'text-green-600' : 'text-amber-600'}
            />
            <StatCard
              label="Aktīvie RC saraksti"
              value={String(data.activeMaterialListings)}
              sub={`${fmt(data.totalConvertedTonnes)} t tirgū`}
              icon={Package}
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
            />
            <StatCard
              label="CO₂ ietaupīts"
              value={`${fmt(data.co2SavedTonnes)} t`}
              sub="aprēķins: 0.35 t/t pārstrādātā"
              icon={Leaf}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              accent="text-emerald-600"
            />
          </div>

          {/* ── Material Pipeline ── */}
          <Card className="overflow-hidden border-border/50 shadow-sm">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-100/50">
                  <Recycle className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Materiālu aprites cauruļvads</CardTitle>
                  <CardDescription>No demontāžas objekta līdz jaunam pirkumam</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <PipelineStage
                  icon={Truck}
                  iconBg="bg-slate-100"
                  iconColor="text-slate-600"
                  label="1. Pieņemts"
                  sub="Atkritumu ienākums"
                  tonnes={data.totalWasteInTonnes}
                />
                <PipelineStage
                  icon={Recycle}
                  iconBg="bg-teal-100"
                  iconColor="text-teal-600"
                  label="2. Pārstrādāts"
                  sub="Recuperējami materiāli"
                  tonnes={data.totalRecyclableTonnes}
                  efficiency={data.avgRecoveryRate}
                  efficiencyLabel="atgūts"
                />
                <PipelineStage
                  icon={Package}
                  iconBg="bg-blue-100"
                  iconColor="text-blue-600"
                  label="3. Tirgū"
                  sub="RC materiālu saraksti"
                  tonnes={data.totalConvertedTonnes}
                  efficiency={listingEfficiency}
                  efficiencyLabel="konvertēts"
                />
                <PipelineStage
                  icon={ShoppingBag}
                  iconBg="bg-green-100"
                  iconColor="text-green-600"
                  label="4. Pārdots"
                  sub="Atgriezts būvniecībā"
                  tonnes={data.quantitySoldTonnes}
                  efficiency={saleEfficiency}
                  efficiencyLabel="pārdots"
                  isLast
                />
              </div>

              {/* Funnel loss indicators */}
              <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Zaudējumi pārstrādē</p>
                  <p className="font-semibold">{fmt(data.totalWasteInTonnes - data.totalRecyclableTonnes)} t</p>
                  <p className="text-xs text-muted-foreground">
                    {data.totalWasteInTonnes > 0
                      ? pct(((data.totalWasteInTonnes - data.totalRecyclableTonnes) / data.totalWasteInTonnes) * 100)
                      : '0%'} nav atgūstams
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Gaida konversiju</p>
                  <p className={cn('font-semibold', data.pendingConversionCount > 0 ? 'text-amber-600' : 'text-green-600')}>
                    {fmt(data.pendingConversionTonnes)} t
                  </p>
                  <p className="text-xs text-muted-foreground">{data.pendingConversionCount} ieraksti</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Sarakstā, negārdots</p>
                  <p className="font-semibold">{fmt(data.totalConvertedTonnes - data.quantitySoldTonnes)} t</p>
                  <p className="text-xs text-muted-foreground">{data.activeMaterialListings} aktīvi saraksti</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Two Panel Row ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* Pending conversion alert */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div className={cn('p-2 rounded-lg', data.pendingConversionCount > 0 ? 'bg-amber-100/50' : 'bg-green-100/50')}>
                    {data.pendingConversionCount > 0
                      ? <AlertTriangle className="h-5 w-5 text-amber-600" />
                      : <CheckCircle2 className="h-5 w-5 text-green-600" />
                    }
                  </div>
                  <div>
                    <CardTitle className="text-base">Konversijas rinda</CardTitle>
                    <CardDescription>Pārstrādāts, bet vēl nav tirgū</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-5">
                {data.pendingConversionCount > 0 ? (
                  <>
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                      <p className="text-3xl font-bold text-amber-700">{fmt(data.pendingConversionTonnes)} t</p>
                      <p className="text-sm text-amber-700 mt-1">
                        <strong>{data.pendingConversionCount}</strong> apstrādāti ieraksti nav pārvērsti materiālu sarakstos.
                        Šie materiāli nav redzami pircējiem.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Katrs nekonvertēts ieraksts ir tiešs ieņēmumu zaudējums un mazāka aprites efektivitāte.
                    </p>
                    <Button asChild className="w-full">
                      <Link href="/dashboard/b3-recycling/waste-log">
                        Konvertēt žurnālā <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-green-200 bg-green-50/50">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Pilns konversijas temps!</p>
                      <p className="text-sm text-green-700 mt-1">
                        Visi pārstrādātie materiāli ir pārvērsti aktīvos materiālu sarakstos.
                        Cilpa ir aizvērta.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Financial return */}
            <Card className="overflow-hidden border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-100/50">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Finansiālā atdeve</CardTitle>
                    <CardDescription>Ieņēmumi no pārdotiem RC materiāliem</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex flex-col gap-5">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <p className="text-3xl font-bold text-emerald-700">{eur(data.revenueFromRecycledMaterials)}</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    No <strong>{fmt(data.quantitySoldTonnes)} t</strong> pārdotiem RC materiāliem
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Pārdots t</p>
                    <p className="text-xl font-bold mt-1">{fmt(data.quantitySoldTonnes)}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-card text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Konvertēti ieraksti</p>
                    <p className="text-xl font-bold mt-1">{data.totalConvertedCount}</p>
                  </div>
                </div>

                {data.quantitySoldTonnes > 0 && (
                  <div className="text-sm text-muted-foreground border-t pt-4">
                    Vidēji <strong>{eur(data.revenueFromRecycledMaterials / data.quantitySoldTonnes)}/t</strong> par RC materiālu —
                    {' '}salīdziniet ar primāro materiālu cenām katalogā.
                  </div>
                )}

                <Button variant="outline" asChild className="w-full">
                  <Link href="/dashboard/admin/catalog?recycled=true">
                    RC materiālu katalogs <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Monthly Trend ── */}
          {data.monthlyTrend.length > 0 && (
            <Card className="overflow-hidden border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-100/50">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Ikmēneša tendence</CardTitle>
                    <CardDescription>Pēdējie 6 mēneši — atkritumu plūsma un pārstrāde</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28">Mēnesis</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pieņemts (t)</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pārstrādāts (t)</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Konvertēts (t)</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-52">Efektivitāte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthlyTrend.map((row, i) => {
                        const efficiency = row.wasteIn > 0 ? (row.recycled / row.wasteIn) * 100 : 0;
                        const barWidth = maxMonthlyWaste > 0 ? (row.wasteIn / maxMonthlyWaste) * 100 : 0;
                        return (
                          <tr
                            key={row.month}
                            className={cn(
                              'border-b last:border-0 hover:bg-muted/20 transition-colors',
                              i === data.monthlyTrend.length - 1 && 'font-medium',
                            )}
                          >
                            <td className="px-5 py-3.5 text-sm font-semibold">{monthLabel(row.month)}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-muted/40 max-w-32 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-slate-400 transition-all duration-500"
                                    style={{ width: `${Math.max(barWidth, 2)}%` }}
                                  />
                                </div>
                                <span className="text-sm tabular-nums">{fmt(row.wasteIn)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-muted/40 max-w-32 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-teal-500 transition-all duration-500"
                                    style={{ width: `${maxMonthlyWaste > 0 ? (row.recycled / maxMonthlyWaste) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-sm tabular-nums">{fmt(row.recycled)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-muted/40 max-w-32 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                    style={{ width: `${maxMonthlyWaste > 0 ? (row.converted / maxMonthlyWaste) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-sm tabular-nums">{fmt(row.converted)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-semibold',
                                  efficiency >= 60
                                    ? 'border-green-200 bg-green-50 text-green-700'
                                    : efficiency >= 30
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : 'border-muted bg-muted/40 text-muted-foreground',
                                )}
                              >
                                {pct(efficiency)} atgūts
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Provenance note ── */}
          <div className="rounded-xl border border-border/40 bg-muted/10 p-5 flex items-start gap-3">
            <Leaf className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Izsekojamība katrā sarakstā</p>
              <p className="text-sm text-muted-foreground mt-1">
                Katrs RC materiālu saraksts platformā satur <code className="text-xs bg-muted px-1 py-0.5 rounded">isRecycled: true</code>,{' '}
                atgūšanas procentu un izcelsmes objekta nosaukumu —
                redzami pircēja produkta lapā kā "Zaļā izcelsme".
              </p>
              <div className="flex gap-3 mt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/admin/recycling-centers">Centru pārvaldība</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/b3-recycling/waste-log">APUS žurnāls</Link>
                </Button>
              </div>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
}
