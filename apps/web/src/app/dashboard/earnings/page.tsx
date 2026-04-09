/**
 * Unified Earnings page — /dashboard/earnings
 * Role-aware: adapts amounts and labels for suppliers (canSell) vs transporters/drivers (canTransport).
 * Replaces /dashboard/supplier/earnings, /dashboard/transporter/earnings, /dashboard/driver/earnings.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getEarnings, setupPayouts, type EarningsResponse, type EarningEntry } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  Package,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EarningsStats {
  todayAmount: number;
  weekAmount: number;
  monthAmount: number;
  completedCount: number;
  pendingPayout: number;
  avgValue: number;
}

interface HistoryEntry {
  id: string;
  ref: string;
  date: string;
  rawDate: Date;
  info: string;
  amount: number;
  status: 'paid' | 'active' | 'pending';
}

interface DayBar {
  label: string;
  shortLabel: string;
  amount: number;
  isToday: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LV_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];

function euro(v: number) {
  return `€${v.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildDailyChart(
  payments: EarningEntry[],
  getAmount: (p: EarningEntry) => number,
): DayBar[] {
  const now = new Date();
  const bars: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const amount = payments
      .filter((p) => p.date.startsWith(dayStr))
      .reduce((sum, p) => sum + getAmount(p), 0);
    bars.push({
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      shortLabel: i === 0 ? 'Šod' : LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }
  return bars;
}

function computeStats(
  data: EarningsResponse | null,
  getAmount: (p: EarningEntry) => number,
  isSupplier: boolean,
): { stats: EarningsStats; history: HistoryEntry[]; chart: DayBar[] } {
  if (!data) {
    return {
      stats: {
        todayAmount: 0,
        weekAmount: 0,
        monthAmount: 0,
        completedCount: 0,
        pendingPayout: 0,
        avgValue: 0,
      },
      history: [],
      chart: buildDailyChart([], getAmount),
    };
  }

  const { payments, pendingAmount } = data;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayAmount = 0,
    weekAmount = 0,
    monthAmount = 0,
    completedCount = 0;
  const history: HistoryEntry[] = [];

  for (const p of payments) {
    const d = new Date(p.date);
    const amount = getAmount(p);
    const isPaid = p.status === 'RELEASED' || p.status === 'PAID';
    const isCaptured = p.status === 'CAPTURED';

    if (isPaid) completedCount++;
    if (isPaid || isCaptured) {
      if (d >= todayStart) todayAmount += amount;
      if (d >= weekStart) weekAmount += amount;
      if (d >= monthStart) monthAmount += amount;
    }

    const status: HistoryEntry['status'] = isPaid ? 'paid' : isCaptured ? 'active' : 'pending';
    history.push({
      id: p.id,
      ref: isSupplier ? (p.orderNumber ?? '—') : (p.jobNumber ?? p.orderNumber ?? '—'),
      date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      rawDate: d,
      info: p.buyerName ?? '—',
      amount,
      status,
    });
  }

  history.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

  const paidEntries = history.filter((e) => e.status === 'paid');
  const avgValue =
    paidEntries.length > 0 ? paidEntries.reduce((s, e) => s + e.amount, 0) / paidEntries.length : 0;

  return {
    stats: {
      todayAmount,
      weekAmount,
      monthAmount,
      completedCount,
      pendingPayout: pendingAmount,
      avgValue,
    },
    history,
    chart: buildDailyChart(payments, getAmount),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

const HISTORY_STATUS_CONFIG = {
  paid: { label: 'Pabeigts', variant: 'default' as const },
  active: { label: 'Aktīvs', variant: 'secondary' as const },
  pending: { label: 'Gaida', variant: 'outline' as const },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  // Role detection
  const isSupplier = Boolean(user?.canSell);
  const isCarrier = Boolean(user?.canTransport);

  useEffect(() => {
    if (!user) return;
    if (!isSupplier && !isCarrier) router.push('/dashboard');
  }, [user, isSupplier, isCarrier, router]);

  // Amount extractor based on role
  const getAmount = (p: EarningEntry): number =>
    isSupplier ? (p.sellerPayout ?? p.grossAmount) : (p.driverPayout ?? p.grossAmount);

  const handleSetupPayouts = async () => {
    if (!token) return;
    setSetupLoading(true);
    try {
      const { url } = await setupPayouts(token);
      if (url) window.location.href = url;
    } catch {
      setSetupLoading(false);
    }
  };

  const load = async (showRefresh = false) => {
    if (!token) return;
    if (showRefresh) setRefreshing(true);
    try {
      const result = await getEarnings(token);
      setData(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const { stats, history, chart } = computeStats(data, getAmount, isSupplier);
  const maxChart = Math.max(...chart.map((b) => b.amount), 1);

  const historyLabel = isSupplier ? 'Pasūtījumu vēsture' : 'Darbu vēsture';
  const refPrefix = isSupplier ? '#' : '#';
  const countLabel = isSupplier ? 'Pasūtījumi' : 'Pabeigti darbi';
  const entryIcon = isSupplier ? Package : Truck;

  return (
    <div className="space-y-8 pb-12 w-full">
      {/* Header */}
      <PageHeader
        title="Ienākumi"
        description={
          isSupplier
            ? 'Pārdēšanas apgrozījums un pasūtījumu vēsture'
            : 'Transporta darbu ienākumu pārskats'
        }
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

      {/* Stripe Connect banner */}
      {!loading && data && data.stripeStatus !== 'ACTIVE' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400">
              {data.stripeStatus === 'PENDING'
                ? 'Stripe reģistrācija nepilnīga'
                : 'Pievienojiet izmaksu kontu'}
            </h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mt-1 mb-3">
              {data.stripeStatus === 'PENDING'
                ? 'Pabeidz Stripe reģistrāciju, lai saņemtu naudas pārskaitījumus.'
                : 'Pievienojiet savu bankas kontu, lai varētu saņemt izmaksas.'}
            </p>
            <Button
              onClick={handleSetupPayouts}
              disabled={setupLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-4 text-xs"
            >
              {setupLoading
                ? 'Notiek apstrāde...'
                : data.stripeStatus === 'PENDING'
                  ? 'Pabeigt reģistrāciju'
                  : 'Pievienot bankas kontu'}
            </Button>
          </div>
        </div>
      )}
      {data?.stripeStatus === 'ACTIVE' && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            Stripe Connect aktīvs — izmaksas tiek veiktas automātiski 2–7 darba dienu laikā.
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          label="Šodien"
          value={euro(stats.todayAmount)}
          icon={Banknote}
          color="text-zinc-900"
        />
        <StatCard
          label="Šonedēļ"
          value={euro(stats.weekAmount)}
          icon={TrendingUp}
          color="text-zinc-900"
        />
        <StatCard
          label="Šomēnes"
          value={euro(stats.monthAmount)}
          icon={BarChart3}
          color="text-zinc-900"
        />
        <StatCard
          label={countLabel}
          value={String(stats.completedCount)}
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

        {/* History */}
        <div className="lg:col-span-2 rounded-3xl bg-muted/30 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold">{historyLabel}</h2>
              <p className="text-sm text-muted-foreground mt-1">Pēdējie ieraksti</p>
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
                {entryIcon === Truck ? (
                  <Truck className="h-12 w-12 text-muted mb-4" />
                ) : (
                  <Package className="h-12 w-12 text-muted mb-4" />
                )}
                <p className="text-base font-medium">Nav ierakstu</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Šeit parādīsies pabeigto darbu ieraksti
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => {
                  const cfg = HISTORY_STATUS_CONFIG[entry.status];
                  const EntryIcon = entryIcon;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-background/80 rounded-2xl transition-colors group"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                        <EntryIcon className="h-5 w-5 text-zinc-900" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-zinc-900">
                            {refPrefix}
                            {entry.ref}
                          </span>
                          <Badge
                            variant={cfg.variant}
                            className="text-[10px] uppercase tracking-wider font-bold h-5 px-2 rounded-md shadow-none"
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {entry.info} <span className="opacity-50 mx-1">•</span> {entry.date}
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
