'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  MapPin,
  Truck,
  User,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { getAllTransportJobs, type ApiTransportJob } from '@/lib/api';

// ── Status config ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  AVAILABLE: {
    label: 'Nepiešķirts',
    dot: 'bg-amber-400',
    text: 'text-amber-700',
    bg: 'bg-amber-50  border-amber-200',
  },
  ACCEPTED: {
    label: 'Pieņemts',
    dot: 'bg-blue-400',
    text: 'text-blue-700',
    bg: 'bg-blue-50   border-blue-200',
  },
  EN_ROUTE_PICKUP: {
    label: 'Brauc uz iekr.',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    bg: 'bg-blue-50   border-blue-200',
  },
  AT_PICKUP: {
    label: 'Iekraušana',
    dot: 'bg-orange-400',
    text: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  LOADED: {
    label: 'Iekrauts',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
  },
  EN_ROUTE_DELIVERY: {
    label: 'Ceļā',
    dot: 'bg-green-500',
    text: 'text-green-700',
    bg: 'bg-green-50  border-green-200',
  },
  AT_DELIVERY: {
    label: 'Izkraušana',
    dot: 'bg-green-600',
    text: 'text-green-700',
    bg: 'bg-green-50  border-green-200',
  },
  DELIVERED: {
    label: 'Piegādāts',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    bg: 'bg-slate-50  border-slate-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    dot: 'bg-red-400',
    text: 'text-red-700',
    bg: 'bg-red-50    border-red-200',
  },
};

const JOB_TYPE_LV: Record<string, string> = {
  MATERIAL_DELIVERY: 'Materiālu piegāde',
  CONTAINER_DELIVERY: 'Konteinera piegāde',
  CONTAINER_PICKUP: 'Konteinera savākšana',
  WASTE_COLLECTION: 'Atkritumu savākšana',
  EQUIPMENT_TRANSPORT: 'Tehnikas pārvadāšana',
};

const VEHICLE_LV: Record<string, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Piekabes kravas auto',
  HOOK_LIFT: 'Āķa pacēlājs',
  SKIP_LOADER: 'Konteineru auto',
  TANKER: 'Cisterna',
  VAN: 'Furgons',
};

const ACTIVE_STATUSES = new Set([
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Visi' },
  { key: 'AVAILABLE', label: 'Nepiešķirts' },
  { key: 'ACTIVE', label: 'Aktīvie' },
  { key: 'DELIVERED', label: 'Piegādāts' },
  { key: 'CANCELLED', label: 'Atcelts' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', { day: '2-digit', month: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: 'bg-gray-400',
    text: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function FleetPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAllTransportJobs(token);
      setJobs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neizdevās ielādēt darbus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && user && token) fetchJobs();
  }, [isLoading, user, token, fetchJobs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  // ── Stats ───────────────────────────────────────────────────
  const today = new Date().toDateString();
  const stats = {
    total: jobs.length,
    available: jobs.filter((j) => j.status === 'AVAILABLE').length,
    active: jobs.filter((j) => ACTIVE_STATUSES.has(j.status)).length,
    delivered: jobs.filter(
      (j) => j.status === 'DELIVERED' && new Date(j.deliveryDate).toDateString() === today,
    ).length,
  };

  // ── Filtering ───────────────────────────────────────────────
  const filtered = jobs.filter((j) => {
    const matchStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
          ? ACTIVE_STATUSES.has(j.status)
          : j.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      j.jobNumber.toLowerCase().includes(q) ||
      j.pickupCity.toLowerCase().includes(q) ||
      j.deliveryCity.toLowerCase().includes(q) ||
      j.cargoType.toLowerCase().includes(q) ||
      (j.driver && `${j.driver.firstName} ${j.driver.lastName}`.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispečera Panelis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pārskata visi transporta darbi · reāllaikā
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
          <Button size="sm" onClick={() => router.push('/dashboard/jobs')}>
            <Package className="h-4 w-4 mr-1.5" />
            Job Board
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Kopā Darbi',
            value: stats.total,
            icon: Truck,
            color: 'text-slate-600',
            bg: 'bg-slate-50 border-slate-200',
          },
          {
            label: 'Nepiešķirts',
            value: stats.available,
            icon: Clock,
            color: 'text-amber-600',
            bg: 'bg-amber-50 border-amber-200',
          },
          {
            label: 'Ceļā',
            value: stats.active,
            icon: MapPin,
            color: 'text-green-600',
            bg: 'bg-green-50 border-green-200',
          },
          {
            label: 'Piegādāts Šodien',
            value: stats.delivered,
            icon: CheckCircle2,
            color: 'text-blue-600',
            bg: 'bg-blue-50 border-blue-200',
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === f.key
                  ? 'bg-red-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f.label}
              {f.key !== 'ALL' && (
                <span className="ml-1.5 opacity-70">
                  {f.key === 'ACTIVE'
                    ? stats.active
                    : f.key === 'AVAILABLE'
                      ? stats.available
                      : f.key === 'DELIVERED'
                        ? jobs.filter((j) => j.status === 'DELIVERED').length
                        : jobs.filter((j) => j.status === 'CANCELLED').length}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Meklēt pēc maršruta, šofera, kravas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-8 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring w-64"
        />
      </div>

      {/* Jobs table */}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-700">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchJobs}>
            Mēģināt vēlreiz
          </Button>
        </div>
      ) : loading && jobs.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-red-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground">Darbi nav atrasti</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Izmainiet filtrus vai izveidojiet jaunu darbu Job Board lapā.
          </p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border/50">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Darba nr.</th>
                <th className="px-4 py-3 text-left">Veids</th>
                <th className="px-4 py-3 text-left">Maršruts</th>
                <th className="px-4 py-3 text-left">Krava</th>
                <th className="px-4 py-3 text-left">Šoferis / Transports</th>
                <th className="px-4 py-3 text-left">Datums</th>
                <th className="px-4 py-3 text-left">Statuss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((job) => (
                <tr key={job.id} className="bg-background hover:bg-muted/20 transition-colors">
                  {/* Job number */}
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">
                    {job.jobNumber}
                  </td>

                  {/* Job type */}
                  <td className="px-4 py-3">
                    <span className="text-xs">{JOB_TYPE_LV[job.jobType] ?? job.jobType}</span>
                  </td>

                  {/* Route */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{job.pickupCity}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{job.deliveryCity}</span>
                    </div>
                    {job.distanceKm && (
                      <p className="text-xs text-muted-foreground mt-0.5">{job.distanceKm} km</p>
                    )}
                  </td>

                  {/* Cargo */}
                  <td className="px-4 py-3">
                    <p className="font-medium">{job.cargoType}</p>
                    {job.cargoWeight && (
                      <p className="text-xs text-muted-foreground">{job.cargoWeight} t</p>
                    )}
                  </td>

                  {/* Driver + vehicle */}
                  <td className="px-4 py-3">
                    {job.driver ? (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-xs">
                            {job.driver.firstName} {job.driver.lastName}
                          </span>
                        </div>
                        {job.vehicle && (
                          <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                            {VEHICLE_LV[job.vehicle.vehicleType] ?? job.vehicle.vehicleType}
                            {' · '}
                            {job.vehicle.licensePlate}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => router.push('/dashboard/jobs')}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        + Piešķirt šoferi
                      </button>
                    )}
                  </td>

                  {/* Pickup date */}
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(job.pickupDate)}
                    {job.pickupWindow && <p className="text-xs">{job.pickupWindow}</p>}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Table footer */}
          <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} no {jobs.length} darb{jobs.length === 1 ? 'a' : 'iem'}
          </div>
        </div>
      )}
    </div>
  );
}
