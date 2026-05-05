/**
 * Market Health — /dashboard/admin/market-health
 *
 * Cross-side liquidity monitor for the B3Hub marketplace.
 * Shows all 4 market sides simultaneously so ops can spot and close gaps.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetMarketHealth,
  type MarketHealthData,
  type MarketCategoryCoverage,
} from '@/lib/api/admin';
import { CATEGORY_LABELS } from '@b3hub/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  Recycle,
  RefreshCw,
  ShoppingBag,
  Truck,
  Users,
  XCircle,
  ArrowRight,
  TrendingDown,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number) {
  return `${v.toFixed(0)}%`;
}

function healthColor(score: 'ok' | 'warn' | 'bad') {
  return score === 'ok'
    ? 'text-green-700 bg-green-50 border-green-200'
    : score === 'warn'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200';
}

function healthIcon(score: 'ok' | 'warn' | 'bad') {
  if (score === 'ok') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (score === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function catLabel(c: string) {
  return (CATEGORY_LABELS as Record<string, string>)[c] ?? c;
}

// ─── Shared Components ────────────────────────────────────────────────────────

function AlertBox({
  title,
  message,
  variant = 'warning',
  children,
}: {
  title: string;
  message?: string;
  variant?: 'warning' | 'destructive' | 'info';
  children?: React.ReactNode;
}) {
  const styles = {
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    destructive: 'border-red-200 bg-red-50 text-red-900',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  const iconColors = {
    warning: 'text-amber-600',
    destructive: 'text-red-600',
    info: 'text-blue-600',
  };
  const Icon = variant === 'info' ? Info : variant === 'destructive' ? AlertCircle : AlertTriangle;

  return (
    <div className={cn('rounded-lg border px-4 py-3 flex flex-col gap-1.5', styles[variant])}>
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconColors[variant])} />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {message && <p className="text-sm text-inherit/80 ml-6">{message}</p>}
      {children && <div className="ml-6 mt-1">{children}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketHealthPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MarketHealthData | null>(null);
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
      setData(await adminGetMarketHealth(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived health scores ─────────────────────────────────────────────────
  const supplyHealth: 'ok' | 'warn' | 'bad' = !data
    ? 'ok'
    : (data.supply.thinCategories?.length || 0) === 0
      ? 'ok'
      : data.supply.thinCategories.length <= 2
        ? 'warn'
        : 'bad';

  const demandHealth: 'ok' | 'warn' | 'bad' = !data
    ? 'ok'
    : data.demand.matchRate >= 60
      ? 'ok'
      : data.demand.matchRate >= 30
        ? 'warn'
        : 'bad';

  const transportHealth: 'ok' | 'warn' | 'bad' = !data
    ? 'ok'
    : data.transport.availableJobs === 0
      ? 'ok'
      : data.transport.availableJobs <= 5
        ? 'warn'
        : 'bad';

  const recyclingHealth: 'ok' | 'warn' | 'bad' = !data
    ? 'ok'
    : data.recycling.pendingConversionCount === 0
      ? 'ok'
      : data.recycling.pendingConversionCount <= 5
        ? 'warn'
        : 'bad';

  const overallHealth: 'ok' | 'warn' | 'bad' = [
    supplyHealth,
    demandHealth,
    transportHealth,
    recyclingHealth,
  ].includes('bad')
    ? 'bad'
    : [supplyHealth, demandHealth, transportHealth, recyclingHealth].includes('warn')
      ? 'warn'
      : 'ok';

  const maxListings =
    data && data.supply.categoryCoverage.length > 0
      ? Math.max(...data.supply.categoryCoverage.map((c) => c.listingCount), 1)
      : 1;

  if (error) {
    return (
      <div className="p-6">
        <AlertBox title="Kļūda ielādējot datus" message={error} variant="destructive" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-350 mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="Tirgus Veselība"
          description="Piegādes dziļums, pieprasījuma signāli, transporta pārklājums un pārstrādes kapacitāte."
        />
        <div className="flex items-center gap-3">
          {data && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm',
                healthColor(overallHealth),
              )}
            >
              {healthIcon(overallHealth)}
              {overallHealth === 'ok'
                ? 'Tirgus ir vesels'
                : overallHealth === 'warn'
                  ? 'Ir brīdinājumi'
                  : 'Kritiskas problēmas'}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {loading ? 'Atjauno...' : 'Atjaunot'}
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Analizē tirgus datus...</p>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* ── Top Level KPIs ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Aktīvie saraksti"
              value={String(data.supply.totalActiveListings)}
              sub={`${data.supply.totalSuppliers} autorizēti piegādātāji`}
              icon={Package}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <StatCard
              label="Saskaņošanas biežums"
              value={pct(data.demand.matchRate)}
              sub={`${data.demand.totalRfqs} pieprasījumi (RFQ)`}
              icon={ShoppingBag}
              iconBg={data.demand.matchRate >= 60 ? 'bg-green-100' : 'bg-amber-100'}
              iconColor={data.demand.matchRate >= 60 ? 'text-green-600' : 'text-amber-600'}
              accent={data.demand.matchRate >= 60 ? 'text-green-600' : 'text-amber-600'}
            />
            <StatCard
              label="Transporta rindā"
              value={String(data.transport.availableJobs)}
              sub={`${data.transport.inProgressJobs} aktīvi procesā`}
              icon={Truck}
              iconBg={data.transport.availableJobs === 0 ? 'bg-green-100' : 'bg-orange-100'}
              iconColor={data.transport.availableJobs === 0 ? 'text-green-600' : 'text-orange-600'}
              accent={data.transport.availableJobs === 0 ? 'text-green-600' : 'text-orange-600'}
            />
            <StatCard
              label="Pārstrādes rindā"
              value={String(data.recycling.pendingConversionCount)}
              sub={`${data.recycling.pendingConversionTonnes.toFixed(1)} t gaida tirgū`}
              icon={Recycle}
              iconBg={data.recycling.pendingConversionCount === 0 ? 'bg-green-100' : 'bg-amber-100'}
              iconColor={
                data.recycling.pendingConversionCount === 0 ? 'text-green-600' : 'text-amber-600'
              }
              accent={
                data.recycling.pendingConversionCount === 0 ? 'text-green-600' : 'text-amber-600'
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* SUPPLY PANEL */}
            <Card className="overflow-hidden border-border/50 shadow-sm flex flex-col">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-100/50">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-blue-950 dark:text-blue-200">
                        Pārtēriņš & Piegāde
                      </CardTitle>
                      <CardDescription>Materiālu pārklājums platformā</CardDescription>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md border',
                      healthColor(supplyHealth),
                    )}
                  >
                    {supplyHealth === 'ok'
                      ? 'Stabils'
                      : supplyHealth === 'warn'
                        ? 'Risks'
                        : 'Kritisks'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col gap-6">
                {(data.supply.thinCategories?.length || 0) > 0 && (
                  <AlertBox
                    title="Nepietiekama piedāvājuma kategorijas (<2 piegādātāji):"
                    variant="destructive"
                  >
                    <div className="flex flex-wrap gap-2 mt-2">
                      {data.supply.thinCategories.map((c) => (
                        <Link
                          key={c}
                          href={`/dashboard/admin/catalog?category=${encodeURIComponent(c)}`}
                        >
                          <Badge
                            variant="outline"
                            className="border-red-300 bg-red-100/50 text-red-800 hover:bg-red-200"
                          >
                            {catLabel(c)}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </AlertBox>
                )}

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Kategoriju piesātinājums
                  </h4>
                  <div className="grid gap-3">
                    {data.supply.categoryCoverage.map((row) => {
                      const health =
                        row.supplierCount >= 3 ? 'ok' : row.supplierCount === 2 ? 'warn' : 'bad';
                      const widthPct = maxListings > 0 ? (row.listingCount / maxListings) * 100 : 0;
                      return (
                        <div key={row.category} className="flex items-center gap-3">
                          <div
                            className="w-27.5 sm:w-36 text-sm font-medium truncate"
                            title={catLabel(row.category)}
                          >
                            {catLabel(row.category)}
                          </div>
                          <div className="flex-1 h-3 rounded-full bg-muted/60 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500 ease-out',
                                health === 'ok'
                                  ? 'bg-green-500'
                                  : health === 'warn'
                                    ? 'bg-amber-400'
                                    : 'bg-red-500',
                              )}
                              style={{ width: `${Math.max(widthPct, 2)}%` }} // At least 2% to show there is something if >0
                            />
                          </div>
                          <div className="w-20 text-right flex items-center justify-end gap-1.5">
                            <span className="text-sm font-semibold">{row.listingCount}</span>
                            <span className="text-xs text-muted-foreground">gab</span>
                          </div>
                          <div
                            className={cn(
                              'w-17.5 text-right text-xs font-medium',
                              health === 'ok'
                                ? 'text-green-600'
                                : health === 'warn'
                                  ? 'text-amber-600'
                                  : 'text-red-500',
                            )}
                          >
                            {row.supplierCount} pieg.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-auto pt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Link href="/dashboard/admin/catalog">
                      Pārvaldīt katalogu <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* DEMAND PANEL */}
            <Card className="overflow-hidden border-border/50 shadow-sm flex flex-col">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-100/50">
                      <ShoppingBag className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-purple-950 dark:text-purple-200">
                        Kientu Pieprasījums
                      </CardTitle>
                      <CardDescription>RFQ un pasūtījumu tendences</CardDescription>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md border',
                      healthColor(demandHealth),
                    )}
                  >
                    {demandHealth === 'ok'
                      ? 'Stabils'
                      : demandHealth === 'warn'
                        ? 'Risks'
                        : 'Kritisks'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col gap-6">
                <div className="flex gap-4 p-4 bg-muted/30 rounded-xl border border-border/40">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Atcelti (30d)</p>
                    <p
                      className={cn(
                        'text-2xl font-bold flex items-center gap-2',
                        data.demand.cancelRate > 20 ? 'text-red-600' : 'text-foreground',
                      )}
                    >
                      {pct(data.demand.cancelRate)}
                      {data.demand.cancelRate > 20 && (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </p>
                  </div>
                  <div className="w-px bg-border/60"></div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Pasūtījumi (30d)</p>
                    <p className="text-2xl font-bold">{data.demand.ordersLast30d}</p>
                  </div>
                </div>

                {(data.demand.pendingRfqs > 0 || data.demand.expiredRfqs > 0) && (
                  <AlertBox
                    title="Neapmierināts pieprasījums uzejošajiem termiņiem"
                    variant="warning"
                  >
                    <ul className="list-disc pl-4 mt-1 space-y-1 marker:text-amber-500/50">
                      {data.demand.pendingRfqs > 0 && (
                        <li>
                          <strong>{data.demand.pendingRfqs}</strong> gaidoši pieprasījumi bez
                          piedāvājumiem
                        </li>
                      )}
                      {data.demand.expiredRfqs > 0 && (
                        <li>
                          <strong>{data.demand.expiredRfqs}</strong> pieprasījumu termiņš ir
                          beidzies
                        </li>
                      )}
                    </ul>
                  </AlertBox>
                )}

                {data.demand.topRequestedCategories.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Pieprasītākās preces
                    </h4>
                    <div className="grid gap-3">
                      {data.demand.topRequestedCategories.map((r, i) => (
                        <div
                          key={r.category}
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-6 rounded flex items-center justify-center bg-muted/60 text-xs font-bold text-muted-foreground">
                              {i + 1}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {catLabel(r.category)}
                            </span>
                          </div>
                          <Badge variant="secondary" className="font-semibold">
                            {r.count} pieprasījumi
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Link href="/dashboard/admin/rfqs">
                      Pārvaldīt pieprasījumus <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* TRANSPORT PANEL */}
            <Card className="overflow-hidden border-border/50 shadow-sm flex flex-col">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orange-100/50">
                      <Truck className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-orange-950 dark:text-orange-200">
                        Loģistika
                      </CardTitle>
                      <CardDescription>Piegāžu izpildes rādītāji</CardDescription>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md border',
                      healthColor(transportHealth),
                    )}
                  >
                    {transportHealth === 'ok'
                      ? 'Stabils'
                      : transportHealth === 'warn'
                        ? 'Risks'
                        : 'Kritisks'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col gap-6">
                {data.transport.availableJobs > 0 ? (
                  <AlertBox
                    title={`${data.transport.availableJobs} darbi gaida šoferi`}
                    variant={data.transport.availableJobs > 5 ? 'destructive' : 'warning'}
                    message="Nepieciešama manuāla piesaiste vai papildus paziņojumi šoferiem."
                  />
                ) : (
                  <AlertBox
                    title="Visi darbi piesaistīti!"
                    variant="info"
                    message="Šobrīd nav atrūpētu loģistikas pasūtījumu."
                  />
                )}

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="p-4 rounded-xl border bg-card shadow-sm">
                    <p className="text-sm text-muted-foreground">Pieņemšanas koeficients</p>
                    <p
                      className={cn(
                        'mt-1 text-2xl font-bold',
                        data.transport.jobAcceptanceRate >= 80
                          ? 'text-green-600'
                          : 'text-amber-600',
                      )}
                    >
                      {pct(data.transport.jobAcceptanceRate)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border bg-card shadow-sm">
                    <p className="text-sm text-muted-foreground">Izpildīti (30d)</p>
                    <p className="mt-1 text-2xl font-bold">{data.transport.completedJobs30d}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <Link href="/dashboard/admin/jobs">
                      Skatīt dispečerizāciju <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* RECYCLING PANEL */}
            <Card className="overflow-hidden border-border/50 shadow-sm flex flex-col">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-teal-100/50">
                      <Recycle className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-teal-950 dark:text-teal-200">
                        Pārstrādes Kapacitāte
                      </CardTitle>
                      <CardDescription>Inertie materiāli un to atgriešana tirgū</CardDescription>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md border',
                      healthColor(recyclingHealth),
                    )}
                  >
                    {recyclingHealth === 'ok'
                      ? 'Stabils'
                      : recyclingHealth === 'warn'
                        ? 'Risks'
                        : 'Kritisks'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col gap-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Aktīvie centri</p>
                    <p className="mt-1 text-2xl font-bold">
                      {data.recycling.totalRecyclingCenters}
                    </p>
                  </div>
                  <div className="w-px bg-border/60"></div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Jauda / dienā</p>
                    <p className="mt-1 text-2xl font-bold">
                      {data.recycling.totalCapacityTpd}{' '}
                      <span className="text-sm font-medium text-muted-foreground">t/d</span>
                    </p>
                  </div>
                </div>

                {data.recycling.pendingConversionCount > 0 ? (
                  <AlertBox title="Apstrādāti materiāli nav tirgū" variant="warning">
                    <p className="text-sm mt-1">
                      {data.recycling.pendingConversionTonnes.toFixed(1)} t jāpārveido par preču
                      sarakstiem.
                    </p>
                    <Button variant="outline" size="sm" asChild className="mt-3 bg-background">
                      <Link href="/dashboard/b3-recycling/waste-log">Konvertēt žurnālā</Link>
                    </Button>
                  </AlertBox>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-green-200 bg-green-50/50">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium text-green-800">
                      Visi pieņemtie atkritumi ir pārstrādāti un atgriezti tirgū kā materiāli.
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-4 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-teal-600 hover:text-teal-700"
                  >
                    <Link href="/dashboard/b3-recycling">
                      Pārstrādes modulis <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Action Playbook ── */}
          <div className="mt-4 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Tirgus attīstības vadlīnijas
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: 'Trūkst piedāvājuma',
                  action:
                    'Uzaiciniet jaunus piegādātājus problēmu kategorijās caur partneru programmu.',
                  href: '/dashboard/admin/users',
                  color: 'text-blue-600',
                  bg: 'bg-blue-50',
                  border: 'border-blue-100',
                  hover: 'hover:border-blue-300 hover:bg-blue-100/50',
                },
                {
                  label: 'Zema saskaņošana',
                  action: 'Pārbaudiet uzstādītās grīdas cenas un minimālos pasūtījumu reģistrus.',
                  href: '/dashboard/admin/catalog',
                  color: 'text-purple-600',
                  bg: 'bg-purple-50',
                  border: 'border-purple-100',
                  hover: 'hover:border-purple-300 hover:bg-purple-100/50',
                },
                {
                  label: 'Neizpildīta loģistika',
                  action:
                    'Piesaistiet iztrūkstošos šoferus lokālajā zonā izmantojot manuālo dispečeri.',
                  href: '/dashboard/admin/jobs',
                  color: 'text-orange-600',
                  bg: 'bg-orange-50',
                  border: 'border-orange-100',
                  hover: 'hover:border-orange-300 hover:bg-orange-100/50',
                },
                {
                  label: 'Pasīvi materiāli',
                  action: 'Pievienojiet pārstrādātās masas B3Hub tirgū caur reciklēšanas moduli.',
                  href: '/dashboard/b3-recycling/waste-log',
                  color: 'text-teal-600',
                  bg: 'bg-teal-50',
                  border: 'border-teal-100',
                  hover: 'hover:border-teal-300 hover:bg-teal-100/50',
                },
              ].map((tip) => (
                <Link
                  key={tip.label}
                  href={tip.href}
                  className={cn(
                    'group block rounded-xl border p-4 transition-all',
                    tip.bg,
                    tip.border,
                    tip.hover,
                  )}
                >
                  <p className={cn('text-sm font-bold mb-2', tip.color)}>{tip.label}</p>
                  <p className="text-sm text-foreground/70 leading-relaxed mb-4">{tip.action}</p>
                  <span
                    className={cn(
                      'text-sm font-semibold inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform',
                      tip.color,
                    )}
                  >
                    Doties <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
