/**
 * Transporter (carrier) overview page — /dashboard/transporter
 * Shows available transport jobs, active jobs, and earnings summary.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useMode } from '@/lib/mode-context';
import {
  getDashboardStats,
  getSlaOverdueTransportJobs,
  getOpenTransportExceptions,
  reportTransportJobException,
  resolveTransportJobException,
  type DashboardStats,
  type ApiTransportJob,
  type ApiTransportJobException,
} from '@/lib/api';
import {
  AlertTriangle,
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
import { Button } from '@/components/ui/button';
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
            ? 'border-primary/20 bg-primary/5 hover:border-primary/40'
            : 'border-border/50 bg-background hover:border-border'
        }`}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                action.primary
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
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
  const [slaOverdues, setSlaOverdues] = useState<ApiTransportJob[]>([]);
  const [openExceptions, setOpenExceptions] = useState<ApiTransportJobException[]>([]);
  const [resolvingExceptionId, setResolvingExceptionId] = useState<string | null>(null);
  const [reportingSlaJobId, setReportingSlaJobId] = useState<string | null>(null);

  const refreshTriageQueues = async (authToken: string) => {
    const [slaRes, exRes] = await Promise.allSettled([
      getSlaOverdueTransportJobs(authToken),
      getOpenTransportExceptions(authToken),
    ]);
    if (slaRes.status === 'fulfilled') {
      setSlaOverdues(slaRes.value);
    }
    if (exRes.status === 'fulfilled') {
      setOpenExceptions(exRes.value);
    }
  };

  // Sync sidebar mode to CARRIER when this page is active
  useEffect(() => {
    setActiveMode('CARRIER');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;

    getDashboardStats(token)
      .then(setData)
      .catch(() => {});

    if (user.isCompany) {
      refreshTriageQueues(token).catch(() => {});
    }
  }, [user, token]);

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const isDispatcher = Boolean(user.isCompany);

  const handleResolveException = async (item: ApiTransportJobException) => {
    if (!token || !item.transportJobId) return;

    const resolution = window.prompt(
      'Norādiet atrisinājuma komentāru',
      'Atrisināts dispečera panelī',
    );
    if (!resolution || !resolution.trim()) return;

    setResolvingExceptionId(item.id);
    try {
      await resolveTransportJobException(
        item.transportJobId,
        item.id,
        resolution.trim(),
        token,
      );
      await refreshTriageQueues(token);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Neizdevās atrisināt izņēmumu');
    } finally {
      setResolvingExceptionId(null);
    }
  };

  const handleEscalateSla = async (job: ApiTransportJob) => {
    if (!token) return;

    const notes = window.prompt(
      'Aprakstiet SLA kavējuma iemeslu',
      `SLA kavējums: ${job.pickupCity} → ${job.deliveryCity}`,
    );
    if (!notes || !notes.trim()) return;

    setReportingSlaJobId(job.id);
    try {
      await reportTransportJobException(
        job.id,
        {
          type: 'OTHER',
          notes: notes.trim(),
          requiresDispatchAction: true,
        },
        token,
      );
      await refreshTriageQueues(token);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Neizdevās izveidot izņēmumu');
    } finally {
      setReportingSlaJobId(null);
    }
  };

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
            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
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
            : 'bg-linear-to-br from-primary to-primary/90'
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
                <p className="text-sm text-primary-foreground/80">
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/10 transition-colors"
                >
                  <Zap className="h-4 w-4" /> Aktīvais darbs
                </Link>
                <Link
                  href="/dashboard/jobs"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/30 transition-colors"
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

      {/* Dispatcher triage */}
      {isDispatcher && (
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Operatīvais Triāžas Panelis
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="shadow-none border-amber-200 bg-amber-50/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-900">
                    <CalendarClock className="h-4 w-4" />
                    SLA kavējumi
                  </CardTitle>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    {slaOverdues.length}
                  </span>
                </div>
                <CardDescription className="text-amber-800/80">
                  Darbi, kuri pārsniedz plānoto laika logu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {slaOverdues.length === 0 ? (
                  <p className="text-xs text-amber-900/70">Nav aktīvu SLA kavējumu.</p>
                ) : (
                  slaOverdues.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="rounded-lg border border-amber-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/dashboard/orders/${job.id}`}
                          className="text-xs font-semibold text-gray-900 hover:text-amber-700"
                        >
                          #{job.jobNumber}
                        </Link>
                        <span className="text-[11px] font-semibold text-red-700">
                          {job.sla?.overdueMinutes ?? 0} min
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {job.pickupCity} → {job.deliveryCity}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-gray-500">Nepieciešama dispečera rīcība</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => handleEscalateSla(job)}
                          disabled={reportingSlaJobId === job.id}
                        >
                          {reportingSlaJobId === job.id ? 'Saglabā...' : 'Izveidot izņēmumu'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-none border-red-200 bg-red-50/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-900">
                    <AlertTriangle className="h-4 w-4" />
                    Atvērtie izņēmumi
                  </CardTitle>
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                    {openExceptions.length}
                  </span>
                </div>
                <CardDescription className="text-red-800/80">
                  Situācijas, kam nepieciešama dispečera rīcība
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {openExceptions.length === 0 ? (
                  <p className="text-xs text-red-900/70">Nav atvērto izņēmumu.</p>
                ) : (
                  openExceptions.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/dashboard/orders/${item.transportJob?.id ?? ''}`}
                          className="text-xs font-semibold text-gray-900 hover:text-red-700"
                        >
                          #{item.transportJob?.jobNumber ?? '—'} · {item.type}
                        </Link>
                        <span className="text-[11px] font-semibold text-red-700">ATVĒRTS</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.notes}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-gray-500">
                          {item.transportJob?.pickupCity ?? '—'} → {item.transportJob?.deliveryCity ?? '—'}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => handleResolveException(item)}
                          disabled={resolvingExceptionId === item.id}
                        >
                          {resolvingExceptionId === item.id ? 'Saglabā...' : 'Atrisināt'}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
