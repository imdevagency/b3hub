/**
 * Buyer overview page — /dashboard/buyer
 * Redesigned for a minimal, Uber-like aesthetic.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import {
  ArrowRight,
  ClipboardList,
  Trash2,
  Package,
  MessageSquare,
  FolderKanban,
  Receipt,
  Truck,
  Recycle,
} from 'lucide-react';
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

export default function BuyerDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);

  // Sync sidebar mode to BUYER
  useEffect(() => {
    setActiveMode('BUYER');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
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
      label: 'Pasūtīt Materiālus',
      description: 'Grants, smiltis, betona izstrādājumi un citi materiāli',
      icon: Package,
      href: '/dashboard/catalog',
      primary: true,
    },
    {
      label: 'Mani Pasūtījumi',
      description: 'Izsekot visiem aktīvajiem pasūtījumiem un to statusam',
      icon: ClipboardList,
      href: '/dashboard/orders',
    },
    {
      label: 'Cenu Aptauja',
      description: 'Pieprasīt piedāvājumus no piegādātājiem',
      icon: MessageSquare,
      href: '/dashboard/quote-requests',
    },
    {
      label: 'Pasūtīt Konteineru',
      description: 'Rezervēt atkritumu konteineru savai darba vai mājas vietai',
      icon: Trash2,
      href: '/dashboard/order/skip-hire',
    },
    {
      label: 'Utilizācija',
      description: 'Atkritumu izvešana bez konteinera — kravas auto iebrauc un aizved',
      icon: Recycle,
      href: '/dashboard/order/disposal',
    },
    {
      label: 'Kravas Transports',
      description: 'Jebkuras kravas pārvadāšana no punkta A uz punktu B',
      icon: Truck,
      href: '/dashboard/order/transport',
    },
    {
      label: 'Projekti',
      description: 'Būvdarbu projektu pārvaldība un pasūtījumu grupēšana',
      icon: FolderKanban,
      href: '/dashboard/projects',
    },
    {
      label: 'Rēķini & Dokumenti',
      description: 'Rēķini, svēršanas lapas un piegādes dokumenti',
      icon: Receipt,
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
            Materiāli, konteineri vai pakalpojumi — viss vienā vietā.
          </p>
        </div>

        {/* QUICK STATS STRIP */}
        <div className="grid grid-cols-3 border border-gray-200 rounded-xl bg-white divide-x divide-gray-200 overflow-hidden">
          <div className="px-5 py-4">
            <QuickStat value={n(data?.activeOrders)} label="Procesā" />
          </div>
          <div className="px-5 py-4">
            <QuickStat value={n(data?.awaitingDelivery)} label="Gaidāmās Piegādes" />
          </div>
          <div className="px-5 py-4">
            <QuickStat value={n(data?.myOrders)} label="Pasūtījumi" />
          </div>
        </div>
      </div>

      {/* MAIN BANNER ACTION */}
      <Link
        href="/dashboard/catalog"
        className="block relative overflow-hidden rounded-xl bg-foreground text-background p-6 sm:p-8 transition-transform active:scale-[0.98] hover:shadow-lg"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              {data?.activeOrders
                ? `${data.activeOrders} aktīvi pasūtījumi`
                : 'Izpēti piedāvājumus'}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold">Pasūtīt Materiālus</h2>
            <p className="text-background/70 text-sm mt-1">
              Pasūti materiālus un pakalpojumus no piegādātājiem
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
