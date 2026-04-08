/**
 * Transporter (carrier) overview page — /dashboard/transporter
 * Redesigned for a minimal, Uber-like aesthetic.
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
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Car,
  ClipboardList,
  FolderOpen,
  LayoutGrid,
  MapPin,
  Package,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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

export default function TransporterDashboardPage() {
  const { user, token, isLoading } = useAuth();
  const { setActiveMode } = useMode();
  const router = useRouter();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [slaOverdues, setSlaOverdues] = useState<ApiTransportJob[]>([]);
  const [openExceptions, setOpenExceptions] = useState<ApiTransportJobException[]>([]);
  const [resolvingExceptionId, setResolvingExceptionId] = useState<string | null>(null);
  const [reportingSlaJobId, setReportingSlaJobId] = useState<string | null>(null);
  // Inline note dialog (replaces window.prompt)
  const [noteDialog, setNoteDialog] = useState<{
    title: string;
    placeholder: string;
    onConfirm: (text: string) => void;
  } | null>(null);
  const [noteText, setNoteText] = useState('');

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

  useEffect(() => {
    setActiveMode('CARRIER');
  }, [setActiveMode]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
    else if (!isLoading && user && !user.canTransport) router.push('/dashboard');
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
    return <PageSpinner className="min-h-[60vh]" />;
  }

  const isDispatcher =
    Boolean(user.isCompany) && (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER');

  const handleResolveException = (item: ApiTransportJobException) => {
    setNoteText('Atrisiņāts dispeč era panelī');
    setNoteDialog({
      title: 'Atrisināt izņēmumu',
      placeholder: 'Atrisnājuma komentārs...',
      onConfirm: async (resolution) => {
        if (!token || !item.transportJobId) return;
        setResolvingExceptionId(item.id);
        try {
          await resolveTransportJobException(item.transportJobId, item.id, resolution, token);
          await refreshTriageQueues(token);
        } catch (error) {
          console.warn(
            'Failed to resolve exception',
            error instanceof Error ? error.message : error,
          );
        } finally {
          setResolvingExceptionId(null);
        }
      },
    });
  };

  const handleEscalateSla = (job: ApiTransportJob) => {
    setNoteText(`SLA kavējums: ${job.pickupCity} → ${job.deliveryCity}`);
    setNoteDialog({
      title: 'Eskalet pārkāpumu',
      placeholder: 'Aprakstiet SLA kavēj uma iemeslu...',
      onConfirm: async (notes) => {
        if (!token) return;
        setReportingSlaJobId(job.id);
        try {
          await reportTransportJobException(
            job.id,
            { type: 'OTHER', notes, requiresDispatchAction: true },
            token,
          );
          await refreshTriageQueues(token);
        } catch (error) {
          console.warn('Failed to escalate SLA', error instanceof Error ? error.message : error);
        } finally {
          setReportingSlaJobId(null);
        }
      },
    });
  };

  const driverActions: Action[] = [
    {
      label: 'Job Board',
      description: 'Atrodi un pieņem nākamo reisu',
      icon: MapPin,
      href: '/dashboard/jobs',
      primary: true,
    },
    {
      label: 'Mani Darbi',
      description: 'Vēsture un piešķirtie pasūtījumi',
      icon: ClipboardList,
      href: '/dashboard/orders',
    },
    {
      label: 'Darba Grafiks',
      description: 'Norādi savu pieejamību',
      icon: CalendarClock,
      href: '/dashboard/schedule',
    },
    {
      label: 'Mans Autoparks',
      description: 'Pārvaldi savus transportlīdzekļus',
      icon: Car,
      href: '/dashboard/garage',
    },
    ...(user.canSkipHire
      ? [
          {
            label: 'Konteineru Flote',
            description: 'Pārvaldi konteinerus un nomas pasūtījumus',
            icon: Package,
            href: '/dashboard/containers/fleet',
          },
          {
            label: 'Nesēja Iestatījumi',
            description: 'Cenas, zonas un pieejamība',
            icon: Settings,
            href: '/dashboard/transporter/settings',
          },
        ]
      : []),
    {
      label: 'Dokumenti',
      description: 'CMR, atskaites un rēķini',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
  ];

  const dispatcherActions: Action[] = [
    {
      label: 'Dispečera Panelis',
      description: 'Pārvaldi floti un aktīvos reisus reāllaikā',
      icon: LayoutGrid,
      href: '/dashboard/fleet',
      primary: true,
    },
    {
      label: 'Job Board',
      description: 'Meklē jaunus darbus uzņēmumam',
      icon: MapPin,
      href: '/dashboard/jobs',
    },
    {
      label: 'Autoparks',
      description: 'Pārvaldi tehniku un šoferus',
      icon: Car,
      href: '/dashboard/garage',
    },
    {
      label: 'Darbu Vēsture',
      description: 'Visi uzņēmuma darbi un statistika',
      icon: ClipboardList,
      href: '/dashboard/orders',
    },
    {
      label: 'Dokumenti',
      description: 'Atskaites, CMR un rēķini',
      icon: FolderOpen,
      href: '/dashboard/documents',
    },
    ...(user.canSkipHire
      ? [
          {
            label: 'Konteineru Flote',
            description: 'Pārvaldi konteinerus un nomas pasūtījumus',
            icon: Package,
            href: '/dashboard/containers/fleet',
          },
          {
            label: 'Nesēja Iestatījumi',
            description: 'Cenas, zonas un pieejamība',
            icon: Settings,
            href: '/dashboard/transporter/settings',
          },
        ]
      : []),
  ];

  const actions = isDispatcher ? dispatcherActions : driverActions;
  const focusAction = isDispatcher
    ? { href: '/dashboard/fleet', title: 'Atvērt dispečera karti' }
    : { href: '/dashboard/active', title: 'Atvērt aktīvo darbu' };

  return (
    <div className="w-full h-full pb-20 space-y-10">
      {/* HEADER SECTION */}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Sveiki, {user.firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {isDispatcher
              ? 'Dispečera režīms — Tava flote ir gatava'
              : 'Šofera režīms — Tavs ceļš gaida'}
          </p>
        </div>

        {/* QUICK STATS STRIP */}
        <div className="flex items-center gap-8 sm:gap-12 py-2">
          <QuickStat value={n(data?.activeJobs)} label="Aktīvi Darbi" />
          <QuickStat value={n(data?.completedToday)} label="Pabeigti Šodien" />
          {isDispatcher && <QuickStat value={n(data?.vehicleCount)} label="Tehnika" />}
        </div>
      </div>

      {/* MAIN BANNER ACTION */}
      <Link
        href={focusAction.href}
        className="block relative overflow-hidden rounded-3xl bg-foreground text-background p-6 sm:p-8 transition-transform active:scale-[0.98] hover:shadow-lg"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/20 text-xs font-medium mb-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Tiešsaistē
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold">{focusAction.title}</h2>
            <p className="text-background/70 text-sm mt-1">
              {isDispatcher
                ? 'Pārskati šoferu lokācijas un maršrutus'
                : 'Seko navigācijai un atzīmē statusus'}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-background/10 flex items-center justify-center shrink-0">
            <ArrowRight className="h-6 w-6 text-background" />
          </div>
        </div>
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-background/5 rounded-full blur-3xl pointer-events-none" />
      </Link>

      {/* DISPATCHER TRIAGE */}
      {isDispatcher && (slaOverdues.length > 0 || openExceptions.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Kritiskie Notikumi
          </h2>
          <div className="space-y-2">
            {slaOverdues.map((job) => (
              <div
                key={job.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
              >
                <div className="flex gap-3">
                  <CalendarClock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-amber-900">
                      SLA Kavējums • {job.sla?.overdueMinutes ?? 0} min
                    </span>
                    <p className="text-xs text-amber-800/80 mt-0.5">
                      Reiss #{job.jobNumber}: {job.pickupCity} → {job.deliveryCity}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-background/50 hover:bg-background border-amber-500/30 text-amber-900 w-full sm:w-auto"
                  onClick={() => handleEscalateSla(job)}
                  disabled={reportingSlaJobId === job.id}
                >
                  {reportingSlaJobId === job.id ? 'Reģistrē...' : 'Apstrādāt'}
                </Button>
              </div>
            ))}

            {openExceptions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20"
              >
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-semibold text-red-900">
                      Izņēmums • #{item.transportJob?.jobNumber ?? '—'}
                    </span>
                    <p className="text-xs text-red-800/80 mt-0.5 line-clamp-1">{item.notes}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-background/50 hover:bg-background border-red-500/30 text-red-900 w-full sm:w-auto"
                  onClick={() => handleResolveException(item)}
                  disabled={resolvingExceptionId === item.id}
                >
                  {resolvingExceptionId === item.id ? 'Saglabā...' : 'Atrisināt'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MINIMAL MENU LIST */}
      <div className="space-y-1 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground px-4 mb-3">
          Izvēlne
        </h2>
        {actions.map((action) => (
          <ActionListItem key={action.label} {...action} />
        ))}
      </div>

      {/* Inline note dialog — replaces window.prompt */}
      <Dialog
        open={!!noteDialog}
        onOpenChange={(open) => {
          if (!open) setNoteDialog(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{noteDialog?.title}</DialogTitle>
            <DialogDescription>Pievienojiet komentāru pirms turpināt.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder={noteDialog?.placeholder}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>
              Atcelt
            </Button>
            <Button
              disabled={!noteText.trim()}
              onClick={() => {
                noteDialog?.onConfirm(noteText.trim());
                setNoteDialog(null);
              }}
            >
              Apstiprināt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
