/**
 * B3 Group — Central Hub Overview
 * /dashboard/group
 *
 * Platform overview showing B3 App (marketplace) KPIs.
 * B3 Recycling and B3 Construction use the same platform portal as external operators.
 */
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { getAdminStats, type AdminStats } from '@/lib/api/admin';

// ─── helpers ─────────────────────────────────────────────────────────────────

function eur(v: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v ?? 0);
}

function num(v: number) {
  return (v ?? 0).toLocaleString('lv-LV');
}

// ─── stat row inside a BU card ────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${accent ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── business unit card ───────────────────────────────────────────────────────

function BuCard({
  title,
  subtitle,
  href,
  icon: Icon,
  badge,
  badgeVariant,
  stats,
  iconColor,
}: {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
  stats: { label: string; value: string | number; accent?: string }[];
  iconColor: string;
}) {
  return (
    <Link href={href} className="group block focus:outline-none">
      <div className="flex flex-col h-full rounded-2xl border border-gray-200 bg-white p-5 hover:border-gray-300 hover:shadow-sm transition-all">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-gray-50 ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {badge !== undefined && Number(badge) > 0 && (
            <Badge variant={badgeVariant ?? 'destructive'} className="shrink-0">
              {Number(badge) > 99 ? '99+' : badge}
            </Badge>
          )}
        </div>
        <div className="flex-1 space-y-1">
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} accent={s.accent} />
          ))}
        </div>
      </div>
    </Link>
  );
}

// ─── group KPI chip ────────────────────────────────────────────────────────────

function GroupKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col pt-2 pb-4">
      <p className="text-[13px] font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

interface GroupData {
  hub: AdminStats;
}

export default function GroupOverviewPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || !token) return;

    const load = async () => {
      const hubRes = await Promise.allSettled([getAdminStats(token)]);
      const hub = hubRes[0].status === 'fulfilled' ? hubRes[0].value : null;
      if (hub) setData({ hub });
      setLoading(false);
    };

    load();
  }, [isLoading, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground text-sm">
        Neizdevās ielādēt datus. Mēģiniet vēlreiz.
      </div>
    );
  }

  const { hub } = data;

  const hubAlerts =
    (hub.pendingApplications ?? 0) + (hub.openDisputes ?? 0) + (hub.openSupport ?? 0);

  const groupRevenue = hub.gmvAllTime ?? 0;
  const groupRevenue30d = hub.gmv30d ?? 0;

  return (
    <div className="space-y-12">
      <PageHeader
        title="B3 Grupa"
        description="Grupas operāciju pārskats un biznesu vienību KPI."
      />

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <GroupKpi label="Platformas GMV kopā" value={eur(groupRevenue)} />
        <GroupKpi label="Platformas GMV (30 d.)" value={eur(groupRevenue30d)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BuCard
          title="B3 App"
          subtitle="Tirdzniecības un loģistikas platforma"
          href="/dashboard/admin"
          icon={ShoppingBag}
          badge={hubAlerts}
          badgeVariant="destructive"
          iconColor="text-gray-900"
          stats={[
            { label: 'GMV kopā', value: eur(hub.gmvAllTime ?? 0) },
            { label: 'GMV (30 d.)', value: eur(hub.gmv30d ?? 0) },
            { label: 'Komisijas (30 d.)', value: eur(hub.commissionEst30d ?? 0) },
            { label: 'Visi pasūtījumi', value: num(hub.totalOrders ?? 0) },
            { label: 'Transporta darbi', value: num(hub.activeJobs ?? 0) },
            { label: 'Lietotāji', value: num(hub.totalUsers ?? 0) },
            {
              label: 'Brīdinājumi',
              value: hubAlerts > 0 ? `${hubAlerts} ⚠` : '—',
              accent: hubAlerts > 0 ? 'text-red-600' : 'text-gray-400',
            },
          ]}
        />
      </div>
    </div>
  );
}
