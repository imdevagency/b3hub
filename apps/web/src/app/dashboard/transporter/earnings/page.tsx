/**
 * Transporter earnings page — /dashboard/transporter/earnings
 * Revenue breakdown and invoice history for the carrier.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMyTransportJobs, type ApiTransportJob, setupPayouts } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

// ── types ─────────────────────────────────────────────────────────────────────

interface EarningsStats {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  completedJobs: number;
  pendingPayout: number;
}

interface HistoryEntry {
  id: string;
  jobNumber: string;
  date: string;
  rawDate: Date;
  route: string;
  amount: number;
  status: 'delivered' | 'active';
}

interface DayBar {
  label: string;
  shortLabel: string;
  amount: number;
  isToday: boolean;
}

type Period = 'today' | 'week' | 'month';

const ACTIVE_STATUSES = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
];
const LV_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];

function euro(v: number) {
  return `€${v.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildDailyChart(jobs: ApiTransportJob[]): DayBar[] {
  const now = new Date();
  const bars: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const nextD = new Date(d.getTime() + 86_400_000);
    const amount = jobs
      .filter((j) => {
        if (j.status !== 'DELIVERED') return false;
        const jd = new Date(j.deliveryDate ?? j.pickupDate);
        return jd >= d && jd < nextD;
      })
      .reduce((sum, j) => sum + (j.rate ?? 0), 0);
    bars.push({
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      shortLabel: i === 0 ? 'Šod' : LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }
  return bars;
}

function computeStats(jobs: ApiTransportJob[]): {
  stats: EarningsStats;
  history: HistoryEntry[];
  chart: DayBar[];
} {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayEarnings = 0,
    weekEarnings = 0,
    monthEarnings = 0,
    completedJobs = 0,
    pendingPayout = 0;
  const history: HistoryEntry[] = [];

  for (const job of jobs) {
    const d = new Date(job.deliveryDate ?? job.pickupDate);
    const rate = job.rate ?? 0;
    if (job.status === 'DELIVERED') {
      completedJobs++;
      if (d >= todayStart) todayEarnings += rate;
      if (d >= weekStart) weekEarnings += rate;
      if (d >= monthStart) monthEarnings += rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: d,
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: rate,
        status: 'delivered',
      });
    } else if (ACTIVE_STATUSES.includes(job.status)) {
      pendingPayout += rate;
      const pd = new Date(job.pickupDate);
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: pd.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: pd,
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: rate,
        status: 'active',
      });
    }
  }

  history.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  const chart = buildDailyChart(jobs);

  return {
    stats: { todayEarnings, weekEarnings, monthEarnings, completedJobs, pendingPayout },
    history,
    chart,
  };
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-sm ${color}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  delivered: { label: 'Pabeigts', variant: 'default' as const },
  active: { label: 'Aktīvs', variant: 'secondary' as const },
};

type Period2 = Period;
const PERIOD_LABELS: Record<Period2, string> = {
  today: 'Šodien',
  week: 'Šonedēļ',
  month: 'Šomēnes',
};

// ── page ─────────────────────────────────────────────────────────────────────

export default function TransporterEarningsPage() {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [setupLoading, setSetupLoading] = useState(false);

  const handleSetupPayouts = async () => {
    try {
      setSetupLoading(true);
      if (!token) return;
      const { url } = await setupPayouts(token);
      window.location.href = url;
    } catch (err) {
      console.error('Failed to setup payouts', err);
    } finally {
      setSetupLoading(false);
    }
  };

  const load = async (showRefresh = false) => {
    if (!token) return;
    if (showRefresh) setRefreshing(true);
    try {
      const data = await getMyTransportJobs(token);
      setJobs(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const { stats, history, chart } = computeStats(jobs);
  const maxChart = Math.max(...chart.map((b) => b.amount), 1);

  const periodEarnings =
    period === 'today'
      ? stats.todayEarnings
      : period === 'week'
        ? stats.weekEarnings
        : stats.monthEarnings;

  return (
    <div className="space-y-8 pb-12 w-full">
      {/* header */}
      <PageHeader
        title="Ienākumi"
        description="Transporta darbu ienākumu pārskats"
        action={
          <Button
            variant="outline"
            className="rounded-full bg-muted/40 border-0 hover:bg-muted/80 shadow-none px-4"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunināt
          </Button>
        }
      />

      {user?.isCompany && user.payoutEnabled === false && (
        <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-700 dark:text-blue-400">Enable Payouts</CardTitle>
            <CardDescription className="text-blue-600/90 dark:text-blue-400/90">
              You must set up a payout method to receive funds from completed transport jobs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSetupPayouts}
              disabled={setupLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {setupLoading ? 'Redirecting...' : 'Setup Payouts with Stripe'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* period tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              period === p
                ? 'bg-background shadow-xs text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* main earnings highlight */}
      <div className="rounded-3xl bg-zinc-950 p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Banknote className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <p className="text-sm font-medium text-zinc-400">{PERIOD_LABELS[period]} ienākumi</p>
          <p className="text-5xl font-bold mt-2 tabular-nums tracking-tight">
            {euro(periodEarnings)}
          </p>
          <div className="flex gap-8 mt-8 text-sm text-zinc-300">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white">{stats.completedJobs}</span> pabeigti darbi
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-white">{euro(stats.pendingPayout)}</span> gaidāmie
            </span>
          </div>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          label="Šodien"
          value={euro(stats.todayEarnings)}
          icon={Banknote}
          color="text-zinc-900"
        />
        <StatCard
          label="Šonedēļ"
          value={euro(stats.weekEarnings)}
          icon={TrendingUp}
          color="text-zinc-900"
        />
        <StatCard
          label="Šomēnes"
          value={euro(stats.monthEarnings)}
          icon={BarChart3}
          color="text-zinc-900"
        />
        <StatCard
          label="Pabeigti darbi"
          value={String(stats.completedJobs)}
          icon={CheckCircle}
          color="text-zinc-900"
        />
        <StatCard
          label="Gaidāmie"
          value={euro(stats.pendingPayout)}
          icon={Clock}
          color="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-day bar chart */}
        <div className="lg:col-span-1 rounded-3xl bg-muted/30 p-6 flex flex-col">
          <div className="mb-6">
            <h2 className="text-base font-semibold">Ienākumi (7 dienas)</h2>
            <p className="text-sm text-muted-foreground mt-1">Sadalījums pa dienām</p>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            {loading ? (
              <div className="h-32 bg-muted/50 animate-pulse rounded-xl" />
            ) : (
              <div className="flex items-end gap-3 h-32">
                {chart.map((bar) => {
                  const heightPct = maxChart > 0 ? (bar.amount / maxChart) * 100 : 0;
                  return (
                    <div
                      key={bar.label}
                      className="flex-1 flex flex-col items-center gap-2 group relative"
                    >
                      <div className="w-full flex items-end justify-center h-24">
                        <div
                          className={`w-full rounded-md transition-all duration-500 ease-out group-hover:opacity-80 ${bar.isToday ? 'bg-zinc-900' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                          style={{ height: `${Math.max(heightPct, bar.amount > 0 ? 8 : 4)}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium ${bar.isToday ? 'text-zinc-900 font-bold' : 'text-muted-foreground'}`}
                      >
                        {bar.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* job history */}
        <div className="lg:col-span-2 rounded-3xl bg-muted/30 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold">Darbu vēsture</h2>
              <p className="text-sm text-muted-foreground mt-1">Pēdējie veiktie darbi</p>
            </div>
            <Badge variant="secondary" className="rounded-full px-3 font-medium bg-background">
              {history.length}
            </Badge>
          </div>

          <div className="-mx-2">
            {loading ? (
              <div className="space-y-4 px-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Truck className="h-12 w-12 text-muted mb-4" />
                <p className="text-base font-medium">Nav darbu vēstures</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Šeit parādīsies pabeigtie un aktīvie darbi
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-background/80 rounded-2xl transition-colors group"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                        <Truck className="h-5 w-5 text-zinc-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-zinc-900">
                            #{entry.jobNumber}
                          </span>
                          <Badge
                            variant={cfg.variant}
                            className="text-[10px] uppercase tracking-wider font-bold h-5 px-2 rounded-md shadow-none"
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {entry.route} <span className="opacity-50 mx-1">•</span> {entry.date}
                        </p>
                      </div>
                      <span className="text-lg font-bold tabular-nums tracking-tight shrink-0">
                        {euro(entry.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
