/**
 * Admin overview page — /dashboard/admin
 * Platform-wide statistics: total users, orders, revenue, and pending applications.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getAdminStats, type AdminStats } from '@/lib/api/admin';
import {
  Users,
  ClipboardList,
  Truck,
  BarChart3,
  Building2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href?: string;
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
      {href && (
        <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6">
      <PageHeader title="Administrācija" description="Pārskats par platformas darbību" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
          label="Gaidošie pieteikumi"
          value={stats?.pendingApplications ?? 0}
          icon={ClipboardList}
          color={
            stats?.pendingApplications
              ? 'bg-red-50 text-red-700'
              : 'bg-muted/50 text-muted-foreground/50'
          }
          href="/dashboard/admin/applications"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/dashboard/admin/users"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-5 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-foreground">Pārvaldīt lietotājus</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/companies"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-5 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold text-foreground">Uzņēmumi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/orders"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-5 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <span className="font-semibold text-foreground">Visi pasūtījumi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/jobs"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-5 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-foreground">Transporta darbi</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/admin/applications"
          className="flex items-center justify-between bg-background border border-border rounded-2xl p-5 hover:border-foreground/20 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <span className="font-semibold text-foreground">Piegādātāju pieteikumi</span>
              {!!stats?.pendingApplications && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {stats.pendingApplications}
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
