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
  Loader2,
  ShoppingBag,
  Truck,
  Users,
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
  type AdminStats,
  type AdminFinanceStats,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, financeRes] = await Promise.allSettled([
        getAdminStats(token),
        adminGetFinanceStats(token),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (financeRes.status === 'fulfilled') setFinance(financeRes.value);
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

  const pipelineTotal = useMemo(
    () => Object.values(stats?.orderPipeline ?? {}).reduce((s, v) => s + v, 0),
    [stats],
  );

  const revenueByType = useMemo(() => {
    if (!finance?.revenueByType) return [];
    return Object.entries(finance.revenueByType).sort(([, a], [, b]) => b - a);
  }, [finance]);

  const maxTypeRevenue = useMemo(
    () => Math.max(...revenueByType.map(([, v]) => v), 1),
    [revenueByType],
  );

  const monthlyRevenue = useMemo(() => finance?.monthlyRevenue ?? [], [finance]);
  const maxMonthlyRevenue = useMemo(
    () => Math.max(...monthlyRevenue.map((m) => m.revenue ?? m.amount ?? 0), 1),
    [monthlyRevenue],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Platformas analītika"
        description="B3Hub tirgus apjomi, ieņēmumi un darbības rādītāji"
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
                                {eur(finance.totalRevenue)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Platforma maksas
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {eur(finance.platformFees)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Gaida izmaksas
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums text-amber-600">
                                {eur(finance.pendingPayouts)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="text-sm text-muted-foreground">
                                Pabeigtas izmaksas
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums text-green-600">
                                {eur(finance.completedPayouts)}
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
                      {monthlyRevenue.slice(-12).map((m) => (
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
          </Tabs>
        </>
      )}
    </div>
  );
}
