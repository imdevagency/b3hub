/**
 * Transporter earnings page — /dashboard/transporter/earnings
 * Revenue breakdown and invoice history for the carrier.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMyTransportJobs, type ApiTransportJob } from '@/lib/api';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card className="shadow-none border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-4 px-4">
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
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
  const { token } = useAuth();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');

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
    <div className="space-y-6 max-w-5xl">
      {/* header */}
      <PageHeader
        title="Ienākumi"
        description="Transporta darbu ienākumu pārskats"
        action={
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunināt
          </Button>
        }
      />

      {/* period tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === p
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* main earnings highlight */}
      <div className="rounded-2xl bg-linear-to-br from-primary to-primary/90 p-6 text-white">
        <p className="text-sm font-medium opacity-80">{PERIOD_LABELS[period]} ienākumi</p>
        <p className="text-4xl font-extrabold mt-1 tabular-nums">{euro(periodEarnings)}</p>
        <div className="flex gap-6 mt-4 text-sm opacity-90">
          <span>
            <span className="font-semibold">{stats.completedJobs}</span> pabeigti darbi
          </span>
          <span className="text-yellow-200">{euro(stats.pendingPayout)} gaidāmie</span>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Šodien"
          value={euro(stats.todayEarnings)}
          icon={Banknote}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          label="Šonedēļ"
          value={euro(stats.weekEarnings)}
          icon={TrendingUp}
          color="bg-orange-100 text-orange-700"
        />
        <StatCard
          label="Šomēnes"
          value={euro(stats.monthEarnings)}
          icon={BarChart3}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label="Pabeigti darbi"
          value={String(stats.completedJobs)}
          icon={CheckCircle}
          color="bg-gray-100 text-gray-700"
        />
        <StatCard
          label="Gaidāmie"
          value={euro(stats.pendingPayout)}
          icon={Clock}
          color="bg-yellow-100 text-yellow-700"
        />
      </div>

      {/* 7-day bar chart */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold">Ienākumi — pēdējās 7 dienas</h2>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {loading ? (
            <div className="h-28 bg-muted animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-end gap-2 h-28">
              {chart.map((bar) => {
                const heightPct = maxChart > 0 ? (bar.amount / maxChart) * 100 : 0;
                return (
                  <div key={bar.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: 88 }}>
                      <div
                        className={`w-full rounded-t-md transition-all ${bar.isToday ? 'bg-primary' : 'bg-primary/30'}`}
                        style={{ height: `${Math.max(heightPct, bar.amount > 0 ? 4 : 2)}%` }}
                        title={euro(bar.amount)}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${bar.isToday ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {bar.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* job history */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
          <h2 className="text-sm font-semibold">Darbu vēsture</h2>
          <span className="text-xs text-muted-foreground">{history.length} ieraksti</span>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {loading ? (
            <div className="space-y-3 px-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-4">Nav darbu vēstures</p>
          ) : (
            <div className="divide-y divide-border">
              {history.map((entry) => {
                const cfg = STATUS_CONFIG[entry.status];
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{entry.jobNumber}</span>
                        <Badge variant={cfg.variant} className="text-[10px] h-4 px-1.5">
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.route} · {entry.date}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-red-700 shrink-0">
                      {euro(entry.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
