/**
 * Active jobs page — /dashboard/active
 * Redesigned Table List View with Details in a Side Sheet.
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const FleetMap = dynamic(() => import('@/components/fleet-map').then((m) => m.FleetMap), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 flex items-center justify-center animate-pulse">
      <MapPin className="h-8 w-8 text-slate-300" />
    </div>
  ),
});
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Truck,
  MapPin,
  Package,
  Radio,
  AlertTriangle,
  X,
  Clock,
  CheckCircle2,
  Circle,
  PhoneCall,
  Calendar,
  ExternalLink,
  User,
  MoreVertical,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useAuth } from '@/lib/auth-context';
import {
  getAllTransportJobs,
  getOpenTransportExceptions,
  type ApiTransportJob,
  type ApiTransportJobException,
} from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  ASSIGNED: {
    label: 'Piešķirts',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-100 border-amber-200',
  },
  ACCEPTED: {
    label: 'Pieņemts',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-100 border-amber-200',
  },
  EN_ROUTE_PICKUP: {
    label: 'Ceļā uz iekraušanu',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    bg: 'bg-sky-100 border-sky-200',
  },
  AT_PICKUP: {
    label: 'Iekraušanā',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    bg: 'bg-sky-100 border-sky-200',
  },
  LOADED: {
    label: 'Iekrauts',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700',
    bg: 'bg-indigo-100 border-indigo-200',
  },
  EN_ROUTE_DELIVERY: {
    label: 'Ceļā uz piegādi',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-100 border-emerald-200',
  },
  AT_DELIVERY: {
    label: 'Izkraušanā',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-100 border-emerald-200',
  },
  DELIVERED: {
    label: 'Piegādāts',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-100 border-emerald-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-100 border-red-200',
  },
};

const STATUS_TIMELINE: { key: string; label: string }[] = [
  { key: 'ASSIGNED', label: 'Piešķirts' },
  { key: 'ACCEPTED', label: 'Pieņemts' },
  { key: 'EN_ROUTE_PICKUP', label: 'Ceļā uz iekraušanu' },
  { key: 'AT_PICKUP', label: 'Iekraušanas vietā' },
  { key: 'LOADED', label: 'Iekrauts' },
  { key: 'EN_ROUTE_DELIVERY', label: 'Ceļā uz piegādi' },
  { key: 'AT_DELIVERY', label: 'Piegādes vietā' },
  { key: 'DELIVERED', label: 'Piegādāts' },
];

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  DRIVER_NO_SHOW: 'Vadītājs neieradās',
  SUPPLIER_NOT_READY: 'Piegādātājs nav gatavs',
  WRONG_MATERIAL: 'Nepareizs materiāls',
  PARTIAL_DELIVERY: 'Daļēja piegāde',
  REJECTED_DELIVERY: 'Piegāde noraidīta',
  SITE_CLOSED: 'Objekts slēgts',
  OVERWEIGHT: 'Pārslogots',
  OTHER: 'Cits',
};

function isLate(job: ApiTransportJob): boolean {
  if (!job.deliveryDate) return false;
  const deadline = new Date(job.deliveryDate).getTime();
  return Date.now() > deadline;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: 'bg-slate-500',
    text: 'text-slate-700',
    bg: 'bg-slate-100 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusTimeline({
  currentStatus,
  timestamps,
}: {
  currentStatus: string;
  timestamps: Record<string, string> | null | undefined;
}) {
  const currentIdx = STATUS_TIMELINE.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex flex-col gap-0">
      {STATUS_TIMELINE.map((step, idx) => {
        const ts = timestamps?.[step.key];
        const isDone = idx < currentIdx || ts !== undefined || currentStatus === 'DELIVERED';
        const isCurrent = step.key === currentStatus;

        return (
          <div key={step.key} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-4 w-4 items-center justify-center rounded-full mt-0.5 ${
                  isCurrent
                    ? 'bg-black ring-4 ring-slate-100'
                    : isDone
                      ? 'bg-slate-900'
                      : 'bg-slate-200'
                }`}
              >
                {isDone && !isCurrent && (
                  <CheckCircle2 className="h-4 w-4 text-slate-900 absolute opacity-0" />
                )}
              </div>
              {idx < STATUS_TIMELINE.length - 1 && (
                <div
                  className={`w-px flex-1 my-1 ${isDone && !isCurrent ? 'bg-slate-900' : 'bg-slate-200'}`}
                  style={{ minHeight: 24 }}
                />
              )}
            </div>
            <div className="pb-4">
              <p
                className={`text-sm font-semibold ${isCurrent ? 'text-black' : isDone ? 'text-slate-800' : 'text-slate-400'}`}
              >
                {step.label}
              </p>
              {ts && (
                <p className="text-[10px] font-medium uppercase text-slate-400 mt-0.5">{fmt(ts)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JobDetailSheet({
  job,
  exceptions,
  open,
  onOpenChange,
}: {
  job: ApiTransportJob | null;
  exceptions: ApiTransportJobException[];
  open: boolean;
  onOpenChange: (val: boolean) => void;
}) {
  if (!job)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[480px] p-0">
          <VisuallyHidden>
            <SheetTitle>Job Details</SheetTitle>
          </VisuallyHidden>
        </SheetContent>
      </Sheet>
    );

  const late = isLate(job);
  const openExceptions = exceptions.filter(
    (e) => e.transportJobId === job.id && e.status === 'OPEN',
  );
  const timestamps = (job.statusTimestamps || {}) as Record<string, string>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[480px] p-0 flex flex-col" side="right">
        <VisuallyHidden>
          <SheetTitle>Job Details</SheetTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="bg-black p-6 text-white shrink-0 shadow-lg z-10 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Piegādes detaļas
              </p>
              <h2 className="text-2xl font-bold">
                #{job.jobNumber ?? job.id.slice(-6).toUpperCase()}
              </h2>
            </div>
          </div>
          <div className="mt-2 text-sm">
            <StatusBadge status={job.status} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 gap-6 flex flex-col bg-slate-50">
          {/* Exceptions */}
          {openExceptions.length > 0 && (
            <div className="rounded-xl border-l-4 border-red-500 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-3">
                Problēmas ({openExceptions.length})
              </p>
              <div className="flex flex-col gap-3">
                {openExceptions.map((ex) => (
                  <div key={ex.id} className="flex gap-3 text-sm text-slate-800">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}</p>
                      <p className="text-slate-500">{ex.notes || ex.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map View */}
          <div className="h-[200px] w-full rounded-xl overflow-hidden shadow-sm border border-slate-200 shrink-0">
            <FleetMap jobs={[job]} liveLocations={{}} />
          </div>

          {/* Route Block */}
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-150">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-5">
              Maršruts
            </p>
            <div className="relative flex items-stretch gap-5 pl-1">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200" />
              <div className="flex flex-col justify-between py-0.5 gap-8 w-full">
                <div className="flex items-start gap-5 relative">
                  <div className="h-4 w-4 rounded-full bg-slate-900 ring-4 ring-white z-10" />
                  <div className="min-w-0 -mt-1.5">
                    <p className="text-base font-bold text-slate-900">{job.pickupCity}</p>
                    <p className="text-sm text-slate-500 truncate">{job.pickupAddress}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                      Plānots: {fmtDate(job.pickupDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-5 relative">
                  <div className="h-4 w-4 rounded-sm bg-black ring-4 ring-white z-10" />
                  <div className="min-w-0 -mt-1.5">
                    <p className="text-base font-bold text-slate-900">{job.deliveryCity}</p>
                    <p className="text-sm text-slate-500 truncate">{job.deliveryAddress}</p>
                    <p
                      className={`text-[10px] mt-1 uppercase ${late ? 'text-red-500 font-extrabold' : 'text-slate-400 font-bold'}`}
                    >
                      Plānots: {fmtDate(job.deliveryDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cargo & Vehicle Split */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-150">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Krava
              </p>
              <p className="font-bold text-base text-slate-900">{job.cargoType ?? '—'}</p>
              {job.cargoWeight && (
                <p className="text-sm font-medium text-slate-500 mt-0.5">{job.cargoWeight} t</p>
              )}
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-150">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                T/L
              </p>
              <p className="font-bold text-base text-slate-900">
                {job.vehicle?.licensePlate ?? '—'}
              </p>
            </div>
          </div>

          {/* Driver Block */}
          {job.driver && (
            <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-150 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {job.driver.firstName} {job.driver.lastName}
                  </p>
                  <p className="text-sm font-medium text-slate-500">Vadītājs</p>
                </div>
              </div>
              {job.driver.phone && (
                <a
                  href={`tel:${job.driver.phone}`}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white hover:bg-slate-800 transition shadow-md"
                >
                  <PhoneCall className="h-5 w-5" />
                </a>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-150 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">
              Statusa vēsture
            </p>
            <StatusTimeline currentStatus={job.status} timestamps={timestamps} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ActiveDashboardPage() {
  const { token, user } = useAuth();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [exceptions, setExceptions] = useState<ApiTransportJobException[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(
    async (silent = false) => {
      // eslint-disable-line @typescript-eslint/no-unused-vars
      if (!token || !user) return;
      if (!silent) setLoading(true);
      try {
        const [jobsRes, exRes] = await Promise.all([
          getAllTransportJobs(token),
          getOpenTransportExceptions(token),
        ]);
        const activeStatuses = [
          'ASSIGNED',
          'ACCEPTED',
          'EN_ROUTE_PICKUP',
          'AT_PICKUP',
          'LOADED',
          'EN_ROUTE_DELIVERY',
          'AT_DELIVERY',
        ];
        setJobs(jobsRes.filter((j) => activeStatuses.includes(j.status)) || []);
        setExceptions(exRes);
      } catch (err) {
        console.error('Failed to fetch active jobs:', err);
      } finally {
        setLoading(false);
      }
    },
    [token, user],
  );

  useEffect(() => {
    fetchJobs();
    intervalRef.current = setInterval(() => fetchJobs(true), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobs]);

  const exceptionCountMap = exceptions.reduce<Record<string, number>>((acc, ex) => {
    if (ex.status === 'OPEN' && ex.transportJobId) {
      acc[ex.transportJobId] = (acc[ex.transportJobId] ?? 0) + 1;
    }
    return acc;
  }, {});

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;
  const lateCount = jobs.filter(isLate).length;
  const exceptionCount = Object.keys(exceptionCountMap).filter((id) =>
    jobs.some((j) => j.id === id),
  ).length;

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Aktīvās piegādes</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500 font-medium">
              {jobs.length} aktīv{jobs.length === 1 ? 'a' : 'as'} · Atjaunojas automātiski
            </span>
            {lateCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-700">
                <Clock className="h-3.5 w-3.5" />
                {lateCount} kavējas
              </span>
            )}
            {exceptionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {exceptionCount} problēm{exceptionCount === 1 ? 'a' : 'as'}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchJobs(false)}
          disabled={loading}
          className="gap-2 font-semibold shadow-sm border-slate-200"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atsvaidzināt
        </Button>
      </div>

      {/* Body List */}
      <div className="flex-1 p-6 lg:p-8">
        {loading && jobs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium uppercase tracking-wide">Ielādē datus…</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
            <div className="flex flex-col items-center gap-4 text-center max-w-sm">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                <Truck className="h-8 w-8 text-slate-300" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">Nav aktīvu piegāžu</p>
                <p className="text-sm text-slate-500 mt-1">
                  Šobrīd neviens transporta darbs nav aktīvs jūsu uzņēmumam.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-widest bg-white sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap font-bold">Darba Nr.</th>
                    <th className="px-6 py-4 whitespace-nowrap font-bold">Statuss</th>
                    <th className="px-6 py-4 whitespace-nowrap font-bold">Vadītājs</th>
                    <th className="px-6 py-4 whitespace-nowrap font-bold">Maršruts</th>
                    <th className="px-6 py-4 whitespace-nowrap font-bold">Krava</th>
                    <th className="px-6 py-4 whitespace-nowrap font-bold">Brīdinājumi</th>
                    <th className="px-6 py-4 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {jobs.map((job) => {
                    const driver = job.driver
                      ? `${job.driver.firstName ?? ''} ${job.driver.lastName ?? ''}`.trim()
                      : 'Nav vadītāja';
                    const isLateJob = isLate(job);
                    const openEx = exceptionCountMap[job.id] || 0;

                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedId(job.id)}
                      >
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="font-bold text-slate-900 border-b border-slate-900/0 group-hover:border-slate-900/30 transition-colors">
                            #{job.jobNumber ?? job.id.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                              <User className="h-4 w-4 text-slate-500" />
                            </div>
                            <span className="font-semibold text-slate-700">{driver}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 min-w-[280px]">
                          <div className="flex flex-col gap-1.5 relative pl-5">
                            <div className="absolute left-1 top-2 bottom-1.5 w-0.5 bg-slate-200" />
                            <div className="flex items-center gap-3 text-slate-600 relative">
                              <div className="absolute -left-[19px] h-2.5 w-2.5 rounded-full bg-white ring-[2px] ring-slate-400 z-10" />
                              <span
                                className="font-medium truncate block flex-1"
                                title={job.pickupCity}
                              >
                                {job.pickupCity}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-900 relative">
                              <div className="absolute -left-[19px] h-2.5 w-2.5 rounded-sm bg-black ring-[2px] ring-black z-10 shadow-sm" />
                              <span
                                className="font-bold truncate block flex-1"
                                title={job.deliveryCity}
                              >
                                {job.deliveryCity}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800">{job.cargoType ?? '—'}</span>
                            {job.cargoWeight && (
                              <span className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">
                                {job.cargoWeight} t
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            {isLateJob && (
                              <span className="inline-flex w-fit items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                <Clock className="h-3 w-3" /> Kavējas
                              </span>
                            )}
                            {openEx > 0 && (
                              <span className="inline-flex w-fit items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                <AlertTriangle className="h-3 w-3" /> {openEx} problēm
                                {openEx === 1 ? 'a' : 'as'}
                              </span>
                            )}
                            {!isLateJob && openEx === 0 && (
                              <span className="text-slate-400 text-sm pl-2">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full group-hover:bg-slate-200 transition-colors text-slate-400 group-hover:text-slate-900"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Details Side Sheet */}
      <JobDetailSheet
        job={selectedJob}
        exceptions={exceptions}
        open={selectedId !== null}
        onOpenChange={(val) => {
          if (!val) setSelectedId(null);
        }}
      />
    </div>
  );
}
