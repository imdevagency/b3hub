/**
 * Carrier performance scorecard — /dashboard/scorecard
 * Shows on-time %, completion rate, rating, fleet utilization, and monthly trend.
 * Carrier OWNER/MANAGER only.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getAnalyticsOverview,
  getAllTransportJobs,
  type AnalyticsOverview,
  type ApiTransportJob,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import { StatCard } from '@/components/ui/stat-card';
import {
  Clock,
  CheckCircle,
  Star,
  Truck,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(v: number) {
  return `${Math.round(v)}%`;
}

function scoreColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'text-green-600';
  if (value >= thresholds[0]) return 'text-amber-600';
  return 'text-red-600';
}

/** On-time rate: % of DELIVERED jobs delivered before deliveryDate + 30min grace */
function computeOnTime(jobs: ApiTransportJob[]): number {
  const delivered = jobs.filter((j) => j.status === 'DELIVERED');
  if (delivered.length === 0) return 0;

  const GRACE_MS = 30 * 60 * 1000;
  const onTime = delivered.filter((j) => {
    const deliveredAt = j.statusTimestamps?.['DELIVERED'] ?? j.statusUpdatedAt ?? null;
    if (!deliveredAt) return true; // no timestamp → assume on time
    return new Date(deliveredAt).getTime() <= new Date(j.deliveryDate).getTime() + GRACE_MS;
  }).length;

  return Math.round((onTime / delivered.length) * 100);
}

/** Completion rate from job breakdown (DELIVERED / non-AVAILABLE total) */
function computeCompletionRate(breakdown: { status: string; count: number }[]): number {
  const total = breakdown.filter((b) => b.status !== 'AVAILABLE').reduce((s, b) => s + b.count, 0);
  const delivered = breakdown.find((b) => b.status === 'DELIVERED')?.count ?? 0;
  return total > 0 ? Math.round((delivered / total) * 100) : 0;
}

// ── Score meter ───────────────────────────────────────────────────────────────

function ScoreMeter({
  label,
  value,
  max = 100,
  thresholds,
  suffix = '%',
  icon: Icon,
  description,
}: {
  label: string;
  value: number;
  max?: number;
  thresholds: [number, number];
  suffix?: string;
  icon: React.ElementType;
  description: string;
}) {
  const pctFill = Math.min((value / max) * 100, 100);
  const color = scoreColor(value, thresholds);
  const barColor =
    value >= thresholds[1]
      ? 'bg-green-500'
      : value >= thresholds[0]
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <span className={`text-2xl font-bold tabular-nums ${color}`}>
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pctFill}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// ── Monthly chart ──────────────────────────────────────────────────────────────

function MonthlyBar({ data }: { data: { month: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const last6 = data.slice(-6);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Mēneša ienākumi (6 mēn.)</h3>
      <div className="flex items-end gap-2 h-24">
        {last6.map((d, i) => {
          const h = Math.max((d.value / max) * 100, d.value > 0 ? 8 : 3);
          const [year, month] = d.month.split('-');
          const label = new Date(Number(year), Number(month) - 1).toLocaleString('lv-LV', {
            month: 'short',
          });
          const isLatest = i === last6.length - 1;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center h-20">
                <div
                  className={`w-full rounded-sm transition-all ${isLatest ? 'bg-foreground' : 'bg-muted-foreground/25'}`}
                  style={{ height: `${h}%` }}
                />
              </div>
              <span
                className={`text-[10px] ${isLatest ? 'font-semibold' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScorecardPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [fleetJobs, setFleetJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isCarrier = Boolean(user?.canTransport);

  useEffect(() => {
    if (!user && !isLoading) router.push('/dashboard');
    if (user && !isCarrier) router.push('/dashboard');
  }, [user, isLoading, isCarrier, router]);

  const load = async (quiet = false) => {
    if (!token) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const [ov, jobs] = await Promise.all([
        getAnalyticsOverview(token),
        getAllTransportJobs(token),
      ]);
      setOverview(ov);
      setFleetJobs(jobs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isCarrier) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isCarrier, token]);

  if (isLoading || loading) return <PageSpinner />;

  const carrier = overview?.carrier ?? null;
  const onTimePct = computeOnTime(fleetJobs);
  const completionPct = carrier ? computeCompletionRate(carrier.jobBreakdown) : 0;

  const delivered = carrier?.jobBreakdown.find((b) => b.status === 'DELIVERED')?.count ?? 0;
  const cancelled = carrier?.jobBreakdown.find((b) => b.status === 'CANCELLED')?.count ?? 0;
  const total =
    carrier?.jobBreakdown
      .filter((b) => b.status !== 'AVAILABLE')
      .reduce((s, b) => s + b.count, 0) ?? 0;
  const fleet = carrier?.fleetUtilization;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Veiktspējas karte"
        description="Laicīgums, izpildes rādītājs un flotes efektivitāte"
        action={
          <Button variant="outline" size="icon" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* KPI top row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Kopā darbi" value={String(total)} icon={Truck} />
        <StatCard label="Pabeigti" value={String(delivered)} icon={CheckCircle} />
        <StatCard label="Atcelti" value={String(cancelled)} icon={AlertTriangle} />
        <StatCard
          label="Flote"
          value={fleet ? `${fleet.inUse + fleet.active}/${fleet.total}` : '—'}
          icon={Truck}
        />
      </div>

      {/* Score meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ScoreMeter
          label="Laicīgums"
          value={onTimePct}
          thresholds={[80, 95]}
          icon={Clock}
          description="Piegādes veiktas laikā (±30 min no plānotā)"
        />
        <ScoreMeter
          label="Izpildes rādītājs"
          value={completionPct}
          thresholds={[85, 95]}
          icon={CheckCircle}
          description="Pieņemto darbu, kas veiksmīgi pabeigti"
        />
        <ScoreMeter
          label="Flotes izmantojamība"
          value={fleet?.utilizationRate ?? 0}
          thresholds={[60, 80]}
          icon={TrendingUp}
          description="Aktīvo un izmantoto transportlīdzekļu īpatsvars"
        />
      </div>

      {/* Monthly earnings chart + rating note */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {carrier && carrier.monthlyEarnings.length > 0 && (
            <MonthlyBar data={carrier.monthlyEarnings} />
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Star className="h-4 w-4" />
            Tirgus vērtējums
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Jūsu publiskais vērtējums tiek veidots no pircēju atsauksmēm pēc piegādes. Skatiet
            atsauksmes sadaļā{' '}
            <a href="/dashboard/reviews" className="underline text-foreground">
              Atsauksmes
            </a>
            .
          </p>
          <div className="mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground">
            Augstāks vērtējums → augstāka prioritāte darbu sadalē.
          </div>
        </div>
      </div>
    </div>
  );
}
