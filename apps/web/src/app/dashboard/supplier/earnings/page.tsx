/**
 * Supplier earnings page — /dashboard/supplier/earnings
 * Displays revenue breakdown, invoice history, and payment status for the supplier.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getMyOrders, type ApiOrder, setupPayouts } from '@/lib/api';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
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
  { label: string; variant: 'default' | 'secondary' | 'outline'; className: string }
> = {
  delivered: {
    label: 'Piegādāts',
    variant: 'default',
    className:
      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50',
  },
  confirmed: {
    label: 'Apstiprināts',
    variant: 'secondary',
    className:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50',
  },
  pending: {
    label: 'Gaida',
    variant: 'outline',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50',
  },
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
  const router = useRouter();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('week');
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    if (!user) router.push('/login');
    else if (user && !user.canSell) router.push('/dashboard');
  }, [user, router]);

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
    <div className="space-y-12 pb-10">
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
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400">
              Pievienojiet izmaksu kontu
            </h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mt-1 mb-3">
              Pievienojiet savu bankas kontu (caur Stripe), lai varētu saņemt maksājumus par
              pasūtījumiem.
            </p>
            <Button
              onClick={handleSetupPayouts}
              disabled={setupLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-4 text-xs"
            >
              {setupLoading ? 'Notiek apstrāde...' : 'Pievienot bankas kontu'}
            </Button>
          </div>
        </div>
      )}

      {/* Minimal Hero Period & Balance */}
      <div className="flex flex-col items-start gap-5">
        {/* period tabs */}
        <div className="flex gap-6 border-b border-border/60 w-full pb-2">
          {(['today', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`pb-2 text-sm font-medium transition-all relative -mb-2.25 ${
                period === p
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="pt-2 w-full">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {PERIOD_LABELS[period]} ieņēmumi
          </p>
          <h1 className="text-6xl md:text-7xl font-semibold tracking-tight text-foreground tabular-nums">
            {euro(periodRevenue)}
          </h1>

          {/* Minimal Key Stats Row */}
          <div className="flex items-center gap-8 mt-10 pt-6 border-t border-border/40">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-medium text-foreground tabular-nums">
                {stats.totalOrders}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Pasūtījumi
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-medium text-foreground tabular-nums">
                {euro(stats.avgOrderValue)}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Vid. Pasūtījums
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-medium text-foreground tabular-nums">
                {euro(stats.pendingRevenue)}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Gaida apmaksu
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-day bar chart (Uber style) */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <h2 className="text-sm font-medium text-muted-foreground">Pēdējās 7 dienas</h2>
        {loading ? (
          <div className="h-32 w-full bg-muted/30 animate-pulse rounded-lg" />
        ) : (
          <div className="flex items-end gap-2 h-32 w-full">
            {chart.map((bar) => {
              const heightPct = maxChart > 0 ? (bar.amount / maxChart) * 100 : 0;
              return (
                <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end justify-center" style={{ height: 100 }}>
                    <div
                      className={`w-full max-w-10 rounded-sm transition-all duration-300 ${bar.isToday ? 'bg-foreground' : 'bg-muted group-hover:bg-muted-foreground/30'}`}
                      style={{ height: `${Math.max(heightPct, bar.amount > 0 ? 4 : 1)}%` }}
                      title={euro(bar.amount)}
                    />
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-medium ${bar.isToday ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {bar.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Flat order history */}
      <div className="space-y-2 pt-4 border-t border-border/40">
        <div className="flex flex-row items-center justify-between pb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Pasūtījumu vēsture</h2>
          <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
            {entries.length} ieraksti
          </span>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <div className="space-y-4 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/30 animate-pulse rounded-md" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border/50 rounded-xl">
              Nav pasūtījumu
            </p>
          ) : (
            entries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status];
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 py-4 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors px-3 -mx-3 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-base font-medium text-foreground tracking-tight">
                        #{entry.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-sm border ${cfg.className}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {entry.buyerName} · {entry.date}
                    </p>
                  </div>
                  <span className="text-lg font-medium tabular-nums text-foreground shrink-0">
                    {euro(entry.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
