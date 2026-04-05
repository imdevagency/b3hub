/**
 * Driver earnings page — /dashboard/driver/earnings
 * Shows payout history, Stripe Connect status, and 7-day job earnings for drivers.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { setupPayouts, getEarnings, type EarningsResponse, type EarningEntry } from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';

// ── helpers ───────────────────────────────────────────────────────────────────

const LV_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];

function euro(v: number) {
  return `€${v.toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface DayBar {
  label: string;
  shortLabel: string;
  amount: number;
  isToday: boolean;
}

function buildChart(payments: EarningEntry[]): DayBar[] {
  const bars: DayBar[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const amount = payments
      .filter((p) => p.date.startsWith(dayStr))
      .reduce((s, p) => s + (p.driverPayout ?? p.grossAmount), 0);
    bars.push({
      label: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' }),
      shortLabel: LV_DAYS[d.getDay()],
      amount,
      isToday: i === 0,
    });
  }
  return bars;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    RELEASED: 'Izmaksāts',
    PAID: 'Apmaksāts',
    CAPTURED: 'Apstrādē',
    AUTHORIZED: 'Rezervēts',
  };
  return map[status] ?? status;
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'RELEASED' || status === 'PAID') return 'default';
  if (status === 'CAPTURED') return 'secondary';
  return 'outline';
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DriverEarningsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(showRefresh = false) {
    if (!token) return;
    if (showRefresh) setRefreshing(true);
    try {
      const result = await getEarnings(token);
      setData(result);
      setError(null);
    } catch {
      setError('Neizdevās ielādēt ieņēmumu datus.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSetupPayouts() {
    if (!token) return;
    setSetupLoading(true);
    try {
      const { url } = await setupPayouts(token);
      if (url) window.location.href = url;
    } catch {
      setSetupLoading(false);
    }
  }

  const chart = data ? buildChart(data.payments) : [];
  const maxChart = Math.max(...chart.map((b) => b.amount), 1);

  const totalEarned = data?.totalEarned ?? 0;
  const pendingAmount = data?.pendingAmount ?? 0;
  const payments = data?.payments ?? [];

  // Filter last 30 days for transaction list
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPayments = payments.filter((p) => new Date(p.date) >= thirtyDaysAgo);

  return (
    <div className="space-y-12 pb-10">
      {/* header */}
      <PageHeader
        title="Mani ieņēmumi"
        description="Braukšanas izmaksas un maksājumu vēsture"
        action={
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunināt
          </Button>
        }
      />

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stripe Connect status banner */}
      {!loading && data && data.stripeStatus !== 'ACTIVE' && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-400">
              {data.stripeStatus === 'PENDING' ? 'Stripe reģistrācija nepilnīga' : 'Pievienojiet izmaksu kontu'}
            </h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-500/80 mt-1 mb-3">
              {data.stripeStatus === 'PENDING'
                ? 'Pabeidz Stripe reģistrāciju, lai saņemtu naudas pārskaitījumus.'
                : 'Pievienojiet savu bankas kontu, lai varētu saņemt izmaksas par piegādēm.'}
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

      {/* Hero stats */}
      <div className="flex flex-col gap-5">
        {loading ? (
          <div className="h-24 bg-muted/30 animate-pulse rounded-xl" />
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Kopā nopelnīts (90 dienas)</p>
              <h1 className="text-6xl md:text-7xl font-semibold tracking-tight text-foreground tabular-nums">
                {euro(totalEarned)}
              </h1>
            </div>

            <div className="flex items-center gap-8 mt-4 pt-6 border-t border-border/40">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-medium text-foreground tabular-nums">
                  {payments.length}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Piegādes
                </span>
              </div>
              {pendingAmount > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                    {euro(pendingAmount)}
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Gaidāmā izmaksa
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 7-day bar chart */}
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
                      className={`w-full max-w-10 rounded-sm transition-all duration-300 ${
                        bar.isToday ? 'bg-foreground' : 'bg-muted group-hover:bg-muted-foreground/30'
                      }`}
                      style={{ height: `${Math.max(heightPct, bar.amount > 0 ? 4 : 1)}%` }}
                      title={euro(bar.amount)}
                    />
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-medium ${
                      bar.isToday ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {bar.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="space-y-2 pt-4 border-t border-border/40">
        <div className="flex flex-row items-center justify-between pb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Piegāžu vēsture</h2>
          <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
            {recentPayments.length} ieraksti
          </span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/30 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : recentPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Truck className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nav ierakstu pēdējo 30 dienu laikā.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentPayments.map((p) => {
              const payout = p.driverPayout ?? p.grossAmount;
              const label = p.jobNumber ? `Darbs #${p.jobNumber}` : p.orderNumber ? `Pasūtījums #${p.orderNumber}` : p.id.slice(0, 8);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors border border-border/30"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    {p.buyerName && (
                      <span className="text-xs text-muted-foreground">{p.buyerName}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.date).toLocaleDateString('lv-LV', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {euro(payout)}
                    </span>
                    <Badge variant={statusVariant(p.status)} className="text-[10px] h-4 px-1.5">
                      {statusLabel(p.status)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
