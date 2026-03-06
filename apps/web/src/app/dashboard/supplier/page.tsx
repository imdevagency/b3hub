'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import {
  BarChart3,
  ClipboardList,
  FolderOpen,
  Inbox,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type Stat = { label: string; value: string; icon: LucideIcon; hint?: string };
type Action = { label: string; description: string; icon: LucideIcon; href: string; primary?: boolean };

const n = (v?: number) => (v !== undefined ? String(v) : '—');
const money = (v?: number) => (v !== undefined ? `€${Math.round(v).toLocaleString('lv-LV')}` : '—');

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Card className="shadow-none border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-4 px-4">
        <CardDescription className="text-xs font-medium">{stat.label}</CardDescription>
        <stat.icon className="h-4 w-4 text-muted-foreground/60" />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
        {stat.hint && <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>}
      </CardContent>
    </Card>
  );
}

function ActionCard({ action }: { action: Action }) {
  return (
    <Link href={action.href} className="group block">
      <Card
        className={`h-full shadow-none transition-all group-hover:-translate-y-0.5 group-hover:shadow-sm ${
          action.primary
            ? 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-400'
            : 'border-border/50 bg-background hover:border-border'
        }`}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                action.primary ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <action.icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-semibold leading-tight">{action.label}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">{action.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SupplierDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);

  // Sync sidebar mode to SUPPLIER when this page is active
  useEffect(() => { setActiveMode('SUPPLIER'); }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && token) getDashboardStats(token).then(setData).catch(() => {});
  }, [user, token]);

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
      </div>
    );
  }

  const stats: Stat[] = [
    { label: 'Aktīvie Sludinājumi', value: n(data?.activeListings), icon: Package, hint: 'Publicēti produkti' },
    { label: 'Gaida Pasūtījumi', value: n(data?.pendingOrders), icon: ShoppingCart, hint: 'Gaida izpildi' },
    { label: 'Mēneša Ieņēmumi', value: money(data?.monthlyRevenue), icon: TrendingUp, hint: 'Šajā mēnesī' },
    { label: 'Mani Dokumenti', value: n(data?.documents), icon: FolderOpen, hint: 'Rēķini un līgumi' },
  ];

  const actions: Action[] = [
    { label: 'Mani Materiāli', description: 'Pārvaldīt savus materiālu sludinājumus, cenas un krājumus', icon: Package, href: '/dashboard/materials', primary: true },
    { label: 'Pievienot Materiālu', description: 'Publicēt jaunu produktu vai pakalpojumu katalogā', icon: Plus, href: '/dashboard/materials/new', primary: true },
    { label: 'Ienākošie Pasūtījumi', description: 'Skatīt un apstrādāt jaunus pasūtījumus no pircējiem', icon: ClipboardList, href: '/dashboard/orders' },
    { label: 'Analītika', description: 'Pārdošanas statistika un produktu veiktspējas rādītāji', icon: BarChart3, href: '/dashboard/orders' },
    { label: 'Mani Dokumenti', description: 'Rēķini, līgumi un materiālu sertifikāti', icon: FolderOpen, href: '/dashboard/documents' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sveiki, {user.firstName}! 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pārvaldiet savus sludinājumus un apstrādājiet ienākošos pasūtījumus.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          📦 Piegādātājs
        </span>
      </div>

      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-lg font-bold">Jūsu produkti tirgo B3Hub</p>
            <p className="text-sm text-emerald-100">Pievienojiet vairāk produktu, lai palielinātu pārdošanas apjomu.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/materials/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white text-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-50 transition-colors"
            >
              <Plus className="h-4 w-4" /> Pievienot produktu
            </Link>
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 border border-emerald-400 px-4 py-2 text-sm font-semibold hover:bg-emerald-400 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" /> Pasūtījumi
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => <StatCard key={s.label} stat={s} />)}
      </div>

      {/* Actions */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ātrās darbības</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((a) => <ActionCard key={a.label} action={a} />)}
        </div>
      </div>

      {/* Activity */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pēdējā aktivitāte</p>
        <Card className="shadow-none border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/25" />
            <p className="text-sm font-medium text-muted-foreground">Nav pēdējās aktivitātes</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Jaunas pasūtījumi un pārdošanas parādīsīsies šeit.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
