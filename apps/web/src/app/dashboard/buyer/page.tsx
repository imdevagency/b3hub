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
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Package,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

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
      <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">{value}</span>
      <span className="text-[11px] sm:text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function ActionItem({ action }: { action: Action }) {
  return (
    <Link 
      href={action.href} 
      className="group flex items-center justify-between p-4 -mx-4 rounded-2xl hover:bg-muted/40 active:bg-muted/60 transition-all"
    >
      <div className="flex items-center gap-4">
        <div 
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors ${
            action.primary 
              ? 'bg-primary/10 text-primary group-hover:bg-primary/20' 
              : 'bg-muted text-foreground group-hover:bg-muted/80'
          }`}
        >
           <action.icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{action.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 pr-4">{action.description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-foreground transition-colors group-hover:translate-x-0.5" />
    </Link>
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-r-transparent" />
      </div>
    );
  }

  const actions: Action[] = [
    {
      label: 'Pasūtīt Materiālus',
      description: 'Smiltis, grants, betons, šķembas — no kataloga',
      icon: Package,
      href: '/dashboard/catalog',
      primary: true,
    },
    {
      label: 'Pasūtīt Konteineru',
      description: 'Rezervēt atkritumu konteineru savai darba vai mājas vietai',
      icon: Trash2,
      href: '/dashboard/order',
      primary: true,
    },
    {
      label: 'Mani Pasūtījumi',
      description: 'Izsekot visiem aktīvajiem pasūtījumiem un to statusam',
      icon: ClipboardList,
      href: '/dashboard/orders',
    },
    {
      label: 'Mani Dokumenti',
      description: 'Rēķini, svēršanas lapas un citi dokumenti',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ];

  return (
    <div className="w-full h-full p-4 sm:p-6 lg:p-8 pb-20 space-y-10">
      
      {/* HEADER SECTION */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Sveiki, {user.firstName}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Materiāli, konteineri vai pakalpojumi — viss vienā vietā.
          </p>
        </div>

        {/* QUICK STATS STRIP */}
        <div className="flex items-center gap-8 sm:gap-12 py-2">
          <QuickStat value={n(data?.activeOrders)} label="Procesā" />
          <QuickStat value={n(data?.awaitingDelivery)} label="Gaidāmās Piegādes" />
          <QuickStat value={n(data?.myOrders)} label="Konteineri" />
        </div>
      </div>

      {/* MAIN BANNER ACTION */}
      <Link 
        href="/dashboard/catalog"
        className="block relative overflow-hidden rounded-3xl bg-foreground text-background p-6 sm:p-8 transition-transform active:scale-[0.98] hover:shadow-lg"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Izpēti piedāvājumu
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold">Atver Katalogu</h2>
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
      <div className="space-y-1 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground px-4 mb-3">Ātrās Darbības</h2>
        {actions.map((action) => (
          <ActionItem key={action.label} action={action} />
        ))}
      </div>

    </div>
  );
}