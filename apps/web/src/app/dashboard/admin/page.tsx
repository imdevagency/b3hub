/**
 * Admin overview page — /dashboard/admin
 * Platform-wide statistics: GMV, revenue, users, orders, and trend charts.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  getAdminStats,
  type AdminStats,
  type AdminMonthlyTrend,
  type AdminTodayDelivery,
} from '@/lib/api/admin';
import {
  Users,
  ClipboardList,
  Truck,
  BarChart3,
  Building2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Euro,
  ScrollText,
  Package,
  Banknote,
  MessageSquare,
  FileText,
  Wallet,
  CheckCircle2,
  CircleDot,
  Circle,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

function euro(v: number) {
  return `€${(v ?? 0).toLocaleString('lv-LV', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  badge,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href?: string;
  badge?: number;
}) {
  const inner = (
    <div
      className={`bg-background border border-border rounded-2xl p-5 flex items-center gap-4 group ${href ? 'hover:border-foreground/20 cursor-pointer transition-colors' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-3xl font-extrabold text-foreground mt-0.5">{value}</p>
      </div>
      {!!badge && (
        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
          {badge}
        </span>
      )}
      {href && (
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

// ─── revenue card ─────────────────────────────────────────────────────────────

function RevenueCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-3xl font-extrabold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── monthly trend chart ──────────────────────────────────────────────────────

function TrendChart({
  data,
  valueKey,
  label,
  formatValue,
}: {
  data: AdminMonthlyTrend[];
  valueKey: 'orders' | 'gmv';
  label: string;
  formatValue: (v: number) => string;
}) {
  const values = data.map((d) => d[valueKey] as number);
  const max = Math.max(...values, 1);
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        {label}
      </p>
      <div className="flex items-end gap-2 h-24">
        {data.map((d, i) => {
          const v = d[valueKey] as number;
          const heightPct = Math.round((v / max) * 100);
          const [year, month] = d.month.split('-');
          const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('lv-LV', {
            month: 'short',
          });
          const isLatest = i === data.length - 1;
          return (
            <div key={d.month} className="flex flex-col items-center gap-1.5 flex-1 group">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                {formatValue(v)}
              </span>
              <div className="w-full flex items-end justify-center h-16">
                <div
                  className={`w-full rounded-t-sm transition-all ${isLatest ? 'bg-foreground' : 'bg-muted-foreground/25 group-hover:bg-muted-foreground/50'}`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span
                className={`text-[10px] ${isLatest ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
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

// ─── order status helpers ─────────────────────────────────────────────────────

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Izpildē',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-violet-50 text-violet-700 border-violet-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-gray-50 text-gray-500 border-gray-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
};

function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        ORDER_STATUS_COLOR[status] ?? 'bg-muted text-muted-foreground border-border',
      )}
    >
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── pipeline step ────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { key: 'PENDING', label: 'Gaida', icon: Circle, color: 'text-amber-500' },
  { key: 'CONFIRMED', label: 'Apstiprināts', icon: CircleDot, color: 'text-blue-500' },
  { key: 'IN_PROGRESS', label: 'Izpildē', icon: Truck, color: 'text-violet-500' },
  { key: 'DELIVERED', label: 'Piegādāts', icon: CheckCircle2, color: 'text-emerald-500' },
];

// ─── main page ────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!isLoading && token) {
      getAdminStats(token)
        .then(setStats)
        .finally(() => setLoading(false));
    }
  }, [isLoading, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-r-transparent" />
      </div>
    );
  }

  const trends = stats?.monthlyTrends ?? [];
  const pipeline = stats?.orderPipeline ?? {};
  const todayDeliveries: AdminTodayDelivery[] = stats?.todayDeliveries ?? [];

  // Pending actions: items that need attention right now
  const attentionItems = [
    {
      label: 'Pieteikumi',
      count: stats?.pendingApplications ?? 0,
      href: '/dashboard/admin/applications',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      icon: ShieldCheck,
    },
    {
      label: 'Atvērtie strīdi',
      count: stats?.openDisputes ?? 0,
      href: '/dashboard/admin/disputes',
      color: 'text-red-600',
      bg: 'bg-red-50',
      icon: AlertTriangle,
    },
    {
      label: 'Atbalsta pieprasījumi',
      count: stats?.openSupport ?? 0,
      href: '/dashboard/admin/support',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      icon: MessageSquare,
    },
    {
      label: 'Maksājumi rindā',
      count: stats?.pendingPayoutsCount ?? 0,
      href: '/dashboard/admin/payouts',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: Wallet,
      sub: stats?.pendingPayoutsTotal ? euro(stats.pendingPayoutsTotal) : undefined,
    },
    {
      label: 'Dokumenti beidzas',
      count: stats?.expiringDocumentsCount ?? 0,
      href: '/dashboard/admin/documents',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: FileText,
      sub: '30 dienu laikā',
    },
  ];

  const totalAttention = attentionItems.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Administrācija" description="Pārskats par platformas darbību" />

      {/* ── Revenue row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RevenueCard
          label="GMV kopā (pabeigts)"
          value={euro(stats?.gmvAllTime ?? 0)}
          sub="Visi pabeigto pasūtījumu apjomi"
          icon={Euro}
          accent="bg-emerald-50 text-emerald-700"
        />
        <RevenueCard
          label="GMV — pēdējās 30 dienas"
          value={euro(stats?.gmv30d ?? 0)}
          sub="Tikai pabeigti/piegādāti pasūtījumi"
          icon={TrendingUp}
          accent="bg-blue-50 text-blue-700"
        />
        <RevenueCard
          label="Komisija est. (30 dienas)"
          value={euro(stats?.commissionEst30d ?? 0)}
          sub="Aprēķināts pēc 10% likmes"
          icon={BarChart3}
          accent="bg-violet-50 text-violet-700"
        />
      </div>

      {/* ── Count stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Lietotāji"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="bg-blue-50 text-blue-700"
          href="/dashboard/admin/users"
        />
        <StatCard
          label="Uzņēmumi"
          value={stats?.totalCompanies ?? 0}
          icon={Building2}
          color="bg-indigo-50 text-indigo-700"
          href="/dashboard/admin/companies"
        />
        <StatCard
          label="Pasūtījumi"
          value={stats?.totalOrders ?? 0}
          icon={BarChart3}
          color="bg-purple-50 text-purple-700"
          href="/dashboard/admin/orders"
        />
        <StatCard
          label="Aktīvie darbi"
          value={stats?.activeJobs ?? 0}
          icon={Truck}
          color="bg-amber-50 text-amber-700"
          href="/dashboard/admin/jobs"
        />
        <StatCard
          label="Strīdi"
          value={stats?.openDisputes ?? 0}
          icon={AlertTriangle}
          color={
            stats?.openDisputes ? 'bg-red-50 text-red-700' : 'bg-muted/50 text-muted-foreground/50'
          }
          href="/dashboard/admin/disputes"
          badge={stats?.openDisputes || undefined}
        />
        <StatCard
          label="Pieteikumi"
          value={stats?.pendingApplications ?? 0}
          icon={ClipboardList}
          color={
            stats?.pendingApplications
              ? 'bg-orange-50 text-orange-700'
              : 'bg-muted/50 text-muted-foreground/50'
          }
          href="/dashboard/admin/applications"
          badge={stats?.pendingApplications || undefined}
        />
      </div>

      {/* ── Needs attention + Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending actions inbox */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Nepieciešama rīcība</span>
              {totalAttention > 0 && (
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                  {totalAttention}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 hover:border-foreground/20 transition-colors group"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    item.bg,
                  )}
                >
                  <item.icon className={cn('h-4 w-4', item.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {item.count > 0 ? (
                    <span className={cn('text-sm font-bold tabular-nums', item.color)}>
                      {item.count}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Order pipeline funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Pasūtījumu konveijers</span>
              <Link
                href="/dashboard/admin/orders"
                className="text-xs font-normal text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Skatīt visus <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-stretch gap-2">
              {PIPELINE_STEPS.map((step, i) => {
                const count = pipeline[step.key] ?? 0;
                const maxCount = Math.max(...PIPELINE_STEPS.map((s) => pipeline[s.key] ?? 0), 1);
                const heightPct = Math.max(Math.round((count / maxCount) * 100), 8);
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center gap-2">
                    {/* Bar */}
                    <div className="w-full flex flex-col justify-end h-28 bg-muted/40 rounded-xl overflow-hidden">
                      <div
                        className={cn(
                          'w-full rounded-xl transition-all',
                          i === 0 && 'bg-amber-400',
                          i === 1 && 'bg-blue-400',
                          i === 2 && 'bg-violet-400',
                          i === 3 && 'bg-emerald-400',
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    {/* Count */}
                    <p className="text-2xl font-extrabold text-foreground tabular-nums">{count}</p>
                    {/* Icon + label */}
                    <div className="flex flex-col items-center gap-0.5">
                      <step.icon className={cn('h-3.5 w-3.5', step.color)} />
                      <p className="text-[10px] text-muted-foreground text-center leading-tight">
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's delivery schedule ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Šodienas piegādes</span>
            <span className="text-sm font-normal text-muted-foreground">
              ({todayDeliveries.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Šodienai nav ieplānotu piegāžu
            </p>
          ) : (
            <div className="divide-y divide-border -mx-6 px-6">
              {todayDeliveries.map((d) => (
                <Link
                  key={d.id}
                  href={`/dashboard/admin/orders/${d.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors group"
                >
                  {/* Order number */}
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-mono font-semibold text-foreground">
                      {d.orderNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.deliveryDate
                        ? new Date(d.deliveryDate).toLocaleTimeString('lv-LV', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                  {/* Buyer + address */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.buyerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.deliveryAddress}</p>
                  </div>
                  {/* Driver */}
                  <div className="hidden sm:block w-36 shrink-0 text-right">
                    {d.driverName ? (
                      <p className="text-xs font-medium text-foreground">{d.driverName}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nav piešķirts</p>
                    )}
                    {d.jobStatus && (
                      <p className="text-[10px] text-muted-foreground">{d.jobStatus}</p>
                    )}
                  </div>
                  {/* Status */}
                  <div className="shrink-0">
                    <OrderStatusBadge status={d.status} />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Monthly trend charts ── */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dinamika — pēdējie 6 mēneši</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <TrendChart data={trends} valueKey="gmv" label="GMV (€)" formatValue={euro} />
              <TrendChart
                data={trends}
                valueKey="orders"
                label="Pasūtījumi"
                formatValue={(v) => String(v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick nav links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/admin/users"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-foreground">Pārvaldīt lietotājus</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/companies"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-foreground">Uzņēmumi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/orders"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-foreground">Visi pasūtījumi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/jobs"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-foreground">Transporta darbi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/disputes"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-foreground">Strīdi</span>
            {!!stats?.openDisputes && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {stats.openDisputes}
              </span>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/applications"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Piegādātāju pieteikumi</span>
            {!!stats?.pendingApplications && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {stats.pendingApplications}
              </span>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/materials"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-teal-600" />
            <span className="font-semibold text-foreground">Materiālu katalogs</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/payments"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Banknote className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-foreground">Maksājumu rinda</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/audit-logs"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Audita žurnāls</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getAdminStats, type AdminStats, type AdminMonthlyTrend } from '@/lib/api/admin';
import {
  Users,
  ClipboardList,
  Truck,
  BarChart3,
  Building2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Euro,
  ScrollText,
  Package,
  Banknote,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── helpers ─────────────────────────────────────────────────────────────────

function euro(v: number) {
  return `€${(v ?? 0).toLocaleString('lv-LV', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
  badge,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href?: string;
  badge?: number;
}) {
  const inner = (
    <div
      className={`bg-background border border-border rounded-2xl p-5 flex items-center gap-4 group ${href ? 'hover:border-foreground/20 cursor-pointer transition-colors' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-3xl font-extrabold text-foreground mt-0.5">{value}</p>
      </div>
      {!!badge && (
        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
          {badge}
        </span>
      )}
      {href && (
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

// ─── revenue card ─────────────────────────────────────────────────────────────

function RevenueCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-background border border-border rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-3xl font-extrabold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── monthly trend chart ──────────────────────────────────────────────────────

function TrendChart({
  data,
  valueKey,
  label,
  formatValue,
}: {
  data: AdminMonthlyTrend[];
  valueKey: 'orders' | 'gmv';
  label: string;
  formatValue: (v: number) => string;
}) {
  const values = data.map((d) => d[valueKey] as number);
  const max = Math.max(...values, 1);
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        {label}
      </p>
      <div className="flex items-end gap-2 h-24">
        {data.map((d, i) => {
          const v = d[valueKey] as number;
          const heightPct = Math.round((v / max) * 100);
          const [year, month] = d.month.split('-');
          const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString('lv-LV', {
            month: 'short',
          });
          const isLatest = i === data.length - 1;
          return (
            <div key={d.month} className="flex flex-col items-center gap-1.5 flex-1 group">
              <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                {formatValue(v)}
              </span>
              <div className="w-full flex items-end justify-center h-16">
                <div
                  className={`w-full rounded-t-sm transition-all ${isLatest ? 'bg-foreground' : 'bg-muted-foreground/25 group-hover:bg-muted-foreground/50'}`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
              <span
                className={`text-[10px] ${isLatest ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
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

// ─── main page ────────────────────────────────────────────────────────────────

export default function AdminOverviewPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!isLoading && token) {
      getAdminStats(token)
        .then(setStats)
        .finally(() => setLoading(false));
    }
  }, [isLoading, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-r-transparent" />
      </div>
    );
  }

  const trends = stats?.monthlyTrends ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Administrācija" description="Pārskats par platformas darbību" />

      {/* ── Revenue row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RevenueCard
          label="GMV kopā (pabeigts)"
          value={euro(stats?.gmvAllTime ?? 0)}
          sub="Visi pabeigto pasūtījumu apjomi"
          icon={Euro}
          accent="bg-emerald-50 text-emerald-700"
        />
        <RevenueCard
          label="GMV — pēdējās 30 dienas"
          value={euro(stats?.gmv30d ?? 0)}
          sub="Tikai pabeigti/piegādāti pasūtījumi"
          icon={TrendingUp}
          accent="bg-blue-50 text-blue-700"
        />
        <RevenueCard
          label="Komisija est. (30 dienas)"
          value={euro(stats?.commissionEst30d ?? 0)}
          sub="Aprēķināts pēc 10% likmes"
          icon={BarChart3}
          accent="bg-violet-50 text-violet-700"
        />
      </div>

      {/* ── Count stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Lietotāji"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="bg-blue-50 text-blue-700"
          href="/dashboard/admin/users"
        />
        <StatCard
          label="Uzņēmumi"
          value={stats?.totalCompanies ?? 0}
          icon={Building2}
          color="bg-indigo-50 text-indigo-700"
          href="/dashboard/admin/companies"
        />
        <StatCard
          label="Pasūtījumi"
          value={stats?.totalOrders ?? 0}
          icon={BarChart3}
          color="bg-purple-50 text-purple-700"
          href="/dashboard/admin/orders"
        />
        <StatCard
          label="Aktīvie darbi"
          value={stats?.activeJobs ?? 0}
          icon={Truck}
          color="bg-amber-50 text-amber-700"
          href="/dashboard/admin/jobs"
        />
        <StatCard
          label="Strīdi"
          value={stats?.openDisputes ?? 0}
          icon={AlertTriangle}
          color={
            stats?.openDisputes ? 'bg-red-50 text-red-700' : 'bg-muted/50 text-muted-foreground/50'
          }
          href="/dashboard/admin/disputes"
          badge={stats?.openDisputes || undefined}
        />
        <StatCard
          label="Pieteikumi"
          value={stats?.pendingApplications ?? 0}
          icon={ClipboardList}
          color={
            stats?.pendingApplications
              ? 'bg-orange-50 text-orange-700'
              : 'bg-muted/50 text-muted-foreground/50'
          }
          href="/dashboard/admin/applications"
          badge={stats?.pendingApplications || undefined}
        />
      </div>

      {/* ── Monthly trend charts ── */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dinamika — pēdējie 6 mēneši</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <TrendChart data={trends} valueKey="gmv" label="GMV (€)" formatValue={euro} />
              <TrendChart
                data={trends}
                valueKey="orders"
                label="Pasūtījumi"
                formatValue={(v) => String(v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Quick nav links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/admin/users"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-foreground">Pārvaldīt lietotājus</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/companies"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-foreground">Uzņēmumi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/orders"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-foreground">Visi pasūtījumi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/jobs"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-foreground">Transporta darbi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/disputes"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-foreground">Strīdi</span>
            {!!stats?.openDisputes && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                {stats.openDisputes}
              </span>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/applications"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Piegādātāju pieteikumi</span>
            {!!stats?.pendingApplications && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {stats.pendingApplications}
              </span>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/materials"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-teal-600" />
            <span className="font-semibold text-foreground">Materiālu katalogs</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/payments"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Banknote className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold text-foreground">Maksājumu rinda</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/audit-logs"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Audita žurnāls</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
