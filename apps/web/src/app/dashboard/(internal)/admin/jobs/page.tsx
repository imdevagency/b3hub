/**
 * Admin transport jobs page — /dashboard/admin/jobs
 * Platform-wide view of all transport jobs with status filtering, carrier/driver details,
 * exception alerts, and rate override panel.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetTransportJobs,
  adminUpdateJobRate,
  adminReassignJob,
  adminGetDrivers,
  type AdminTransportJob,
  type TransportDriver,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Truck,
  Search,
  AlertTriangle,
  Pencil,
  X,
  UserRoundCog,
  Clock,
} from 'lucide-react';

// ── Rate override panel ───────────────────────────────────────────────────────

const BLOCKED_FOR_RATE = new Set(['COMPLETED', 'CANCELLED']);

function RatePanel({
  job,
  token,
  onClose,
  onSaved,
}: {
  job: AdminTransportJob;
  token: string;
  onClose: () => void;
  onSaved: (jobId: string, rate: number, pricePerTonne: number | null) => void;
}) {
  const [rate, setRate] = useState(String(job.rate));
  const [pricePerTonne, setPricePerTonne] = useState(
    job.pricePerTonne != null ? String(job.pricePerTonne) : '',
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    rateRef.current?.focus();
  }, []);

  const isBlocked = BLOCKED_FOR_RATE.has(job.status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBlocked) return;
    const rateNum = parseFloat(rate);
    if (isNaN(rateNum) || rateNum < 0) {
      setError('Ievadiet derīgu likmi (≥ 0).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload: { rate?: number; pricePerTonne?: number; note?: string } = { rate: rateNum };
      const ptNum = parseFloat(pricePerTonne);
      if (!isNaN(ptNum) && ptNum >= 0) payload.pricePerTonne = ptNum;
      if (note.trim()) payload.note = note.trim();
      const updated = await adminUpdateJobRate(job.id, payload, token);
      onSaved(job.id, updated.rate, updated.pricePerTonne ?? null);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Neizdevās saglabāt. Mēģiniet vēlreiz.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-semibold text-foreground">Labot darba likmi</p>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{job.jobNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isBlocked ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5 text-amber-500 mb-2" />
            Darbs ir statusā <strong>{job.status}</strong> — likmes korekcija nav atļauta, jo
            izmaksa var jau būt notikusi.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Current */}
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pašreizējā likme</span>
                <span className="font-semibold tabular-nums">
                  {job.rate.toLocaleString('lv-LV', { style: 'currency', currency: job.currency })}
                </span>
              </div>
              {job.pricePerTonne != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cena / tonna</span>
                  <span className="font-semibold tabular-nums">
                    {job.pricePerTonne.toLocaleString('lv-LV', {
                      style: 'currency',
                      currency: job.currency,
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* New rate */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Jaunā likme ({job.currency}) *
              </label>
              <Input
                ref={rateRef}
                type="number"
                min={0}
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>

            {/* Price per tonne */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Jaunā cena / tonna ({job.currency}) — neobligāts
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={pricePerTonne}
                onChange={(e) => setPricePerTonne(e.target.value)}
                placeholder="Atstāt tukšu, lai nemainītu"
              />
            </div>

            {/* Note */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pamatojums (ierakstīts audita žurnālā) *
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Korekcijas iemesls..."
                required
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Atcelt
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Saglabāt
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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
  const [drivers, setDrivers] = useState<TransportDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<JobFilter>('ALL');
  const [rateJob, setRateJob] = useState<AdminTransportJob | null>(null);
  const [reassignJob, setReassignJob] = useState<AdminTransportJob | null>(null);
  const [reassignDriverId, setReassignDriverId] = useState('');
  const [reassignNote, setReassignNote] = useState('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [data, driverList] = await Promise.all([
        adminGetTransportJobs(token),
        adminGetDrivers(token),
      ]);
      setJobs(data);
      setDrivers(driverList);
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
  const stuckCount = jobs.filter(
    (j) =>
      j.status === 'AVAILABLE' &&
      !j.driver &&
      Date.now() - new Date(j.createdAt).getTime() > 24 * 3600 * 1000,
  ).length;

  function handleRateSaved(jobId: string, rate: number, pricePerTonne: number | null) {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, rate, pricePerTonne } : j)));
  }

  async function handleReassign() {
    if (!reassignJob || !token || !reassignDriverId.trim()) return;
    setReassigning(true);
    try {
      const updated = await adminReassignJob(
        reassignJob.id,
        reassignDriverId.trim(),
        reassignNote,
        token,
      );
      setJobs((prev) =>
        prev.map((j) =>
          j.id === reassignJob.id ? { ...j, status: updated.status, driver: updated.driver } : j,
        ),
      );
      setReassignJob(null);
      setReassignDriverId('');
      setReassignNote('');
    } catch (err) {
      alert((err as Error).message || 'Pārsūtīšana neizdevās');
    } finally {
      setReassigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rate override panel (modal) */}
      {rateJob && token && (
        <RatePanel
          job={rateJob}
          token={token}
          onClose={() => setRateJob(null)}
          onSaved={handleRateSaved}
        />
      )}
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

      {/* Stuck jobs alert — AVAILABLE > 24h with no driver */}
      {stuckCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-semibold">
            {stuckCount} darb{stuckCount === 1 ? 's' : 'i'} bez šofera vairāk nekā 24 stundas.{' '}
            Sistēma nevar atrast brīvu vadītāju — nepieciešama manuāla piešķiršana.
          </span>
          <button
            type="button"
            className="ml-auto text-xs underline underline-offset-2"
            onClick={() => setFilter('AVAILABLE')}
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
                    Datums / Vecums
                  </th>
                  <th className="px-4 py-3" />
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 group/rate">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {j.rate.toLocaleString('lv-LV', {
                              style: 'currency',
                              currency: j.currency,
                            })}
                          </p>
                          {j.pricePerTonne != null && (
                            <p className="text-[11px] text-muted-foreground">
                              {j.pricePerTonne.toLocaleString('lv-LV', {
                                style: 'currency',
                                currency: j.currency,
                              })}
                              /t
                            </p>
                          )}
                        </div>
                        {!BLOCKED_FOR_RATE.has(j.status) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRateJob(j);
                            }}
                            title="Labot likmi"
                            className="opacity-0 group-hover/rate:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
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
                      <div>{new Date(j.createdAt).toLocaleDateString('lv-LV')}</div>
                      {j.status === 'AVAILABLE' &&
                        !j.driver &&
                        (() => {
                          const hrs = Math.floor(
                            (Date.now() - new Date(j.createdAt).getTime()) / 3600000,
                          );
                          return hrs > 0 ? (
                            <div
                              className={`font-semibold ${hrs >= 48 ? 'text-red-600' : hrs >= 24 ? 'text-amber-600' : 'text-gray-400'}`}
                            >
                              {hrs}h gaidīts
                            </div>
                          ) : null;
                        })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!['COMPLETED', 'CANCELLED'].includes(j.status) && (
                        <button
                          type="button"
                          title="Pārsūtīt šoferim"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReassignJob(j);
                            setReassignDriverId(j.driver?.id ?? '');
                            setReassignNote('');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                        >
                          <UserRoundCog className="h-3 w-3" />
                          Pārsūtīt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reassign driver dialog */}
      <Dialog open={!!reassignJob} onOpenChange={(open) => !open && setReassignJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pārsūtīt darbu {reassignJob?.jobNumber} citam šoferim</DialogTitle>
            <DialogDescription>
              Izvēlieties šoferi no saraksta. Darbam tiks piešķirts statuss ASSIGNED.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Šoferis *
              </label>
              {drivers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nav reģistrētu šoferu.</p>
              ) : (
                <select
                  value={reassignDriverId}
                  onChange={(e) => setReassignDriverId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="">— Izvēlēties šoferi —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.firstName} {d.lastName}
                      {d.phone ? ` · ${d.phone}` : ''}
                    </option>
                  ))}
                </select>
              )}
              {reassignJob?.driver && (
                <p className="text-xs text-muted-foreground">
                  Pašreizējais: {reassignJob.driver.firstName} {reassignJob.driver.lastName}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pamatojums (ierakstīts audita žurnālā) *
              </label>
              <Textarea
                placeholder="Pārsūtīšanas iemesls..."
                value={reassignNote}
                onChange={(e) => setReassignNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignJob(null)} disabled={reassigning}>
              Atcelt
            </Button>
            <Button
              onClick={handleReassign}
              disabled={reassigning || !reassignDriverId.trim() || !reassignNote.trim()}
            >
              {reassigning ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <UserRoundCog className="h-4 w-4 mr-1.5" />
              )}
              Pārsūtīt šoferim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
