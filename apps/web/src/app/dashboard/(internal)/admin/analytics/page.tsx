/**
 * Admin — Platformas analītika
 * /dashboard/admin/analytics
 *
 * GMV trend, order volumes, active users/companies, revenue breakdown.
 * Uses getAdminStats (monthly trends, gmv30d, commissionEst30d) +
 * adminGetFinanceStats (revenueByType, monthly revenue).
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Euro,
  Leaf,
  Loader2,
  PackagePlus,
  Recycle,
  ShoppingBag,
  Truck,
  Users,
  Weight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getAdminStats,
  adminGetFinanceStats,
  adminGetCircularEconomyStats,
  type AdminStats,
  type AdminFinanceStats,
  type CircularEconomyStats,
} from '@/lib/api/admin';

// ─── helpers ──────────────────────────────────────────────────────────────────

function eur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

function num(n: number) {
  return (n ?? 0).toLocaleString('lv-LV');
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('lv-LV', {
    month: 'short',
    year: '2-digit',
  });
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-foreground',
  bg = 'bg-muted',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  bg?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({
  label,
  value,
  max,
  formatValue,
  color = 'bg-blue-500',
}: {
  label: string;
  value: number;
  max: number;
  formatValue?: (v: number) => string;
  color?: string;
}) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  const display = formatValue ? formatValue(value) : value.toLocaleString('lv-LV');
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-foreground">
        {display}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { token } = useAuth();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [finance, setFinance] = useState<AdminFinanceStats | null>(null);
  const [ce, setCe] = useState<CircularEconomyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, financeRes, ceRes] = await Promise.allSettled([
        getAdminStats(token),
        adminGetFinanceStats(token),
        adminGetCircularEconomyStats(token),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (financeRes.status === 'fulfilled') setFinance(financeRes.value);
      if (ceRes.status === 'fulfilled') setCe(ceRes.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const trends = useMemo(() => stats?.monthlyTrends ?? [], [stats]);
  const maxGmv = useMemo(() => Math.max(...trends.map((t) => t.gmv), 1), [trends]);
  const maxOrders = useMemo(() => Math.max(...trends.map((t) => t.orders), 1), [trends]);

  // ── Demand forecast (simple linear projection from last 6 months) ────────────
  const forecast = useMemo(() => {
    const recent = trends.slice(-6);
    if (recent.length < 2) return null;

    function linProject(values: number[], n: number): number[] {
      const m = values.length;
      const xMean = (m - 1) / 2;
      const yMean = values.reduce((a, b) => a + b, 0) / m;
      const num = values.reduce((sum, y, i) => sum + (i - xMean) * (y - yMean), 0);
      const den = values.reduce((sum, _, i) => sum + (i - xMean) ** 2, 0);
      const b = den > 0 ? num / den : 0;
      const a = yMean - b * xMean;
      return Array.from({ length: n }, (_, i) => Math.max(0, Math.round(a + b * (m + i))));
    }

    const projGmv = linProject(
      recent.map((t) => t.gmv),
      3,
    );
    const projOrders = linProject(
      recent.map((t) => t.orders),
      3,
    );

    // Compute next 3 month keys
    const last = recent[recent.length - 1].month;
    const [yr, mo] = last.split('-').map(Number);
    const futureMonths = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(yr, mo - 1 + i + 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    return futureMonths.map((month, i) => ({
      month,
      gmv: projGmv[i],
      orders: projOrders[i],
      isForecast: true,
    }));
  }, [trends]);

  const forecastMaxGmv = useMemo(() => {
    if (!forecast) return maxGmv;
    return Math.max(maxGmv, ...forecast.map((f) => f.gmv), 1);
  }, [maxGmv, forecast]);

  const forecastMaxOrders = useMemo(() => {
    if (!forecast) return maxOrders;
    return Math.max(maxOrders, ...forecast.map((f) => f.orders), 1);
  }, [maxOrders, forecast]);

  const pipelineTotal = useMemo(
    () => Object.values(stats?.orderPipeline ?? {}).reduce((s, v) => s + v, 0),
    [stats],
  );

  const revenueByType = useMemo(() => {
    if (!finance || !('revenueByType' in finance) || !(finance as any).revenueByType) return [];
    return Object.entries((finance as any).revenueByType as Record<string, number>).sort(([, a], [, b]) => b - a);
  }, [finance]);

  const maxTypeRevenue = useMemo(
    () => Math.max(...revenueByType.map(([, v]) => v), 1),
    [revenueByType],
  );

  const monthlyRevenue = useMemo(() => (finance as any)?.monthlyRevenue ?? [], [finance]);
  const maxMonthlyRevenue = useMemo(
    () => Math.max(...monthlyRevenue.map((m: any) => m.revenue ?? m.amount ?? 0), 1),
    [monthlyRevenue],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Platformas analītika"
        description="Bilt tirgus apjomi, ieņēmumi un darbības rādītāji"
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Ielādē…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* ── Top KPIs ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="GMV (pēdējie 30 d)"
              value={eur(stats.gmv30d)}
              sub={`Kopā: ${eur(stats.gmvAllTime)}`}
              icon={Euro}
              color="text-green-600"
              bg="bg-green-50"
            />
            <KpiCard
              label="Komisija est. (30 d)"
              value={eur(stats.commissionEst30d)}
              sub="Platforma ieņēmumi"
              icon={BarChart3}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <KpiCard
              label="Kopējie pasūtījumi"
              value={num(stats.totalOrders)}
              sub={`${num(stats.ordersToday ?? 0)} šodien`}
              icon={ShoppingBag}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <KpiCard
              label="Lietotāji"
              value={num(stats.totalUsers)}
              sub={`${num(stats.totalCompanies)} uzņēmumi`}
              icon={Users}
              color="text-purple-600"
              bg="bg-purple-50"
            />
          </div>

          {/* ── Secondary KPIs ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              label="Aktīvie piegādātāji"
              value={num(stats.activeSuppliers ?? 0)}
              icon={CheckCircle2}
              color="text-teal-600"
              bg="bg-teal-50"
            />
            <KpiCard
              label="Aktīvie pārvadātāji"
              value={num(stats.activeCarriers ?? 0)}
              icon={Truck}
              color="text-orange-600"
              bg="bg-orange-50"
            />
            <KpiCard
              label="Aktīvie darbi"
              value={num(stats.activeJobs)}
              icon={ArrowUpRight}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <KpiCard
              label="Neatrisināti strīdi"
              value={num(stats.openDisputes)}
              icon={AlertCircle}
              color={stats.openDisputes > 0 ? 'text-red-600' : 'text-muted-foreground'}
              bg={stats.openDisputes > 0 ? 'bg-red-50' : 'bg-muted'}
            />
          </div>

          <Tabs defaultValue="gmv">
            <TabsList>
              <TabsTrigger value="gmv">GMV tendences</TabsTrigger>
              <TabsTrigger value="orders">Pasūtījumu apjoms</TabsTrigger>
              <TabsTrigger value="revenue">Ieņēmumu sadalījums</TabsTrigger>
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="circular">Aprite ♻️</TabsTrigger>
              <TabsTrigger value="forecast">Prognoze 📈</TabsTrigger>
            </TabsList>

            {/* ── GMV trends ── */}
            <TabsContent value="gmv" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    GMV pa mēnešiem (pēdējie {trends.length} mēneši)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {trends.length === 0 && <p className="text-sm text-muted-foreground">Nav datu</p>}
                  {trends.slice(-12).map((t) => (
                    <HBar
                      key={t.month}
                      label={monthLabel(t.month)}
                      value={t.gmv}
                      max={maxGmv}
                      formatValue={eur}
                      color="bg-green-500"
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Order volume ── */}
            <TabsContent value="orders" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Pasūtījumu skaits pa mēnešiem
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {trends.length === 0 && <p className="text-sm text-muted-foreground">Nav datu</p>}
                  {trends.slice(-12).map((t) => (
                    <HBar
                      key={t.month}
                      label={monthLabel(t.month)}
                      value={t.orders}
                      max={maxOrders}
                      color="bg-blue-500"
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Revenue by type ── */}
            <TabsContent value="revenue" className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {finance && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Ieņēmumi pēc veida</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        {revenueByType.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nav datu</p>
                        ) : (
                          revenueByType.map(([type, value]) => (
                            <HBar
                              key={type}
                              label={type}
                              value={value}
                              max={maxTypeRevenue}
                              formatValue={eur}
                              color="bg-purple-500"
                            />
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Finanšu kopsavilkums</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableBody>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Kopējie ieņēmumi
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {eur((finance as any)?.totalRevenue ?? 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Platforma maksas
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {eur((finance as any)?.platformFees ?? 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Gaida izmaksas
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums text-amber-600">
                                {eur((finance as any)?.pendingPayouts ?? 0)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Pabeigtas izmaksas
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums text-green-600">
                                {eur((finance as any)?.completedPayouts ?? 0)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}

                {monthlyRevenue.length > 0 && (
                  <Card className="sm:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Mēneša ieņēmumi</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {monthlyRevenue.slice(-12).map((m: any) => (
                        <HBar
                          key={m.month}
                          label={monthLabel(m.month)}
                          value={m.revenue ?? (m as { amount?: number }).amount ?? 0}
                          max={maxMonthlyRevenue}
                          formatValue={eur}
                          color="bg-teal-500"
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ── Pipeline ── */}
            <TabsContent value="pipeline" className="pt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Pasūtījumu pipeline ({num(pipelineTotal)} kopā)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {Object.keys(stats.orderPipeline ?? {}).length === 0 ? (
                    <div className="px-6 py-4 text-sm text-muted-foreground">Nav datu</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Statuss</TableHead>
                          <TableHead className="text-right">Skaits</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(stats.orderPipeline)
                          .sort(([, a], [, b]) => b - a)
                          .map(([status, count]) => (
                            <TableRow key={status}>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{count}</TableCell>
                              <TableCell className="text-right tabular-nums text-muted-foreground">
                                {pipelineTotal > 0
                                  ? `${((count / pipelineTotal) * 100).toFixed(0)}%`
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* ── Circular Economy ── */}
            <TabsContent value="circular" className="pt-4">
              {!ce ? (
                <p className="text-sm text-muted-foreground">Nav datu</p>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* KPIs */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <KpiCard
                      label="Kopā pieņemts"
                      value={`${ce.totalWasteInTonnes.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`}
                      sub={`${ce.totalRecyclableTonnes.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t atgūstami`}
                      icon={Weight}
                      color="text-amber-600"
                      bg="bg-amber-50"
                    />
                    <KpiCard
                      label="Pārstrādes likme"
                      value={`${ce.avgRecoveryRate.toFixed(0)}%`}
                      sub={`${ce.totalConvertedCount} ieraksti tirgū`}
                      icon={Recycle}
                      color="text-green-600"
                      bg="bg-green-50"
                    />
                    <KpiCard
                      label="CO₂ ietaupīts"
                      value={`${ce.co2SavedTonnes.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`}
                      sub="0,35 t CO₂e/t novirzīts"
                      icon={Leaf}
                      color="text-teal-600"
                      bg="bg-teal-50"
                    />
                    <KpiCard
                      label="Gaida konversiju"
                      value={ce.pendingConversionCount}
                      sub={`${ce.pendingConversionTonnes.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t nav sarakstā`}
                      icon={PackagePlus}
                      color={
                        ce.pendingConversionCount > 0 ? 'text-orange-600' : 'text-muted-foreground'
                      }
                      bg={ce.pendingConversionCount > 0 ? 'bg-orange-50' : 'bg-muted'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <KpiCard
                      label="Aktīvie saraksti"
                      value={ce.activeMaterialListings}
                      sub="Pārstrādāti materiāli tirgū"
                      icon={PackagePlus}
                      color="text-blue-600"
                      bg="bg-blue-50"
                    />
                    <KpiCard
                      label="Ieņēmumi no RC"
                      value={eur(ce.revenueFromRecycledMaterials)}
                      sub={`${ce.quantitySoldTonnes.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t pārdots`}
                      icon={Euro}
                      color="text-green-600"
                      bg="bg-green-50"
                    />
                    <KpiCard
                      label="Konvertēts (t)"
                      value={`${ce.totalConvertedTonnes.toLocaleString('lv-LV', { maximumFractionDigits: 1 })} t`}
                      sub="No atkritumu plūsmas"
                      icon={Recycle}
                      color="text-purple-600"
                      bg="bg-purple-50"
                    />
                    <KpiCard
                      label="Aprites koeficients"
                      value={
                        ce.totalWasteInTonnes > 0
                          ? `${((ce.totalConvertedTonnes / ce.totalWasteInTonnes) * 100).toFixed(0)}%`
                          : '—'
                      }
                      sub="Konvertēts / pieņemts"
                      icon={Recycle}
                      color="text-indigo-600"
                      bg="bg-indigo-50"
                    />
                  </div>

                  {/* Monthly trend */}
                  {ce.monthlyTrend.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">
                            Atkritumu apjoms pa mēnešiem (t)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          {ce.monthlyTrend.map((m) => (
                            <HBar
                              key={m.month}
                              label={monthLabel(m.month)}
                              value={m.wasteIn}
                              max={Math.max(...ce.monthlyTrend.map((x) => x.wasteIn), 1)}
                              color="bg-amber-500"
                            />
                          ))}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">
                            Pārstrādāts un konvertēts (t)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          {ce.monthlyTrend.map((m) => (
                            <div key={m.month} className="flex flex-col gap-1">
                              <HBar
                                label={monthLabel(m.month)}
                                value={m.recycled}
                                max={Math.max(...ce.monthlyTrend.map((x) => x.recycled), 1)}
                                color="bg-green-500"
                              />
                              <HBar
                                label=""
                                value={m.converted}
                                max={Math.max(...ce.monthlyTrend.map((x) => x.recycled), 1)}
                                color="bg-teal-400"
                              />
                            </div>
                          ))}
                          <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-3 rounded bg-green-500" />
                              Pārstrādāts
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="inline-block h-2 w-3 rounded bg-teal-400" />
                              Konvertēts
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Action link */}
                  {ce.pendingConversionCount > 0 && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between">
                      <div className="text-sm text-orange-800">
                        <span className="font-semibold">{ce.pendingConversionCount} ieraksti</span>{' '}
                        ({ce.pendingConversionTonnes.toFixed(1)} t) ir apstrādāti bet vēl nav
                        pievienoti tirgum.
                      </div>
                      <a
                        href="/dashboard/b3-recycling/waste-log"
                        className="text-sm font-medium text-orange-700 hover:underline"
                      >
                        Atvērt žurnālu →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Demand Forecast ── */}
            <TabsContent value="forecast" className="pt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    GMV prognoze — nākamie 3 mēneši (lineārā ekstrapolācija no pēdējiem 6 mēnešiem)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {trends.length < 2 && (
                    <p className="text-sm text-muted-foreground">
                      Nepietiek datu prognozei (vajadzīgi vismaz 2 mēneši).
                    </p>
                  )}
                  {/* Historical */}
                  {trends.slice(-6).map((t) => (
                    <HBar
                      key={t.month}
                      label={monthLabel(t.month)}
                      value={t.gmv}
                      max={forecastMaxGmv}
                      formatValue={eur}
                      color="bg-green-500"
                    />
                  ))}
                  {/* Divider */}
                  {forecast && forecast.length > 0 && (
                    <div className="flex items-center gap-3 py-1">
                      <span className="w-32 shrink-0 text-xs text-muted-foreground/60">
                        Prognozētais
                      </span>
                      <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                    </div>
                  )}
                  {/* Forecast */}
                  {forecast?.map((f) => (
                    <HBar
                      key={f.month}
                      label={`${monthLabel(f.month)} *`}
                      value={f.gmv}
                      max={forecastMaxGmv}
                      formatValue={eur}
                      color="bg-blue-400"
                    />
                  ))}
                  {forecast && (
                    <p className="text-xs text-muted-foreground pt-1">
                      * Prognoze balstīta uz lineāras tendences aprēķinu no pēdējiem 6 mēnešiem.
                      Reālie rezultāti var atšķirties.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Pasūtījumu skaita prognoze — nākamie 3 mēneši
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {trends.slice(-6).map((t) => (
                    <HBar
                      key={t.month}
                      label={monthLabel(t.month)}
                      value={t.orders}
                      max={forecastMaxOrders}
                      color="bg-blue-500"
                    />
                  ))}
                  {forecast && forecast.length > 0 && (
                    <div className="flex items-center gap-3 py-1">
                      <span className="w-32 shrink-0 text-xs text-muted-foreground/60">
                        Prognozētais
                      </span>
                      <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                    </div>
                  )}
                  {forecast?.map((f) => (
                    <HBar
                      key={f.month}
                      label={`${monthLabel(f.month)} *`}
                      value={f.orders}
                      max={forecastMaxOrders}
                      color="bg-purple-400"
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
