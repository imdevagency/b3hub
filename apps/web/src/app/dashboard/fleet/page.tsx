/**
 * Fleet management page — /dashboard/fleet
 * Add, edit, and remove carrier vehicles. Shows vehicle details and status.
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
  List,
  Map,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { getAllTransportJobs, type ApiTransportJob } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { PageContainer } from '@/components/ui/page-container';

const FleetMap = dynamic(
  () => import('@/components/fleet-map').then((m) => ({ default: m.FleetMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl border border-border bg-muted animate-pulse"
        style={{ height: 520 }}
      />
    ),
  },
);

// ── Status config ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  AVAILABLE: {
    label: 'Nepiešķirts',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    bg: 'bg-muted/40 border-transparent',
  },
  ACCEPTED: {
    label: 'Pieņemts',
    dot: 'bg-foreground',
    text: 'text-foreground',
    bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
  },
  EN_ROUTE_PICKUP: {
    label: 'Brauc uz iekr.',
    dot: 'bg-foreground',
    text: 'text-foreground',
    bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
  },
  AT_PICKUP: {
    label: 'Iekraušana',
    dot: 'bg-foreground',
    text: 'text-foreground',
    bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
  },
  LOADED: {
    label: 'Iekrauts',
    dot: 'bg-foreground',
    text: 'text-foreground',
    bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
  },
  EN_ROUTE_DELIVERY: {
    label: 'Ceļā',
    dot: 'bg-foreground',
    text: 'text-foreground',
    bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
  },
  AT_DELIVERY: {
    label: 'Izkraušana',
    dot: 'bg-foreground',
    text: 'text-foreground',
    bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
  },
  DELIVERED: {
    label: 'Piegādāts',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    bg: 'bg-muted/40 border-transparent',
  },
  CANCELLED: {
    label: 'Atcelts',
    dot: 'bg-destructive',
    text: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
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
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    bg: 'bg-muted/40 border-transparent',
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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  // Company drivers/members are field workers — fleet dispatch is for OWNER/MANAGER only
  useEffect(() => {
    if (!isLoading && user) {
      const isCompanyDriver =
        user.isCompany && (user.companyRole === 'DRIVER' || user.companyRole === 'MEMBER');
      if (isCompanyDriver) router.replace('/dashboard/orders');
    }
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
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <PageContainer
      title="Dispečera Panelis"
      description="Pārskata visi transporta darbi · reāllaikā"
      action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-[1.25rem] bg-muted/50 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl transition-all duration-200 ${viewMode === 'list' ? 'bg-white dark:bg-zinc-900 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-3.5 w-3.5" />
              Saraksts
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl transition-all duration-200 ml-1 ${viewMode === 'map' ? 'bg-white dark:bg-zinc-900 text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Map className="h-3.5 w-3.5" />
              Karte
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/60 hover:bg-muted/50"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
          <Button
            size="sm"
            className="rounded-xl shadow-md"
            onClick={() => router.push('/dashboard/jobs')}
          >
            <Package className="h-4 w-4 mr-1.5" />
            Job Board
          </Button>
        </div>
      }
    >
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Kopā Darbi',
            value: stats.total,
            icon: Truck,
            color: 'text-foreground',
            bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
          },
          {
            label: 'Nepiešķirts',
            value: stats.available,
            icon: Clock,
            color: 'text-muted-foreground',
            bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
          },
          {
            label: 'Ceļā',
            value: stats.active,
            icon: MapPin,
            color: 'text-foreground',
            bg: 'bg-primary/5 border-primary/20 text-primary shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
          },
          {
            label: 'Piegādāts Šodien',
            value: stats.delivered,
            icon: CheckCircle2,
            color: 'text-muted-foreground',
            bg: 'bg-white dark:bg-zinc-950 border-border/40 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]',
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-[2rem] border p-5 sm:p-6 transition-all duration-300 hover:shadow-lg ${s.bg}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Map view */}
      {viewMode === 'map' && <FleetMap jobs={jobs} />}

      {/* Filter + search — list mode only */}
      {viewMode === 'list' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-2xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${statusFilter === f.key ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
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
            className="ml-0 sm:ml-auto h-11 rounded-[1.5rem] border-0 bg-white dark:bg-zinc-950 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] px-5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-72 transition-shadow"
          />
        </div>
      )}

      {/* Jobs table — list mode only */}
      {viewMode === 'list' &&
        (error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-border/60 hover:bg-muted/50 mt-3"
              onClick={fetchJobs}
            >
              Mēģināt vēlreiz
            </Button>
          </div>
        ) : loading && jobs.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
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
          <div className="overflow-hidden rounded-[2.5rem] bg-white dark:bg-zinc-950 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)] border border-border/40 pb-2">
            <div className="overflow-auto px-2">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 border-b-2 border-border/30">
                  <tr>
                    <th className="px-4 py-4 text-left">Darba nr.</th>
                    <th className="px-4 py-4 text-left">Veids</th>
                    <th className="px-4 py-4 text-left">Maršruts</th>
                    <th className="px-4 py-4 text-left">Krava</th>
                    <th className="px-4 py-4 text-left">Šoferis / Transports</th>
                    <th className="px-4 py-4 text-left">Datums</th>
                    <th className="px-4 py-4 text-left">Statuss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((job) => (
                    <tr
                      key={job.id}
                      className="group hover:bg-muted/30 transition-colors duration-300"
                    >
                      {/* Job number */}
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-muted-foreground/80 group-hover:text-foreground transition-colors">
                        {job.jobNumber}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium">
                          {JOB_TYPE_LV[job.jobType] ?? job.jobType}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <span>{job.pickupCity}</span>
                          <span className="text-muted-foreground/50">→</span>
                          <span>{job.deliveryCity}</span>
                        </div>
                        {job.distanceKm && (
                          <p className="text-xs text-muted-foreground/70 mt-1 font-medium">
                            {job.distanceKm} km
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-sm">{job.cargoType}</p>
                        {job.cargoWeight && (
                          <p className="text-xs text-muted-foreground font-medium">
                            {job.cargoWeight} t
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {job.driver ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                                <User className="h-3 w-3 text-foreground/70" />
                              </span>
                              <span className="font-semibold text-sm">
                                {job.driver.firstName} {job.driver.lastName}
                              </span>
                            </div>
                            {job.vehicle && (
                              <p className="text-xs text-muted-foreground/80 mt-1 ml-8 font-medium">
                                {VEHICLE_LV[job.vehicle.vehicleType] ?? job.vehicle.vehicleType}
                                <span className="mx-1.5 opacity-50">·</span>
                                <span className="font-mono">{job.vehicle.licensePlate}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => router.push('/dashboard/jobs')}
                            className="inline-flex items-center text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                          >
                            + Piešķirt šoferi
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-muted-foreground/80">
                        {formatDate(job.pickupDate)}
                        {job.pickupWindow && (
                          <p className="text-muted-foreground mt-0.5">{job.pickupWindow}</p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="border-t border-border/40 bg-muted/10 px-6 py-4 text-xs font-semibold text-muted-foreground/70">
              Rāda {filtered.length} no {jobs.length} darb{jobs.length === 1 ? 'a' : 'iem'}
            </div>
          </div>
        ))}
    </PageContainer>
  );
}
