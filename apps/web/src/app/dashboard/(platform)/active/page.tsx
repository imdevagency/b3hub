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

const STATUS_CONFIG: Record<string, { label: string; text: string; bg: string }> = {
  ASSIGNED: {
    label: 'Piešķirts',
    text: 'text-slate-600',
    bg: 'bg-slate-100',
  },
  ACCEPTED: {
    label: 'Pieņemts',
    text: 'text-slate-900',
    bg: 'bg-slate-200',
  },
  EN_ROUTE_PICKUP: {
    label: 'Ceļā uz iekraušanu',
    text: 'text-white',
    bg: 'bg-black',
  },
  AT_PICKUP: {
    label: 'Iekraušanā',
    text: 'text-white',
    bg: 'bg-black',
  },
  LOADED: {
    label: 'Iekrauts',
    text: 'text-white',
    bg: 'bg-black',
  },
  EN_ROUTE_DELIVERY: {
    label: 'Ceļā uz piegādi',
    text: 'text-white',
    bg: 'bg-black',
  },
  AT_DELIVERY: {
    label: 'Izkraušanā',
    text: 'text-white',
    bg: 'bg-black',
  },
  DELIVERED: {
    label: 'Piegādāts',
    text: 'text-white',
    bg: 'bg-emerald-600',
  },
  CANCELLED: {
    label: 'Atcelts',
    text: 'text-white',
    bg: 'bg-red-600',
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
    text: 'text-slate-700',
    bg: 'bg-slate-100',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${cfg.bg} ${cfg.text}`}
    >
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
                className={`flex h-4 w-4 items-center justify-center rounded-sm mt-0.5 ${
                  isCurrent ? 'bg-black' : isDone ? 'bg-slate-300' : 'bg-slate-100'
                }`}
              ></div>
              {idx < STATUS_TIMELINE.length - 1 && (
                <div
                  className={`w-0.5 flex-1 my-1 ${isDone && !isCurrent ? 'bg-slate-300' : 'bg-slate-100'}`}
                  style={{ minHeight: 24 }}
                />
              )}
            </div>
            <div className="pb-4">
              <p
                className={`text-sm font-bold ${isCurrent ? 'text-black' : isDone ? 'text-slate-600' : 'text-slate-300'}`}
              >
                {step.label}
              </p>
              {ts && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  {fmt(ts)}
                </p>
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
        <SheetContent side="right" className="w-100 sm:max-w-120 p-0">
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
      <SheetContent className="w-100 sm:max-w-120 p-0 flex flex-col" side="right">
        <VisuallyHidden>
          <SheetTitle>Job Details</SheetTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="bg-black p-8 text-white shrink-0 z-10 relative">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Piegādes detaļas
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight">
                #{job.jobNumber ?? job.id.slice(-6).toUpperCase()}
              </h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-4">
            <StatusBadge status={job.status} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8 gap-8 flex flex-col bg-white">
          {/* Exceptions */}
          {openExceptions.length > 0 && (
            <div className="rounded-xl border-l-[3px] border-red-600 bg-slate-50 p-5">
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
          <div className="h-60 w-full rounded-2xl overflow-hidden bg-slate-100 shrink-0">
            <FleetMap jobs={[job]} liveLocations={{}} />
          </div>

          {/* Route Block */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">
              Maršruts
            </p>
            <div className="relative flex items-stretch gap-6 pl-1">
              <div className="absolute left-1.75 top-2 bottom-2 w-0.5 bg-slate-200" />
              <div className="flex flex-col justify-between py-0.5 gap-8 w-full">
                <div className="flex items-start gap-6 relative">
                  <div className="h-4 w-4 rounded-full border-[3px] border-black bg-white ring-8 ring-white z-10" />
                  <div className="min-w-0 -mt-1.5 flex-1">
                    <p className="text-lg font-bold text-black">{job.pickupCity}</p>
                    <p className="text-sm font-medium text-slate-500 truncate mt-0.5">
                      {job.pickupAddress}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                      Plānots: {fmtDate(job.pickupDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-6 relative">
                  <div className="h-4 w-4 bg-black ring-8 ring-white z-10" />
                  <div className="min-w-0 -mt-1.5 flex-1">
                    <p className="text-lg font-bold text-black">{job.deliveryCity}</p>
                    <p className="text-sm font-medium text-slate-500 truncate mt-0.5">
                      {job.deliveryAddress}
                    </p>
                    <p
                      className={`text-[10px] mt-2 uppercase tracking-widest ${late ? 'text-red-500 font-extrabold' : 'text-slate-400 font-bold'}`}
                    >
                      Plānots: {fmtDate(job.deliveryDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Cargo & Vehicle Split */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                Krava
              </p>
              <p className="font-bold text-lg text-black">{job.cargoType ?? '—'}</p>
              {job.cargoWeight && (
                <p className="text-sm font-bold text-slate-500 mt-1">{job.cargoWeight} t</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                T/L
              </p>
              <p className="font-bold text-lg text-black">{job.vehicle?.licensePlate ?? '—'}</p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Driver Block */}
          {job.driver && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-bold text-black">
                    {job.driver.firstName} {job.driver.lastName}
                  </p>
                  <p className="text-sm font-bold text-slate-400 mt-0.5">Vadītājs</p>
                </div>
              </div>
              {job.driver.phone && (
                <a
                  href={`tel:${job.driver.phone}`}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-black hover:bg-slate-200 transition"
                >
                  <PhoneCall className="h-5 w-5" />
                </a>
              )}
            </div>
          )}

          <hr className="border-slate-100" />

          {/* Timeline */}
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-8">
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
    <div className="flex flex-col flex-1 h-full bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-end justify-between px-6 lg:px-8 pt-10 pb-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold text-black tracking-tight">Aktīvās piegādes</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500 font-bold">
              {jobs.length} aktīv{jobs.length === 1 ? 'a' : 'as'} · Atjaunojas automātiski
            </span>
            {lateCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                <Clock className="h-3 w-3" />
                {lateCount} kavējas
              </span>
            )}
            {exceptionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                <AlertTriangle className="h-3 w-3" />
                {exceptionCount} problēm{exceptionCount === 1 ? 'a' : 'as'}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchJobs(false)}
          disabled={loading}
          className="gap-2 font-bold shadow-none border-slate-200 hover:bg-slate-100 rounded-xl"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atsvaidzināt
        </Button>
      </div>

      {/* Body List */}
      <div className="flex-1 p-6 lg:p-8">
        {loading && jobs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm min-h-100">
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium uppercase tracking-wide">Ielādē datus…</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm min-h-100">
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
          <div className="flex flex-col gap-3">
            {jobs.map((job) => {
              const driver = job.driver
                ? `${job.driver.firstName ?? ''} ${job.driver.lastName ?? ''}`.trim()
                : 'Nav vadītāja';
              const isLateJob = isLate(job);
              const openEx = exceptionCountMap[job.id] || 0;

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className="group flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border border-slate-200 hover:border-slate-800 rounded-2xl cursor-pointer transition-all gap-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-6 md:w-3/5">
                    {/* ID & Status */}
                    <div className="flex flex-col items-start gap-2 w-48 shrink-0 relative z-10 bg-white">
                      <span className="font-bold text-lg text-black truncate max-w-full">
                        #{job.jobNumber ?? job.id.slice(-6).toUpperCase()}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>

                    {/* Route */}
                    <div className="flex items-start gap-5 flex-1 relative min-w-40 border-l-2 border-slate-100 pl-6 py-1">
                      <div className="flex flex-col justify-between h-full gap-4">
                        <div className="flex items-center gap-4 relative">
                          <div className="absolute -left-[30.5px] h-2.5 w-2.5 rounded-full border-2 border-black bg-white z-10" />
                          <span className="font-bold text-black truncate" title={job.pickupCity}>
                            {job.pickupCity}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 relative">
                          <div className="absolute -left-[30.5px] h-2.5 w-2.5 bg-black z-10" />
                          <span className="font-bold text-black truncate" title={job.deliveryCity}>
                            {job.deliveryCity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between md:flex-1">
                    {/* Cargo */}
                    <div className="flex flex-col w-25 shrink-0">
                      <span className="font-bold text-sm text-black">{job.cargoType ?? '—'}</span>
                      {job.cargoWeight && (
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 font-bold mt-0.5">
                          {job.cargoWeight} t
                        </span>
                      )}
                    </div>

                    {/* Driver */}
                    <div className="flex items-center gap-3 min-w-35">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <span className="font-bold text-sm text-black">{driver}</span>
                    </div>

                    {/* Warnings and action */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 min-w-25">
                      {isLateJob && (
                        <span className="inline-flex w-fit items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-white bg-red-600 px-2 py-1 rounded-md">
                          <Clock className="h-3 w-3" /> Kavējas
                        </span>
                      )}
                      {openEx > 0 && (
                        <span className="inline-flex w-fit items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-white bg-amber-600 px-2 py-1 rounded-md">
                          <AlertTriangle className="h-3 w-3" /> {openEx} problēm
                          {openEx === 1 ? 'a' : 'as'}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-black transition-colors" />
                  </div>
                </div>
              );
            })}
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
