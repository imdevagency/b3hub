/**
 * Buyer overview page — /dashboard/buyer
 * Shows the buyer's active orders, recent activity, and quick-action shortcuts.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import {
  ClipboardList,
  FolderOpen,
  Inbox,
  Package,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/page-spinner';

type Stat = { label: string; value: string; icon: LucideIcon; hint?: string };
type Action = {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  primary?: boolean;
};

const n = (v?: number) => (v !== undefined ? String(v) : '—');

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
            ? 'border-blue-200 bg-blue-50/60 hover:border-blue-400'
            : 'border-border/50 bg-background hover:border-border'
        }`}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                action.primary ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
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

export default function BuyerDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);

  // Sync sidebar mode to BUYER when this page is active
  useEffect(() => {
    setActiveMode('BUYER');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user && token)
      getDashboardStats(token)
        .then(setData)
        .catch(() => {});
  }, [user, token]);

  if (isLoading || !user) {
    return <PageSpinner />;
  }

  const stats: Stat[] = [
    {
      label: 'Aktīvie Pasūtījumi',
      value: n(data?.activeOrders),
      icon: ShoppingCart,
      hint: 'Procesā',
    },
    { label: 'Konteineru Pasūtījumi', value: n(data?.myOrders), icon: Trash2, hint: 'Skip hire' },
    {
      label: 'Gaida Piegāde',
      value: n(data?.awaitingDelivery),
      icon: Truck,
      hint: 'Gaidāmās piegādes',
    },
    {
      label: 'Mani Dokumenti',
      value: n(data?.documents),
      icon: FolderOpen,
      hint: 'Rēķini un lapas',
    },
  ];

  const actions: Action[] = [
    {
      label: 'Pasūtīt Materiālus',
      description: 'Smiltis, grants, betons, šķembas — ātra pasūtīšana tiešri no kataloga',
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
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={`Sveiki, ${user.firstName}!`}
        description="Pasūtiet materiālus, konteinerus un sekojiet savām piegādēm."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              🛒 Pasūtītājs
            </span>
            {user.isCompany && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                🏢 Uzņēmums
              </span>
            )}
          </div>
        }
      />

      {/* Hero */}
      <div className="rounded-2xl bg-linear-to-br from-blue-600 to-blue-700 p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-lg font-bold">Kas jums vajadzīgs šodien?</p>
            <p className="text-sm text-blue-100">
              Materiāli, konteineri vai pakalpojumi — viss vienā vietā.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/catalog"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white text-blue-700 px-4 py-2 text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              <Package className="h-4 w-4" /> Materiāli
            </Link>
            <Link
              href="/dashboard/order"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 border border-blue-400 px-4 py-2 text-sm font-semibold hover:bg-blue-400 transition-colors"
            >
              <Trash2 className="h-4 w-4" /> Konteiners
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      {/* Actions */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ātrās darbības
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => (
            <ActionCard key={a.label} action={a} />
          ))}
        </div>
      </div>

      {/* Activity */}
      <div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Pēdējā aktivitāte
        </p>
        <Card className="shadow-none border-border/50">
          <CardContent className="p-0">
            <EmptyState
              icon={Inbox}
              title="Nav pēdējās aktivitātes"
              description="Jūsu pasūtījumi parādīsīsies šeit."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
