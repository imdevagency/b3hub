/**
 * Supplier overview page — /dashboard/supplier
 * Redesigned for a minimal, Uber-like aesthetic.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import { ArrowRight, BarChart3, FolderOpen, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ActionListItem } from '@/components/ui/action-list-item';
import { PageSpinner } from '@/components/ui/page-spinner';

type Action = {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
};

const n = (v?: number) => (v !== undefined ? String(v) : '0');
const money = (v?: number) => (v !== undefined ? `€${Math.round(v).toLocaleString('lv-LV')}` : '—');

function QuickStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
        {value}
      </span>
      <span className="text-[11px] sm:text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export default function SupplierDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);

  // Sync sidebar mode to SUPPLIER
  useEffect(() => {
    setActiveMode('SUPPLIER');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    else if (!isLoading && user && !user.canSell) router.push('/dashboard');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;

    getDashboardStats(token)
      .then(setData)
      .catch(() => {});
  }, [user, token]);

  if (isLoading || !user) {
    return <PageSpinner className="min-h-[60vh]" />;
  }

  const actions: Action[] = [
    {
      label: 'Mani Materiāli',
      description: 'Pārvaldīt savus materiālu sludinājumus, cenas un krājumus',
      icon: Package,
      href: '/dashboard/materials',
      primary: true,
    },
    {
      label: 'Pievienot Materiālu',
      description: 'Publicēt jaunu produktu vai pakalpojumu',
      icon: Plus,
      href: '/dashboard/materials?new=true',
      primary: true,
    },
    {
      label: 'Analītika',
      description: 'Pārdošanas statistika un produktu veiktspējas rādītāji',
      icon: BarChart3,
      href: '/dashboard/analytics',
    },
    {
      label: 'Mani Dokumenti',
      description: 'Rēķini, līgumi un materiālu sertifikāti',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ];

  return (
    <div className="w-full h-full pb-20 space-y-10">
      {/* HEADER SECTION */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Sveiki, {user.firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Pārvaldi sludinājumus un ienākošos pasūtījumus.
          </p>
        </div>

        {/* QUICK STATS STRIP */}
        <div className="grid grid-cols-3 border border-gray-200 rounded-xl bg-white divide-x divide-gray-200 overflow-hidden">
          <div className="px-5 py-4"><QuickStat value={n(data?.pendingOrders)} label="Gaida Izpildi" /></div>
          <div className="px-5 py-4"><QuickStat value={n(data?.activeListings)} label="Aktīvi Sludinājumi" /></div>
          <div className="px-5 py-4"><QuickStat value={money(data?.monthlyRevenue)} label="Mēneša Ieņēmumi" /></div>
        </div>
      </div>

      {/* MAIN BANNER ACTION */}
      <Link
        href="/dashboard/orders"
        className="block relative overflow-hidden rounded-xl bg-foreground text-background p-6 sm:p-8 transition-transform active:scale-[0.98] hover:shadow-lg"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              {data?.pendingOrders
                ? `${data.pendingOrders} gaidoši pasūtījumi`
                : 'Izskati pieprasījumus'}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold">Atver Pasūtījumus</h2>
            <p className="text-background/70 text-sm mt-1">
              Apstrādā ienākošos materiālu un tehnikas pasūtījumus
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-background/10 flex items-center justify-center shrink-0">
            <ArrowRight className="h-6 w-6 text-background" />
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-background/5 rounded-full blur-3xl pointer-events-none" />
      </Link>

      {/* MINIMAL MENU LIST */}
      <div className="pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Ātrās Darbības
        </h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white divide-y divide-gray-100">
          {actions.map((action) => (
            <ActionListItem key={action.label} {...action} />
          ))}
        </div>
      </div>
    </div>
  );
}
