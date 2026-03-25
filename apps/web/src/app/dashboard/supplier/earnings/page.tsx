/**
 * Supplier earnings page — /dashboard/supplier/earnings
 * Displays revenue breakdown, invoice history, and payment status for the supplier.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getMyOrders, type ApiOrder, setupPayouts } from '@/lib/api';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle,
  Package,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

// ── types ─────────────────────────────────────────────────────────────────────

interface RevenueStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalOrders: number;
  pendingRevenue: number;
  avgOrderValue: number;
}

interface OrderEntry {
  id: string;
  orderNumber: string;
  buyerName: string;
  date: string;
  rawDate: Date;
  amount: number;
  status: 'confirmed' | 'pending' | 'delivered';
}

interface DayBar {
  label: string;
  shortLabel: string;
  amount: number;
  isToday: boolean;
}

type Period = 'today' | 'week' | 'month';

// ── helpers ───────────────────────────────────────────────────────────────────

const REVENUE_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'IN_PROGRESS',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
];
const PENDING_STATUSES = ['PENDING'];

const LV_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];

function euro(v: number) {
  return `€${v.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeRevenue(orders: ApiOrder[]): {
  stats: RevenueStats;
  entries: OrderEntry[];
  chart: DayBar[];
} {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayRevenue = 0,
    weekRevenue = 0,
    monthRevenue = 0,
    pendingRevenue = 0;
  const entries: OrderEntry[] = [];

  for (const order of safeOrders) {
    const d = new Date(order.createdAt);
    const amount = order.total ?? 0;
    if (REVENUE_STATUSES.includes(order.status)) {
      if (d >= todayStart) todayRevenue += amount;
      if (d >= weekStart) weekRevenue += amount;
      if (d >= monthStart) monthRevenue += amount;
      entries.push({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer
          ? `${order.buyer.firstName ?? ''} ${order.buyer.lastName ?? ''}`.trim()
          : 'Pircējs',
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: d,
        amount,
        status:
          order.status === 'DELIVERED' || order.status === 'COMPLETED' ? 'delivered' : 'confirmed',
      });
    } else if (PENDING_STATUSES.includes(order.status)) {
      pendingRevenue += amount;
      entries.push({
        id: order.id,
        orderNumber: order.orderNumber,
        buyerName: order.buyer
          ? `${order.buyer.firstName ?? ''} ${order.buyer.lastName ?? ''}`.trim()
          : 'Pircējs',
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        rawDate: d,
        amount,
        status: 'pending',
      });
    }
  }

  const confirmedOrders = safeOrders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const avgOrderValue =
    confirmedOrders.length > 0
      ? confirmedOrders.reduce((s, o) => s + (o.total ?? 0), 0) / confirmedOrders.length
      : 0;

  // Build 7-day chart
  const chart: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const nextD = new Date(d.getTime() + 86_400_000);
    const amount = safeOrders
      .filter((o) => {
        if (!REVENUE_STATUSES.includes(o.status)) return false;
        const od = new Date(o.createdAt);
        return od >= d && od < nextD;
      })
      .reduce((s, o) => s + (o.total ?? 0), 0);
    chart.push({
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      shortLabel: i === 0 ? 'Šod' : LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }

  entries.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  return {
    stats: {
      todayRevenue,
      weekRevenue,
      monthRevenue,
      totalOrders: confirmedOrders.length,
      pendingRevenue,
      avgOrderValue,
    },
    entries,
    chart,
  };
}

const PERIOD_REVENUE: Record<Period, keyof RevenueStats> = {
  today: 'todayRevenue',
  week: 'weekRevenue',
  month: 'monthRevenue',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  delivered: { label: 'Piegādāts', variant: 'default' },
  confirmed: { label: 'Apstiprināts', variant: 'secondary' },
  pending: { label: 'Gaida', variant: 'outline' },
};

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
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
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function SupplierEarningsPage() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
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
      const data = await getMyOrders(token);
      setOrders(data);
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

  const { stats, entries, chart } = computeRevenue(orders);
  const maxChart = Math.max(...chart.map((b) => b.amount), 1);
  const periodRevenue = stats[PERIOD_REVENUE[period]] as number;

  const PERIOD_LABELS: Record<Period, string> = {
    today: 'Šodien',
    week: 'Šonedēļ',
    month: 'Šomēnes',
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* header */}
      <PageHeader
        title="Ieņēmumi"
        description="Pārdēšanas apgrozijums un pasūtījumu vēsture"
        action={
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunināt
          </Button>
        }
      />

      {user?.isCompany && user.payoutEnabled === false && (
        <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-amber-700 dark:text-amber-400">Enable Payouts</CardTitle>
            <CardDescription className="text-amber-600/90 dark:text-amber-400/90">
              You must set up a payout method to receive funds from your sales directly to your bank
              account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleSetupPayouts}
              disabled={setupLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {setupLoading ? 'Redirecting...' : 'Setup Payouts with Stripe'}
            </Button>
          </CardContent>
        </Card>
      )}

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

      {/* main revenue highlight */}
      <div className="rounded-2xl bg-linear-to-br from-emerald-600 to-emerald-500 p-6 text-white">
        <p className="text-sm font-medium opacity-80">{PERIOD_LABELS[period]} ieņēmumi</p>
        <p className="text-4xl font-extrabold mt-1 tabular-nums">{euro(periodRevenue)}</p>
        <div className="flex gap-6 mt-4 text-sm opacity-90">
          <span>
            <span className="font-semibold">{stats.totalOrders}</span> pasūtījumi
          </span>
          <span>
            Vid. <span className="font-semibold">{euro(stats.avgOrderValue)}</span>
          </span>
          <span className="text-yellow-200">{euro(stats.pendingRevenue)} gaida</span>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Šodien"
          value={euro(stats.todayRevenue)}
          icon={Banknote}
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Šonedēļ"
          value={euro(stats.weekRevenue)}
          icon={TrendingUp}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label="Šomēnes"
          value={euro(stats.monthRevenue)}
          icon={BarChart3}
          color="bg-violet-100 text-violet-700"
        />
        <StatCard
          label="Pasūtījumi"
          value={String(stats.totalOrders)}
          icon={Package}
          color="bg-gray-100 text-gray-700"
        />
        <StatCard
          label="Gaida apmaksu"
          value={euro(stats.pendingRevenue)}
          icon={Clock}
          color="bg-yellow-100 text-yellow-700"
        />
        <StatCard
          label="Vid. pasūtījums"
          value={euro(stats.avgOrderValue)}
          icon={CheckCircle}
          color="bg-pink-100 text-pink-700"
        />
      </div>

      {/* 7-day bar chart */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold">Pēdējās 7 dienas</h2>
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
                        className={`w-full rounded-t-md transition-all ${bar.isToday ? 'bg-emerald-500' : 'bg-emerald-200'}`}
                        style={{ height: `${Math.max(heightPct, bar.amount > 0 ? 4 : 2)}%` }}
                        title={euro(bar.amount)}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${bar.isToday ? 'text-emerald-700' : 'text-muted-foreground'}`}
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

      {/* order history */}
      <Card className="shadow-none border-border/50">
        <CardHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
          <h2 className="text-sm font-semibold">Pasūtījumu vēsture</h2>
          <span className="text-xs text-muted-foreground">{entries.length} ieraksti</span>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {loading ? (
            <div className="space-y-3 px-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground px-5 py-4">Nav pasūtījumu</p>
          ) : (
            <div className="divide-y divide-border">
              {entries.map((entry) => {
                const cfg = STATUS_CONFIG[entry.status];
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          #{entry.orderNumber}
                        </span>
                        <Badge variant={cfg.variant} className="text-[10px] h-4 px-1.5">
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.buyerName} · {entry.date}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-emerald-700 shrink-0">
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
