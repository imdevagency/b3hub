'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Users, ClipboardList, Truck, BarChart3, RefreshCw, ArrowRight } from 'lucide-react';

// ── Admin stats ───────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  pendingApplications: number;
  activeJobs: number;
}

async function getAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/admin/stats`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

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
      className={`bg-white border rounded-2xl p-5 shadow-sm flex items-center gap-4 group ${href ? 'hover:border-gray-300 cursor-pointer transition-colors' : ''}`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-3xl font-extrabold text-gray-900 mt-0.5">{value}</p>
      </div>
      {href && (
        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
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
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administrācija</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pārskats par platformas darbību</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Lietotāji"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="bg-blue-50 text-blue-700"
          href="/dashboard/admin/users"
        />
        <StatCard
          label="Pasūtījumi"
          value={stats?.totalOrders ?? 0}
          icon={BarChart3}
          color="bg-purple-50 text-purple-700"
        />
        <StatCard
          label="Aktīvie darbi"
          value={stats?.activeJobs ?? 0}
          icon={Truck}
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Gaidošie pieteikumi"
          value={stats?.pendingApplications ?? 0}
          icon={ClipboardList}
          color={stats?.pendingApplications ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-400'}
          href="/dashboard/admin/applications"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/admin/users"
          className="flex items-center justify-between bg-white border rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Pārvaldīt lietotājus</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
        </Link>
        <Link
          href="/dashboard/admin/applications"
          className="flex items-center justify-between bg-white border rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-red-600" />
            <div>
              <span className="font-semibold text-gray-900">Piegādātāju pieteikumi</span>
              {!!stats?.pendingApplications && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold">
                  {stats.pendingApplications}
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
        </Link>
      </div>
    </div>
  );
}
