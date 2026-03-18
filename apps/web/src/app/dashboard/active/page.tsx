/**
 * Active jobs page — /dashboard/active
 * Real-time view of the carrier's currently in-progress transport job
 * with live GPS tracking map.
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, Truck, MapPin, Package, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { getAllTransportJobs, type ApiTransportJob } from '@/lib/api';

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
  onClick,
}: {
  job: ApiTransportJob;
  selected: boolean;
  onClick: () => void;
}) {
  const driver = job.driver
    ? `${job.driver.firstName ?? ''} ${job.driver.lastName ?? ''}`.trim()
    : 'Nav vadītāja';

  const material = job.cargoType ?? '—';
  const pickup = job.pickupCity ?? '—';
  const delivery = job.deliveryCity ?? '—';

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
          : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-sm'
      }`}
    >
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
        <StatusBadge status={job.status} />
      </div>

      <div
        className={`mt-3 flex items-center gap-2 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {pickup} → {delivery}
        </span>
      </div>

      <div
        className={`mt-1.5 flex items-center gap-2 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}
      >
        <Package className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{material}</span>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActiveTrackingPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const all = await getAllTransportJobs(token);
        const active = all.filter((j) => ACTIVE_STATUSES.has(j.status));
        setJobs(active);
      } catch (err) {
        console.error('Failed to load active jobs', err);
      } finally {
        setLoading(false);
      }
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

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;
  const mapJobs = selectedJob ? [selectedJob] : jobs;

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
            <p className="text-xs text-slate-500">
              Atjaunojas ik 15 sek. · {jobs.length} aktīv{jobs.length === 1 ? 'a' : 'as'}
            </p>
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
          {/* Job list */}
          <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
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
                onClick={() => setSelectedId(job.id === selectedId ? null : job.id)}
              />
            ))}
          </aside>

          {/* Map */}
          <div className="flex-1 overflow-hidden">
            <FleetMap jobs={mapJobs} />
          </div>
        </div>
      )}
    </div>
  );
}
