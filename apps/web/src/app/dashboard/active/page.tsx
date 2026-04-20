/**
 * Active jobs page — /dashboard/active
 * Control-tower view: live GPS map + job list with late flags, exception badges,
 * and a detail panel showing status timeline when a job is selected.
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  getAllTransportJobs,
  getTransportJobLocation,
  getOpenTransportExceptions,
  type ApiTransportJob,
  type ApiTransportJobException,
} from '@/lib/api';

const FleetMap = dynamic(
  () => import('@/components/fleet-map').then((m) => ({ default: m.FleetMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl border border-slate-200 bg-slate-100 animate-pulse"
        style={{ height: '100%', minHeight: 520 }}
      />
    ),
  },
);

// ── Status config ─────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['AT_PICKUP', 'LOADED', 'EN_ROUTE_DELIVERY', 'AT_DELIVERY']);

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  AT_PICKUP: {
    label: 'Iekraušanā',
    dot: 'bg-pink-400',
    text: 'text-pink-700',
    bg: 'bg-pink-50 border-pink-200',
  },
  LOADED: {
    label: 'Iekrauts',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    bg: 'bg-violet-50 border-violet-200',
  },
  EN_ROUTE_DELIVERY: {
    label: 'Ceļā uz pieg.',
    dot: 'bg-green-500',
    text: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
  },
  AT_DELIVERY: {
    label: 'Izkraušanā',
    dot: 'bg-emerald-600',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
};

// Full ordered status list for the timeline
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLate(job: ApiTransportJob): boolean {
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
  return new Date(iso).toLocaleString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: 'bg-slate-400',
    text: 'text-slate-700',
    bg: 'bg-slate-50 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  selected,
  openExceptionCount,
  onClick,
}: {
  job: ApiTransportJob;
  selected: boolean;
  openExceptionCount: number;
  onClick: () => void;
}) {
  const driver = job.driver
    ? `${job.driver.firstName ?? ''} ${job.driver.lastName ?? ''}`.trim()
    : 'Nav vadītāja';
  const material = job.cargoType ?? '—';
  const pickup = job.pickupCity ?? '—';
  const delivery = job.deliveryCity ?? '—';
  const late = isLate(job);

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
          : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm'
      }`}
    >
      {/* Top row: job number + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${selected ? 'text-slate-300' : 'text-slate-500'}`}
          >
            #{job.jobNumber ?? job.id.slice(-6).toUpperCase()}
          </p>
          <p
            className={`mt-0.5 truncate text-sm font-bold ${selected ? 'text-white' : 'text-slate-900'}`}
          >
            <Truck className="inline mr-1 h-3.5 w-3.5" />
            {driver}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={job.status} />
          <div className="flex items-center gap-1">
            {late && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                <Clock className="h-3 w-3" />
                Kavējas
              </span>
            )}
            {openExceptionCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {openExceptionCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Route */}
      <div
        className={`mt-3 flex items-center gap-2 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {pickup} → {delivery}
        </span>
      </div>

      {/* Cargo */}
      <div
        className={`mt-1.5 flex items-center gap-2 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}
      >
        <Package className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {material}
          {job.cargoWeight ? ` · ${job.cargoWeight} t` : ''}
        </span>
      </div>

      {/* Delivery deadline */}
      <div
        className={`mt-1.5 flex items-center gap-2 text-xs ${
          late
            ? selected
              ? 'text-red-300'
              : 'text-red-600 font-medium'
            : selected
              ? 'text-slate-300'
              : 'text-slate-500'
        }`}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" />
        <span>Pieg. līdz {fmt(job.deliveryDate)}</span>
      </div>
    </button>
  );
}

// ── Status timeline ───────────────────────────────────────────────────────────

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
        const isDone = idx < currentIdx || ts !== undefined;
        const isCurrent = step.key === currentStatus;

        return (
          <div key={step.key} className="flex items-start gap-3">
            {/* Connector line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  isCurrent
                    ? 'border-slate-900 bg-slate-900'
                    : isDone
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-200 bg-white'
                }`}
              >
                {isCurrent ? (
                  <span className="h-2 w-2 rounded-full bg-white" />
                ) : isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-slate-300" />
                )}
              </div>
              {idx < STATUS_TIMELINE.length - 1 && (
                <div
                  className={`w-0.5 flex-1 ${isDone && !isCurrent ? 'bg-emerald-300' : 'bg-slate-200'}`}
                  style={{ minHeight: 20 }}
                />
              )}
            </div>

            {/* Label + timestamp */}
            <div className="pb-4 pt-0.5">
              <p
                className={`text-sm font-medium ${
                  isCurrent ? 'text-slate-900' : isDone ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </p>
              {ts && <p className="mt-0.5 text-xs text-slate-500">{fmt(ts)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Job detail panel ──────────────────────────────────────────────────────────

function JobDetailPanel({
  job,
  exceptions,
  onClose,
}: {
  job: ApiTransportJob;
  exceptions: ApiTransportJobException[];
  onClose: () => void;
}) {
  const driver = job.driver
    ? `${job.driver.firstName ?? ''} ${job.driver.lastName ?? ''}`.trim()
    : 'Nav vadītāja';
  const late = isLate(job);
  const openExceptions = exceptions.filter(
    (e) => e.transportJobId === job.id && e.status === 'OPEN',
  );
  const timestamps = job.statusTimestamps as Record<string, string> | null | undefined;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            #{job.jobNumber ?? job.id.slice(-6).toUpperCase()}
          </p>
          <p className="truncate text-sm font-bold text-slate-900">{driver}</p>
        </div>
        <div className="flex items-center gap-2">
          {late && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              <Clock className="h-3 w-3" />
              Kavējas
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Job info */}
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Iekraušana</p>
              <p className="font-medium text-slate-900">{job.pickupCity}</p>
              <p className="text-xs text-slate-500 truncate">{job.pickupAddress}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Piegāde</p>
              <p className="font-medium text-slate-900">{job.deliveryCity}</p>
              <p className="text-xs text-slate-500 truncate">{job.deliveryAddress}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Iekraušana plānota</p>
              <p className="font-medium text-slate-900">{fmtDate(job.pickupDate)}</p>
            </div>
            <div>
              <p className={`text-xs ${late ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                Piegāde plānota
              </p>
              <p className={`font-medium ${late ? 'text-red-700' : 'text-slate-900'}`}>
                {fmtDate(job.deliveryDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Krava</p>
              <p className="font-medium text-slate-900">{job.cargoType}</p>
            </div>
            {job.cargoWeight && (
              <div>
                <p className="text-xs text-slate-500">Svars</p>
                <p className="font-medium text-slate-900">{job.cargoWeight} t</p>
              </div>
            )}
            {job.vehicle && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Transportlīdzeklis</p>
                <p className="font-medium text-slate-900">{job.vehicle.licensePlate}</p>
              </div>
            )}
            {job.driver && (
              <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vadītājs
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {job.driver.firstName} {job.driver.lastName}
                    </p>
                    {job.driver.phone ? (
                      <a
                        href={`tel:${job.driver.phone}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <PhoneCall className="h-3 w-3" />
                        {job.driver.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400">Nav tālruņa</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Open exceptions */}
        {openExceptions.length > 0 && (
          <div className="border-b border-slate-100 px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Atklātas problēmas ({openExceptions.length})
            </p>
            <div className="flex flex-col gap-2">
              {openExceptions.map((ex) => (
                <div key={ex.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-800">
                        {EXCEPTION_TYPE_LABELS[ex.type] ?? ex.type}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700 line-clamp-2">{ex.notes}</p>
                      <p className="mt-1 text-xs text-amber-600">{fmt(ex.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status timeline */}
        <div className="px-4 py-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Statusa vēsture
          </p>
          <StatusTimeline currentStatus={job.status} timestamps={timestamps} />
        </div>

        {/* Full-detail link */}
        <div className="border-t border-slate-100 px-4 py-4">
          <Link
            href={`/dashboard/transport-jobs/${job.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Skatīt pilnas detaļas
          </Link>
        </div>
      </div>
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActiveTrackingPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [exceptions, setExceptions] = useState<ApiTransportJobException[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveLocations, setLiveLocations] = useState<Record<string, { lat: number; lng: number }>>(
    {},
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restrict to dispatcher-capable users only (DRIVER role cannot call /fleet)
  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.userType === 'ADMIN') return;
    // DRIVER companyRole users are field workers — redirect them to their jobs list
    if (user.companyRole === 'DRIVER') {
      router.replace('/dashboard/transport-jobs');
      return;
    }
    if (!user.canTransport) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  const fetchJobs = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const [all, openExceptions] = await Promise.all([
          getAllTransportJobs(token),
          getOpenTransportExceptions(token).catch(() => [] as ApiTransportJobException[]),
        ]);
        const active = all.filter((j) => ACTIVE_STATUSES.has(j.status));
        setJobs(active);
        setExceptions(openExceptions);
      } catch (err) {
        console.warn('Failed to load active jobs', err instanceof Error ? err.message : err);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const fetchLiveLocations = useCallback(
    async (activeJobs: ApiTransportJob[]) => {
      if (!token || activeJobs.length === 0) return;
      const results = await Promise.allSettled(
        activeJobs.map((j) => getTransportJobLocation(j.id, token)),
      );
      const next: Record<string, { lat: number; lng: number }> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.currentLocation) {
          next[activeJobs[i].id] = {
            lat: r.value.currentLocation.lat,
            lng: r.value.currentLocation.lng,
          };
        }
      });
      setLiveLocations(next);
    },
    [token],
  );

  useEffect(() => {
    fetchJobs();
    intervalRef.current = setInterval(() => fetchJobs(true), 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobs]);

  // Poll per-job GPS every 10 s
  useEffect(() => {
    fetchLiveLocations(jobs);
    gpsIntervalRef.current = setInterval(() => fetchLiveLocations(jobs), 10_000);
    return () => {
      if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    };
  }, [jobs, fetchLiveLocations]);

  // Build exception count map: jobId → open count
  const exceptionCountMap = exceptions.reduce<Record<string, number>>((acc, ex) => {
    if (ex.status === 'OPEN') {
      acc[ex.transportJobId] = (acc[ex.transportJobId] ?? 0) + 1;
    }
    return acc;
  }, {});

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;
  const mapJobs = selectedJob ? [selectedJob] : jobs;

  // Summary counts for header
  const lateCount = jobs.filter(isLate).length;
  const exceptionCount = Object.keys(exceptionCountMap).filter((id) =>
    jobs.some((j) => j.id === id),
  ).length;

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
            <Radio className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Aktīvās piegādes</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500">
                Atjaunojas ik 15 sek. · {jobs.length} aktīv{jobs.length === 1 ? 'a' : 'as'}
              </p>
              {lateCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  <Clock className="h-3 w-3" />
                  {lateCount} kavējas
                </span>
              )}
              {exceptionCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  {exceptionCount} problēm{exceptionCount === 1 ? 'a' : 'as'}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchJobs()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </Button>
      </div>

      {/* Body */}
      {loading && jobs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <p className="text-sm">Ielādē aktīvās piegādes…</p>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Truck className="h-7 w-7 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-700">Nav aktīvu piegāžu</p>
            <p className="text-sm text-slate-500">
              Šobrīd neviens transporta darbs nav aktīvā piegādē.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Job list sidebar */}
          <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
            {selectedId && (
              <button
                onClick={() => setSelectedId(null)}
                className="text-left text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Rādīt visas ({jobs.length})
              </button>
            )}
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                selected={job.id === selectedId}
                openExceptionCount={exceptionCountMap[job.id] ?? 0}
                onClick={() => setSelectedId(job.id === selectedId ? null : job.id)}
              />
            ))}
          </aside>

          {/* Map */}
          <div className="flex-1 overflow-hidden">
            <FleetMap jobs={mapJobs} liveLocations={liveLocations} />
          </div>

          {/* Detail panel — slides in when a job is selected */}
          {selectedJob && (
            <JobDetailPanel
              job={selectedJob}
              exceptions={exceptions}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
