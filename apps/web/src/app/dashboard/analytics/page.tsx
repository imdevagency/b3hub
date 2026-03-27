/**
 * ERP Analytics page — /dashboard/analytics
 * Role-aware overview: buyer spend + AR aging, seller revenue + top materials,
 * carrier earnings + fleet utilisation.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getAnalyticsOverview,
  type AnalyticsOverview,
  type MonthlyValue,
  type ArAging,
  type OrderBreakdown,
  type TopMaterial,
  type FleetUtilization,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Package,
  Truck,
  AlertCircle,
  Star,
  CheckCircle2,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

function euro(v: number) {
  return `€${(v ?? 0).toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(v: number) {
  return `${Math.round(v)}%`;
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-sm text-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── monthly bar chart ─────────────────────────────────────────────────────────

function MonthlyChart({ data, label }: { data: MonthlyValue[]; label: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const last6 = data.slice(-6);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{label}</CardTitle>
        <CardDescription>Pēdējie 6 mēneši</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-28">
          {last6.map((d) => {
            const heightPct = Math.round((d.value / max) * 100);
            const [year, month] = d.month.split('-');
            const label = new Date(Number(year), Number(month) - 1).toLocaleString('lv-LV', {
              month: 'short',
            });
            const isLatest = d === last6[last6.length - 1];
            return (
              <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isLatest ? 'bg-primary' : 'bg-muted'
                    }`}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={euro(d.value)}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── ar aging ─────────────────────────────────────────────────────────────────

const AGING_CONFIG = [
  { key: 'current' as const, label: 'Kārtējie', color: 'bg-emerald-500' },
  { key: 'days30' as const, label: '1–30 dienas', color: 'bg-yellow-400' },
  { key: 'days60' as const, label: '31–60 dienas', color: 'bg-orange-400' },
  { key: 'days90' as const, label: '61–90 dienas', color: 'bg-red-400' },
  { key: 'over90' as const, label: '90+ dienas', color: 'bg-red-700' },
];

function ArAgingCard({ aging }: { aging: ArAging }) {
  const grandTotal = AGING_CONFIG.reduce((s, c) => s + aging[c.key].total, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          Debitoru Parādu Novecošana
        </CardTitle>
        <CardDescription>Kopā neapmaksāts: {euro(grandTotal)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {AGING_CONFIG.map(({ key, label, color }) => {
          const bucket = aging[key];
          const pctWidth = grandTotal > 0 ? Math.round((bucket.total / grandTotal) * 100) : 0;
          return (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">
                  {euro(bucket.total)}{' '}
                  <span className="text-muted-foreground">({bucket.count})</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${pctWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── order breakdown ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Notiek',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

function OrderBreakdownCard({ breakdown, title }: { breakdown: OrderBreakdown[]; title: string }) {
  const total = breakdown.reduce((s, b) => s + b.count, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <CardDescription>Kopā: {total}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {breakdown.map((b) => {
          const widthPct = total > 0 ? Math.round((b.count / total) * 100) : 0;
          return (
            <div key={b.status} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{STATUS_LABELS[b.status] ?? b.status}</span>
                <span className="font-medium tabular-nums">
                  {b.count} <span className="text-muted-foreground">({euro(b.total)})</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
        {breakdown.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nav pasūtījumu</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── top materials ─────────────────────────────────────────────────────────────

function TopMaterialsCard({ materials }: { materials: TopMaterial[] }) {
  const max = Math.max(...materials.map((m) => m.revenue), 1);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          Populārākie Materiāli
        </CardTitle>
        <CardDescription>Pēc ieņēmumiem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {materials.map((m, i) => (
          <div key={m.materialId} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium truncate max-w-40">{m.name}</span>
                <span className="text-muted-foreground tabular-nums">{euro(m.revenue)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((m.revenue / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {materials.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nav datu</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── fleet utilisation ─────────────────────────────────────────────────────────

function FleetCard({ fleet }: { fleet: FleetUtilization }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          Flotes Noslodze
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-semibold">{fleet.total}</p>
            <p className="text-xs text-muted-foreground">Kopā</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-emerald-600">{fleet.active}</p>
            <p className="text-xs text-muted-foreground">Aktīvi</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-primary">{fleet.inUse}</p>
            <p className="text-xs text-muted-foreground">Darbā</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Noslodze</span>
            <span className="font-medium">{pct(fleet.utilizationRate)}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(fleet.utilizationRate, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user, token } = useAuth();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAnalyticsOverview(token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-r-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 pb-12 w-full">
        <PageHeader title="Analītika" description="ERP pārskats par pasūtījumiem un finansēm" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Neizdevās ielādēt datus: {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { buyer, seller, carrier } = data ?? {};

  // Aggregate KPIs for the header row
  const totalSpend = buyer?.monthlySpend.reduce((s, m) => s + m.value, 0) ?? 0;
  const totalRevenue = seller?.monthlyRevenue.reduce((s, m) => s + m.value, 0) ?? 0;
  const totalEarnings = carrier?.monthlyEarnings.reduce((s, m) => s + m.value, 0) ?? 0;

  return (
    <div className="space-y-8 pb-12 w-full">
      <PageHeader title="Analītika" description="ERP pārskats par pasūtījumiem un finansēm" />

      {/* ── top KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {buyer && (
          <StatCard
            label="Kopējie izdevumi"
            value={euro(totalSpend)}
            icon={CreditCard}
            sub="Pēdējie 12 mēneši"
          />
        )}
        {seller && (
          <StatCard
            label="Kopējie ieņēmumi"
            value={euro(totalRevenue)}
            icon={TrendingUp}
            sub="Pēdējie 12 mēneši"
          />
        )}
        {seller && (
          <StatCard
            label="Vidējais vērtējums"
            value={seller.performanceStats.avgRating.toFixed(1)}
            icon={Star}
            sub={`${seller.performanceStats.totalOrders} pasūtījumi`}
          />
        )}
        {seller && (
          <StatCard
            label="Izpildes %"
            value={pct(seller.performanceStats.completionRate)}
            icon={CheckCircle2}
          />
        )}
        {carrier && (
          <StatCard
            label="Kopējie ienākumi"
            value={euro(totalEarnings)}
            icon={BarChart3}
            sub="Pēdējie 12 mēneši"
          />
        )}
        {carrier && (
          <StatCard
            label="Flotes noslodze"
            value={pct(carrier.fleetUtilization.utilizationRate)}
            icon={Truck}
          />
        )}
      </div>

      {/* ── buyer section ── */}
      {buyer && (
        <>
          <MonthlyChart data={buyer.monthlySpend} label="Ikmēneša Izdevumi" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ArAgingCard aging={buyer.arAging} />
            <OrderBreakdownCard breakdown={buyer.orderBreakdown} title="Pasūtījumi pēc Statusa" />
          </div>
        </>
      )}

      {/* ── seller section ── */}
      {seller && (
        <>
          <MonthlyChart data={seller.monthlyRevenue} label="Ikmēneša Ieņēmumi" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopMaterialsCard materials={seller.topMaterials} />
            <OrderBreakdownCard breakdown={seller.orderBreakdown} title="Pasūtījumi pēc Statusa" />
          </div>
        </>
      )}

      {/* ── carrier section ── */}
      {carrier && (
        <>
          <MonthlyChart data={carrier.monthlyEarnings} label="Ikmēneša Ienākumi" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FleetCard fleet={carrier.fleetUtilization} />
            <OrderBreakdownCard breakdown={carrier.jobBreakdown} title="Darbi pēc Statusa" />
          </div>
        </>
      )}

      {!buyer && !seller && !carrier && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nav pieejamu analītikas datu jūsu profilam.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
