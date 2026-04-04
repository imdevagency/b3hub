/**
 * Minimal Analytics page — /dashboard/analytics
 * Role-aware overview: buyer spend + AR aging, seller revenue + top materials,
 * carrier earnings + fleet utilisation. Uber-like aesthetic.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_LABELS } from '@b3hub/shared';
import {
  getAnalyticsOverview,
  type AnalyticsOverview,
  type MonthlyValue,
  type ArAging,
  type OrderBreakdown,
  type TopMaterial,
  type FleetUtilization,
  type MaterialSpend,
} from '@/lib/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function euro(v: number) {
  return `€${(v ?? 0).toLocaleString('lv-LV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(v: number) {
  return `${Math.round(v)}%`;
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatValue({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 py-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="text-4xl font-light tabular-nums tracking-tight text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── monthly bar chart ─────────────────────────────────────────────────────────

function MonthlyChart({ data, label }: { data: MonthlyValue[]; label: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const last6 = data.slice(-6);
  return (
    <div className="py-6 border-b border-border/40">
      <h3 className="text-lg font-medium mb-6">{label}</h3>
      <div className="flex items-end gap-3 h-32">
        {last6.map((d) => {
          const heightPct = Math.round((d.value / max) * 100);
          const [year, month] = d.month.split('-');
          const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('lv-LV', {
            month: 'short',
          });
          const isLatest = d === last6[last6.length - 1];
          return (
            <div key={d.month} className="flex flex-col items-center gap-2 flex-1 group">
              <div className="w-full flex items-end justify-center h-full relative">
                <div
                  className={`w-full max-w-8 transition-all rounded-t-sm ${
                    isLatest
                      ? 'bg-foreground'
                      : 'bg-muted-foreground/20 group-hover:bg-muted-foreground/40'
                  }`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                  title={euro(d.value)}
                />
              </div>
              <span
                className={`text-[11px] ${isLatest ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
              >
                {monthLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ar aging ─────────────────────────────────────────────────────────────────

const AGING_CONFIG = [
  { key: 'current' as const, label: 'Kārtējie' },
  { key: 'days30' as const, label: '1–30 dienas' },
  { key: 'days60' as const, label: '31–60 dienas' },
  { key: 'days90' as const, label: '61–90 dienas' },
  { key: 'over90' as const, label: '90+ dienas' },
];

function ArAgingList({ aging }: { aging: ArAging }) {
  const grandTotal = AGING_CONFIG.reduce((s, c) => s + aging[c.key].total, 0);
  return (
    <div className="py-6 border-b border-border/40">
      <div className="flex items-baseline justify-between mb-6">
        <h3 className="text-lg font-medium">Parādu Novecošana</h3>
        <span className="text-sm text-muted-foreground">{euro(grandTotal)} kopā</span>
      </div>
      <div className="space-y-4">
        {AGING_CONFIG.map(({ key, label }) => {
          const bucket = aging[key];
          const pctWidth = grandTotal > 0 ? Math.round((bucket.total / grandTotal) * 100) : 0;
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className={bucket.total > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                  {label}
                </span>
                <span className="font-medium tabular-nums">{euro(bucket.total)}</span>
              </div>
              <div className="h-1 w-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${pctWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

function OrderBreakdownList({ breakdown, title }: { breakdown: OrderBreakdown[]; title: string }) {
  const total = breakdown.reduce((s, b) => s + b.count, 0);
  return (
    <div className="py-6 border-b border-border/40">
      <div className="flex items-baseline justify-between mb-6">
        <h3 className="text-lg font-medium">{title}</h3>
        <span className="text-sm text-muted-foreground">{total} kopā</span>
      </div>
      <div className="space-y-0">
        {breakdown.map((b) => (
          <div
            key={b.status}
            className="flex justify-between py-3 border-b border-border/20 last:border-0 text-sm"
          >
            <span className="text-foreground">{STATUS_LABELS[b.status] ?? b.status}</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">{euro(b.total)}</span>
              <span className="font-medium tabular-nums w-8 text-right">{b.count}</span>
            </div>
          </div>
        ))}
        {breakdown.length === 0 && <p className="text-sm text-muted-foreground py-4">Nav datu</p>}
      </div>
    </div>
  );
}

// ── top materials ─────────────────────────────────────────────────────────────

function TopMaterialsList({ materials }: { materials: TopMaterial[] }) {
  return (
    <div className="py-6 border-b border-border/40">
      <h3 className="text-lg font-medium mb-6">Populārākie Materiāli</h3>
      <div className="space-y-0">
        {materials.map((m, i) => (
          <div
            key={m.materialId}
            className="flex items-center justify-between py-3 border-b border-border/20 last:border-0 text-sm"
          >
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground w-4">{i + 1}</span>
              <span className="font-medium">{m.name}</span>
            </div>
            <span className="tabular-nums">{euro(m.revenue)}</span>
          </div>
        ))}
        {materials.length === 0 && <p className="text-sm text-muted-foreground py-4">Nav datu</p>}
      </div>
    </div>
  );
}

// ── material breakdown ───────────────────────────────────────────────────────

function MaterialBreakdownChart({ breakdown }: { breakdown: MaterialSpend[] }) {
  const maxSpend = Math.max(...breakdown.map((b) => b.totalSpent), 1);
  return (
    <div className="py-6 border-b border-border/40">
      <h3 className="text-lg font-medium mb-6">Izdevumi pēc Materiāla</h3>
      {breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nav datu</p>
      ) : (
        <div className="space-y-4">
          {breakdown.slice(0, 6).map((b) => {
            const widthPct = Math.round((b.totalSpent / maxSpend) * 100);
            const label = CATEGORY_LABELS[b.category as keyof typeof CATEGORY_LABELS] ?? b.category;
            return (
              <div key={b.category} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{euro(b.totalSpent)}</span>
                </div>
                <div className="h-1.5 w-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{b.orderCount} ieraksti</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── fleet utilisation ─────────────────────────────────────────────────────────

function FleetList({ fleet }: { fleet: FleetUtilization }) {
  return (
    <div className="py-6 border-b border-border/40">
      <div className="flex items-baseline justify-between mb-6">
        <h3 className="text-lg font-medium">Flotes Noslodze</h3>
        <span className="text-sm font-medium">{pct(fleet.utilizationRate)}</span>
      </div>
      <div className="flex gap-8">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Kopā</span>
          <span className="text-2xl font-light">{fleet.total}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Aktīvi</span>
          <span className="text-2xl font-light">{fleet.active}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Darbā</span>
          <span className="text-2xl font-light">{fleet.inUse}</span>
        </div>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { token } = useAuth();
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
      <div className="max-w-3xl mx-auto py-8">
        <h1 className="text-3xl font-light mb-8 tracking-tight">Analītika</h1>
        <div className="py-12 text-muted-foreground text-sm">Neizdevās ielādēt datus: {error}</div>
      </div>
    );
  }

  const { buyer, seller, carrier } = data ?? {};

  const totalSpend = buyer?.monthlySpend.reduce((s, m) => s + m.value, 0) ?? 0;
  const totalRevenue = seller?.monthlyRevenue.reduce((s, m) => s + m.value, 0) ?? 0;
  const totalEarnings = carrier?.monthlyEarnings.reduce((s, m) => s + m.value, 0) ?? 0;

  return (
    <div className="max-w-4xl mx-auto py-8 w-full animate-in fade-in duration-500">
      <h1 className="text-3xl font-light mb-12 tracking-tight">Analītika</h1>

      {/* ── top KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 mb-12 border-b border-border/40 pb-8">
        {buyer && <StatValue label="Izdevumi" value={euro(totalSpend)} />}
        {buyer && (buyer.co2Kg ?? 0) > 0 && (
          <StatValue
            label="CO₂ piegādēm"
            value={`${Math.round(buyer.co2Kg).toLocaleString('lv-LV')} kg`}
            sub="Aprēķināts pēc maršruta"
          />
        )}
        {seller && <StatValue label="Ieņēmumi" value={euro(totalRevenue)} />}
        {seller && (
          <StatValue
            label="Vidējais vērtējums"
            value={seller.performanceStats.avgRating.toFixed(1)}
          />
        )}
        {seller && (
          <StatValue label="Izpilde" value={pct(seller.performanceStats.completionRate)} />
        )}
        {seller && seller.performanceStats.onTimeRate > 0 && (
          <StatValue label="Laicīgums" value={pct(seller.performanceStats.onTimeRate)} />
        )}
        {carrier && <StatValue label="Ienākumi" value={euro(totalEarnings)} />}
        {carrier && (
          <StatValue label="Noslodze" value={pct(carrier.fleetUtilization.utilizationRate)} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-8">
        {/* ── buyer section ── */}
        {buyer && (
          <div className="space-y-2">
            <MonthlyChart data={buyer.monthlySpend} label="Ikmēneša Izdevumi" />
            <MaterialBreakdownChart breakdown={buyer.materialBreakdown ?? []} />
            <ArAgingList aging={buyer.arAging} />
            <OrderBreakdownList breakdown={buyer.orderBreakdown} title="Pasūtījumi" />
          </div>
        )}

        {/* ── seller section ── */}
        {seller && (
          <div className="space-y-2">
            <MonthlyChart data={seller.monthlyRevenue} label="Ikmēneša Ieņēmumi" />
            <TopMaterialsList materials={seller.topMaterials} />
            <OrderBreakdownList breakdown={seller.orderBreakdown} title="Pasūtījumi" />
          </div>
        )}

        {/* ── carrier section ── */}
        {carrier && (
          <div className="space-y-2">
            <MonthlyChart data={carrier.monthlyEarnings} label="Ienākumi" />
            <FleetList fleet={carrier.fleetUtilization} />
            <OrderBreakdownList breakdown={carrier.jobBreakdown} title="Darbi" />
          </div>
        )}
      </div>

      {!buyer && !seller && !carrier && (
        <div className="py-12 text-muted-foreground text-sm">Nav pieejamu analītikas datu.</div>
      )}
    </div>
  );
}
