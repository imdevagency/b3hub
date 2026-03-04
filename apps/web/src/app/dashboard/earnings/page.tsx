'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getMyTransportJobs, type ApiTransportJob } from '@/lib/api';
import {
  Clock,
  CheckCircle,
  RefreshCw,
  Banknote,
  TrendingUp,
  Truck,
  CalendarDays,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  route: string;
  amount: number;
  paid: boolean;
}

const ACTIVE_STATUSES = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
];

// ── Compute stats from raw job list ───────────────────────────────────────────

function computeStats(jobs: ApiTransportJob[]): { stats: EarningsStats; history: HistoryEntry[] } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Mon
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let todayEarnings = 0,
    weekEarnings = 0,
    monthEarnings = 0,
    completedJobs = 0,
    pendingPayout = 0;
  const history: HistoryEntry[] = [];

  for (const job of jobs) {
    const d = new Date(job.deliveryDate ?? job.pickupDate);
    if (job.status === 'DELIVERED') {
      completedJobs++;
      if (d >= todayStart) todayEarnings += job.rate;
      if (d >= weekStart) weekEarnings += job.rate;
      if (d >= monthStart) monthEarnings += job.rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: d.toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: true,
      });
    } else if (ACTIVE_STATUSES.includes(job.status)) {
      pendingPayout += job.rate;
      history.push({
        id: job.id,
        jobNumber: job.jobNumber,
        date: new Date(job.pickupDate).toLocaleDateString('lv-LV', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        route: `${job.pickupCity} → ${job.deliveryCity}`,
        amount: job.rate,
        paid: false,
      });
    }
  }

  history.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    stats: { todayEarnings, weekEarnings, monthEarnings, completedJobs, pendingPayout },
    history,
  };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  primary,
  hint,
}: {
  label: string;
  value: string;
  primary?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-1 shadow-sm ${
        primary ? 'bg-red-600 text-white' : 'bg-white border'
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${primary ? 'text-red-200' : 'text-muted-foreground'}`}
      >
        {label}
      </p>
      <p className={`text-3xl font-extrabold ${primary ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      {hint && (
        <p className={`text-xs ${primary ? 'text-red-200' : 'text-muted-foreground'}`}>{hint}</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EarningsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<EarningsStats>({
    todayEarnings: 0,
    weekEarnings: 0,
    monthEarnings: 0,
    completedJobs: 0,
    pendingPayout: 0,
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const fetchEarnings = useCallback(async () => {
    if (!token) return;
    try {
      const jobs = await getMyTransportJobs(token);
      const { stats: s, history: h } = computeStats(jobs);
      setStats(s);
      setHistory(h);
    } catch (e) {
      console.error('Failed to load earnings', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchEarnings();
  }, [isLoading, token, fetchEarnings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEarnings();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ienākumi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pārskats par veiktajiem darbiem un izmaksām
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atjaunot
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Šodien" value={`€${stats.todayEarnings.toFixed(2)}`} primary />
        <StatCard label="Šajā nedēļā" value={`€${stats.weekEarnings.toFixed(2)}`} />
        <StatCard label="Šajā mēnesī" value={`€${stats.monthEarnings.toFixed(2)}`} />
        <StatCard
          label="Pabeigti darbi"
          value={String(stats.completedJobs)}
          hint="kopā piegādāts"
        />
      </div>

      {/* Pending payout banner */}
      {stats.pendingPayout > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">Gaida izmaksu</p>
            <p className="text-2xl font-extrabold text-amber-900 mt-0.5">
              €{stats.pendingPayout.toFixed(2)}
            </p>
          </div>
          <Clock className="h-10 w-10 text-amber-400" />
        </div>
      )}

      {/* History table */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">Darbu vēsture</h2>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <Banknote className="h-12 w-12 text-gray-300" />
            <p className="font-semibold text-gray-500">Nav darbu vēstures</p>
            <p className="text-sm text-muted-foreground">
              Pieņemiet un pabeidziet darbus, lai redzētu ienākumus šeit.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Darbs</span>
              <span>Maršruts</span>
              <span>Datums</span>
              <span className="text-right">Summa</span>
            </div>

            {history.map((entry, i) => (
              <div
                key={entry.id}
                className={`grid grid-cols-[1fr_2fr_1fr_auto] gap-4 px-5 py-4 items-center ${
                  i < history.length - 1 ? 'border-b' : ''
                } hover:bg-gray-50 transition-colors`}
              >
                {/* Job number + status badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-gray-500 truncate">
                    #{entry.jobNumber}
                  </span>
                  {entry.paid ? (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full px-2 py-0.5 border border-green-200">
                      <CheckCircle className="h-3 w-3" />
                      Izmaksāts
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full px-2 py-0.5 border border-amber-200">
                      <Clock className="h-3 w-3" />
                      Gaida
                    </span>
                  )}
                </div>

                {/* Route */}
                <div className="flex items-center gap-1.5 text-sm text-gray-700 min-w-0">
                  <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{entry.route}</span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {entry.date}
                </div>

                {/* Amount */}
                <span
                  className={`text-right font-bold text-base ${
                    entry.paid ? 'text-gray-900' : 'text-amber-600'
                  }`}
                >
                  €{entry.amount.toFixed(2)}
                </span>
              </div>
            ))}

            {/* Totals footer */}
            <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-4 px-5 py-3 bg-gray-50 border-t">
              <span className="text-xs font-bold text-gray-500 col-span-3">Kopā (DELIVERED)</span>
              <span className="text-right font-extrabold text-gray-900">
                €
                {history
                  .filter((e) => e.paid)
                  .reduce((s, e) => s + e.amount, 0)
                  .toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
