/**
 * Transporter (carrier) overview page — /dashboard/transporter
 * Shows available transport jobs, active jobs, and earnings summary.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import { getDashboardStats, type DashboardStats } from '@/lib/api';
import {
  Banknote,
  CalendarClock,
  Car,
  CheckCircle,
  ClipboardList,
  FolderOpen,
  Inbox,
  LayoutGrid,
  MapPin,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

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
            ? 'border-red-200 bg-red-50/60 hover:border-red-400'
            : 'border-border/50 bg-background hover:border-border'
        }`}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                action.primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
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

export default function TransporterDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);

  // Sync sidebar mode to CARRIER when this page is active
  useEffect(() => {
    setActiveMode('CARRIER');
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    );
  }

  const isDispatcher = Boolean(user.isCompany);

  const stats: Stat[] = [
    {
      label: 'Aktīvie Darbi',
      value: n(data?.activeJobs),
      icon: MapPin,
      hint: 'Piešķirtais transports',
    },
    {
      label: 'Pabeigti Šodien',
      value: n(data?.completedToday),
      icon: CheckCircle,
      hint: 'Piegādāts šodien',
    },
    {
      label: 'Gaida Samaksa',
      value: n(data?.awaitingPayment),
      icon: Banknote,
      hint: 'Gaida maksājumu',
    },
    {
      label: 'Mans Autoparks',
      value: n(data?.vehicleCount),
      icon: Car,
      hint: 'Reģistrētie transportlīdzekļi',
    },
  ];

  const driverActions: Action[] = [
    {
      label: 'Aktīvais Darbs',
      description: 'Maršruta statuss, GPS navigācija un piegādes apstiprināšana',
      icon: Zap,
      href: '/dashboard/active',
      primary: true,
    },
    {
      label: 'Job Board',
      description: 'Pieejamie transporta darbi ar karti un filtru pēc rādiusa',
      icon: MapPin,
      href: '/dashboard/jobs',
      primary: true,
    },
    {
      label: 'Darba Grafiks',
      description: 'Iestatīt pieejamību, darba laiku un bloķēt datumus',
      icon: CalendarClock,
      href: '/dashboard/schedule',
    },
    {
      label: 'Mans Autoparks',
      description: 'Pievienot un pārvaldīt savus transportlīdzekļus',
      icon: Car,
      href: '/dashboard/garage',
    },
    {
      label: 'Mani Darbi',
      description: 'Darbu vēsture un aktīvie piešķirtie pasūtījumi',
      icon: ClipboardList,
      href: '/dashboard/orders',
    },
    {
      label: 'Mani Dokumenti',
      description: 'CMR piezīmes, piegādes apstiprinājumi un rēķini',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ];

  const dispatcherActions: Action[] = [
    {
      label: 'Dispečera Panelis',
      description: 'Flotes statuss, aktīvie darbi un šoferu pārskats reāllaikā',
      icon: LayoutGrid,
      href: '/dashboard/fleet',
      primary: true,
    },
    {
      label: 'Job Board',
      description: 'Skatīt pieejamos darbus un piešķirt tos saviem šoferiem',
      icon: MapPin,
      href: '/dashboard/jobs',
      primary: true,
    },
    {
      label: 'Mans Autoparks',
      description: 'Pārvaldīt transportlīdzekļus un to piešķiršanu šoferiem',
      icon: Car,
      href: '/dashboard/garage',
    },
    {
      label: 'Darba Grafiks',
      description: 'Šoferu pieejamība un darba grafika plānošana',
      icon: CalendarClock,
      href: '/dashboard/schedule',
    },
    {
      label: 'Visi Darbi',
      description: 'Pilna darbu vēsture, statusi un žurnāls',
      icon: ClipboardList,
      href: '/dashboard/orders',
    },
    {
      label: 'Mani Dokumenti',
      description: 'Transporta dokumenti, atskaites un rēķini',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ];

  const actions = isDispatcher ? dispatcherActions : driverActions;

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title={`Sveiki, ${user.firstName}! 👋`}
        description={
          isDispatcher
            ? 'Uzraugiet floti, piešķiriet šoferus un pārvaldiet aktīvos darbus.'
            : 'Skatiet savus darbus, pārvaldiet grafiku un izsekojiet maršrutus.'
        }
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              🚛 {isDispatcher ? 'Dispečers' : 'Pārvadātājs'}
            </span>
            {isDispatcher && (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                🏢 Uzņēmums
              </span>
            )}
          </div>
        }
      />

      {/* Hero */}
      <div
        className={`rounded-2xl p-6 text-white shadow-sm ${
          isDispatcher
            ? 'bg-linear-to-br from-gray-800 to-gray-900'
            : 'bg-linear-to-br from-red-600 to-red-700'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {isDispatcher ? (
              <>
                <p className="text-lg font-bold">Dispečera panelis</p>
                <p className="text-sm text-gray-300">
                  Piešķiriet jaunus darbus un sekojiet flotes statusam.
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold">Gatavs braukšanai?</p>
                <p className="text-sm text-red-100">
                  Pārbaudiet pieejamos darbus un iestatiet savu statusu.
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isDispatcher ? (
              <>
                <Link
                  href="/dashboard/fleet"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white text-gray-800 px-4 py-2 text-sm font-semibold hover:bg-gray-100 transition-colors"
                >
                  <LayoutGrid className="h-4 w-4" /> Flote
                </Link>
                <Link
                  href="/dashboard/jobs"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-600 border border-gray-500 px-4 py-2 text-sm font-semibold hover:bg-gray-500 transition-colors"
                >
                  <MapPin className="h-4 w-4" /> Darbi
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard/active"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white text-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-50 transition-colors"
                >
                  <Zap className="h-4 w-4" /> Aktīvais darbs
                </Link>
                <Link
                  href="/dashboard/jobs"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 border border-red-400 px-4 py-2 text-sm font-semibold hover:bg-red-400 transition-colors"
                >
                  <MapPin className="h-4 w-4" /> Job Board
                </Link>
              </>
            )}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="mb-3 h-10 w-10 text-muted-foreground/25" />
            <p className="text-sm font-medium text-muted-foreground">Nav pēdējās aktivitātes</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Aktīvie darbi un piegādes parādīsīsies šeit.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
