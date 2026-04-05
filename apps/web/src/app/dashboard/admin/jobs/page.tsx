/**
 * Admin transport jobs page — /dashboard/admin/jobs
 * Platform-wide view of all transport jobs with status filtering, carrier/driver details, and exception alerts.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetTransportJobs, type AdminTransportJob } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { RefreshCw, Truck, Search, AlertTriangle } from 'lucide-react';

// ── Status badge ─────────────────────────────────────────────────────────────

const JOB_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-gray-100 text-gray-500',
  ASSIGNED: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  EN_ROUTE_PICKUP: 'bg-indigo-100 text-indigo-700',
  AT_PICKUP: 'bg-purple-100 text-purple-700',
  LOADED: 'bg-violet-100 text-violet-700',
  EN_ROUTE_DELIVERY: 'bg-orange-100 text-orange-700',
  AT_DELIVERY: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-500',
};

const ACTIVE_STATUSES = new Set([
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

function StatusBadge({ value }: { value: string }) {
  const cls = JOB_STATUS_COLORS[value] ?? 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}

// ── Filters ──────────────────────────────────────────────────────────────────

type JobFilter = 'ALL' | 'ACTIVE' | 'AVAILABLE' | 'DELIVERED' | 'CANCELLED' | 'EXCEPTIONS';

const JOB_FILTERS: { value: JobFilter; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'ACTIVE', label: 'Aktīvie' },
  { value: 'AVAILABLE', label: 'Brīvie' },
  { value: 'DELIVERED', label: 'Piegādāti' },
  { value: 'CANCELLED', label: 'Atcelti' },
  { value: 'EXCEPTIONS', label: '⚠ Problēmas' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminJobsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<AdminTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JobFilter>('ALL');

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetTransportJobs(token);
      setJobs(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchJobs();
  }, [isLoading, token, fetchJobs]);

  const filtered = jobs.filter((j) => {
    if (filter === 'ACTIVE' && !ACTIVE_STATUSES.has(j.status)) return false;
    if (filter === 'AVAILABLE' && j.status !== 'AVAILABLE') return false;
    if (filter === 'DELIVERED' && j.status !== 'DELIVERED') return false;
    if (filter === 'CANCELLED' && j.status !== 'CANCELLED') return false;
    if (filter === 'EXCEPTIONS' && j.exceptions.length === 0) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      j.jobNumber.toLowerCase().includes(q) ||
      (j.carrier?.name ?? '').toLowerCase().includes(q) ||
      (j.driver ? `${j.driver.firstName} ${j.driver.lastName}` : '').toLowerCase().includes(q) ||
      j.pickupCity.toLowerCase().includes(q) ||
      j.deliveryCity.toLowerCase().includes(q) ||
      (j.vehicle?.licensePlate ?? '').toLowerCase().includes(q)
    );
  });

  const openExceptionCount = jobs.filter((j) => j.exceptions.length > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transporta Darbi"
        description={`${jobs.length} darbi platformā`}
        action={
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      {/* Exception alert */}
      {openExceptionCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            {openExceptionCount} darb{openExceptionCount === 1 ? 's' : 'i'} ar atklātām problēmām.
          </span>
          <button
            type="button"
            className="ml-auto text-xs underline underline-offset-2"
            onClick={() => setFilter('EXCEPTIONS')}
          >
            Skatīt
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt pēc nr., pārvadātāja, šofera, pilsētas, numura zīmes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {JOB_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              filter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nav darbu"
          description="Nekas neatbilst meklēšanas kritērijiem."
        />
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Nr.
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tips
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Kravas
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Maršruts
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pārvadātājs / Šoferis
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Transportlīdzeklis
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tarifs
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    ⚠
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Datums
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((j) => (
                  <tr
                    key={j.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${j.exceptions.length > 0 ? 'bg-red-50/30' : ''}`}
                    onClick={() => router.push(`/dashboard/transport-jobs/${j.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{j.jobNumber}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-600">
                      {j.jobType.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={j.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 text-xs">
                        <p>{j.cargoType}</p>
                        {j.cargoWeight != null && (
                          <p className="text-muted-foreground">
                            {j.cargoWeight.toLocaleString()} kg
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <span>{j.pickupCity}</span>
                      <span className="mx-1 text-gray-300">→</span>
                      <span>{j.deliveryCity}</span>
                    </td>
                    <td className="px-4 py-3">
                      {j.carrier ? (
                        <div>
                          <p className="font-semibold text-gray-900 text-xs">{j.carrier.name}</p>
                          {j.driver && (
                            <p className="text-xs text-muted-foreground">
                              {j.driver.firstName} {j.driver.lastName}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {j.vehicle ? (
                        <div className="text-xs">
                          <p className="text-gray-700">
                            {j.vehicle.make} {j.vehicle.model}
                          </p>
                          <p className="font-mono text-muted-foreground">
                            {j.vehicle.licensePlate}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {j.rate.toLocaleString('lv-LV', { style: 'currency', currency: j.currency })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {j.exceptions.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          {j.exceptions.length}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(j.createdAt).toLocaleDateString('lv-LV')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
