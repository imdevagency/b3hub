/**
 * Orders list page — /dashboard/orders
 * Shows the current user's material purchase orders with status filters.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  ORDER_STATUS,
  JOB_STATUS,
  SKIP_STATUS,
  SKIP_SIZE_LABEL,
  StatusBadgeHex,
} from '@/lib/status-config';
import { PageSpinner } from '@/components/ui/page-spinner';

import {
  listTransportJobExceptions,
  reportTransportJobException,
  resolveTransportJobException,
  updateTransportJobStatus,
  getTransportDocumentReadiness,
  submitDeliveryProof,
  confirmOrder,
  cancelOrder,
  type ApiTransportJob,
  type ApiTransportJobException,
} from '@/lib/api';
import { useActiveTransportJob } from '@/hooks/use-active-transport-job';
import { useTransportJobs } from '@/hooks/use-transport-jobs';
import { useMaterialOrders } from '@/hooks/use-material-orders';
import { useBuyerOrders } from '@/hooks/use-buyer-orders';
import { useMode } from '@/lib/mode-context';
import {
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ExternalLink,
  Map,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

// ── Active-job status progression ─────────────────────────────────────────────

const STATUS_STEPS = [
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
] as const;

type JobStatus = (typeof STATUS_STEPS)[number];

const NEXT_STATUS: Record<JobStatus, JobStatus | null> = {
  ACCEPTED: 'EN_ROUTE_PICKUP',
  EN_ROUTE_PICKUP: 'AT_PICKUP',
  AT_PICKUP: 'LOADED',
  LOADED: 'EN_ROUTE_DELIVERY',
  EN_ROUTE_DELIVERY: 'AT_DELIVERY',
  AT_DELIVERY: 'DELIVERED',
  DELIVERED: null,
};

const STATUS_LABEL: Record<JobStatus, string> = {
  ACCEPTED: 'Pieņemts',
  EN_ROUTE_PICKUP: 'Brauc uz izbraukšanu',
  AT_PICKUP: 'Pie izbraukšanas vietas',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz piegādi',
  AT_DELIVERY: 'Pie piegādes vietas',
  DELIVERED: 'Piegādāts',
};

const NEXT_ACTION_LABEL: Record<JobStatus, string> = {
  ACCEPTED: 'Sākt braukt uz iekraušanu',
  EN_ROUTE_PICKUP: 'Esmu pie iekraušanas',
  AT_PICKUP: 'Apstiprināt iekraušanu',
  LOADED: 'Sākt piegādi',
  EN_ROUTE_DELIVERY: 'Esmu pie piegādes',
  AT_DELIVERY: 'Apstiprināt piegādi',
  DELIVERED: '',
};

function StaticMapEmbed({
  pickupLat,
  pickupLng,
  pickupLabel,
  deliveryLat,
  deliveryLng,
  deliveryLabel,
}: {
  pickupLat: number;
  pickupLng: number;
  pickupLabel: string;
  deliveryLat: number;
  deliveryLng: number;
  deliveryLabel: string;
}) {
  const key = getGoogleMapsPublicKey();
  const origin = `${pickupLat},${pickupLng}`;
  const destination = `${deliveryLat},${deliveryLng}`;
  const src = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${origin}&destination=${destination}&mode=driving`;
  return (
    <div className="w-full rounded-2xl overflow-hidden border shadow-sm" style={{ height: 280 }}>
      {key ? (
        <iframe
          title={`Maršruts: ${pickupLabel} → ${deliveryLabel}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={src}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Map className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium">Karte nav pieejama</p>
          <p className="text-xs">Nav Google Maps API atslēgas</p>
        </div>
      )}
    </div>
  );
}

function ActiveProgressBar({ currentStatus }: { currentStatus: JobStatus }) {
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-1.5">
      {STATUS_STEPS.map((step, i) => (
        <div
          key={step}
          title={STATUS_LABEL[step]}
          className={`h-2 flex-1 rounded-full transition-colors ${
            i < currentIndex ? 'bg-primary' : i === currentIndex ? 'bg-primary/40' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  );
}

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

const EXCEPTION_TYPE_OPTIONS = [
  { value: 'DRIVER_NO_SHOW', label: 'Šoferis neieradās' },
  { value: 'SUPPLIER_NOT_READY', label: 'Piegādātājs nav gatavs' },
  { value: 'WRONG_MATERIAL', label: 'Nepareizs materiāls' },
  { value: 'PARTIAL_DELIVERY', label: 'Daļēja piegāde' },
  { value: 'REJECTED_DELIVERY', label: 'Piegāde atteikta' },
  { value: 'SITE_CLOSED', label: 'Objekts slēgts' },
  { value: 'OVERWEIGHT', label: 'Pārsniegts svars' },
  { value: 'OTHER', label: 'Cits' },
] as const;

function formatSlaStage(stage: string | null | undefined): string {
  if (stage === 'PICKUP_DELAY') return 'Kavēta iekraušana';
  if (stage === 'DELIVERY_DELAY') return 'Kavēta piegāde';
  return 'Grafikā';
}

function QuickStat({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  return (
    <div
      className={`flex flex-col justify-center rounded-3xl ${alert ? 'bg-red-50 text-red-900' : 'bg-muted/40'} p-6 transition-all duration-200`}
    >
      <span
        className={`text-[13px] font-medium tracking-wide mb-2 ${alert ? 'text-red-700' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
      <span className={`text-4xl font-bold tracking-tight ${alert ? '' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function formatDocCode(code: string): string {
  if (code === 'DELIVERY_PROOF') return 'Piegādes apliecinājums';
  if (code === 'WEIGHING_SLIP') return 'Svēršanas biļete';
  return code.replaceAll('_', ' ').toLowerCase();
}

// ── Active-job tab ─────────────────────────────────────────────────────────────

function ActiveJobTab({ token, onDelivered }: { token: string; onDelivered?: () => void }) {
  const router = useRouter();
  const { job, setJob, loading, reload } = useActiveTransportJob(token);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [deliveryBlockers, setDeliveryBlockers] = useState<string[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptions, setExceptions] = useState<ApiTransportJobException[]>([]);
  const [exceptionType, setExceptionType] =
    useState<(typeof EXCEPTION_TYPE_OPTIONS)[number]['value']>('OTHER');
  const [exceptionNotes, setExceptionNotes] = useState('');
  const [reportingException, setReportingException] = useState(false);
  const [resolvingExceptionId, setResolvingExceptionId] = useState<string | null>(null);
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({});

  // Delivery proof modal
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofRecipient, setProofRecipient] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Delivery success modal
  const [deliveredJob, setDeliveredJob] = useState<ApiTransportJob | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  useEffect(() => {
    let active = true;
    if (!job?.id || job.status !== 'AT_DELIVERY') {
      setDeliveryBlockers([]);
      setReadinessLoading(false);
      return;
    }

    setReadinessLoading(true);
    getTransportDocumentReadiness(job.id, token)
      .then((readiness) => {
        if (!active) return;
        setDeliveryBlockers(readiness.missing.filter((doc) => doc !== 'DELIVERY_PROOF'));
      })
      .catch(() => {
        if (!active) return;
        setDeliveryBlockers([]);
      })
      .finally(() => {
        if (active) setReadinessLoading(false);
      });

    return () => {
      active = false;
    };
  }, [job?.id, job?.status, token]);

  useEffect(() => {
    let active = true;
    if (!job?.id) {
      setExceptions([]);
      setExceptionsLoading(false);
      return;
    }

    setExceptionsLoading(true);
    listTransportJobExceptions(job.id, token)
      .then((data) => {
        if (!active) return;
        setExceptions(data);
      })
      .catch(() => {
        if (!active) return;
        setExceptions([]);
      })
      .finally(() => {
        if (active) setExceptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [job?.id, token]);

  const handleReportException = async () => {
    if (!job) return;
    const notes = exceptionNotes.trim();
    if (!notes) {
      alert('Lūdzu pievienojiet izņēmuma aprakstu.');
      return;
    }

    setReportingException(true);
    try {
      const created = await reportTransportJobException(
        job.id,
        { type: exceptionType, notes },
        token,
      );
      setExceptions((prev) => [created, ...prev]);
      setExceptionNotes('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās iesniegt izņēmumu');
    } finally {
      setReportingException(false);
    }
  };

  const handleResolveException = async (exceptionId: string) => {
    if (!job) return;
    const resolution = resolutionById[exceptionId]?.trim() || 'Atrisināts aktīvajā darbā';
    setResolvingExceptionId(exceptionId);
    try {
      const resolved = await resolveTransportJobException(job.id, exceptionId, resolution, token);
      setExceptions((prev) => prev.map((item) => (item.id === exceptionId ? resolved : item)));
      setResolutionById((prev) => ({ ...prev, [exceptionId]: '' }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās atrisināt izņēmumu');
    } finally {
      setResolvingExceptionId(null);
    }
  };

  const handleAdvance = async () => {
    if (!job) return;
    const current = job.status as JobStatus;
    if (current === 'AT_DELIVERY') {
      if (readinessLoading) {
        alert('Pārbaudām dokumentu gatavību. Lūdzu uzgaidiet brīdi.');
        return;
      }
      if (deliveryBlockers.length > 0) {
        alert(`Piegādi nevar pabeigt. Trūkst: ${deliveryBlockers.map(formatDocCode).join(', ')}`);
        return;
      }
      setProofRecipient('');
      setProofNotes('');
      setProofError(null);
      setShowProofModal(true);
      return;
    }
    const next = NEXT_STATUS[current];
    if (!next) return;
    if (!confirm(`Apstiprināt: ${STATUS_LABEL[current]} → ${STATUS_LABEL[next]}?`)) return;
    setAdvancing(true);
    try {
      const updated = await updateTransportJobStatus(job.id, next, token);
      setJob(updated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās atjaunināt statusu');
    } finally {
      setAdvancing(false);
    }
  };

  const handleProofSubmit = async () => {
    if (!job) return;
    setProofSubmitting(true);
    setProofError(null);
    try {
      const updated = await submitDeliveryProof(
        job.id,
        {
          notes: proofNotes.trim() || undefined,
          recipientName: proofRecipient.trim() || undefined,
        },
        token,
      );
      setJob(updated);
      setShowProofModal(false);
      if (updated.status === 'DELIVERED') {
        setDeliveredJob(updated);
      }
    } catch (e: unknown) {
      setProofError(e instanceof Error ? e.message : 'Neizdevās iesniegt piegādes apstiprinājumu');
    } finally {
      setProofSubmitting(false);
    }
  };

  if (loading) {
    return <PageSpinner className="py-32" />;
  }

  return (
    <div className="space-y-6">
      {/* Delivery Success Modal */}
      {deliveredJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-background w-full max-w-md rounded-[2rem] shadow-2xl border-0 ring-1 ring-black/5 overflow-hidden">
            {/* Success header */}
            <div className="bg-green-50 px-6 py-8 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-xl font-extrabold text-green-800">Piegāde pabeigta!</h2>
              <p className="text-sm text-green-700 text-center">
                Darbs #{deliveredJob.jobNumber} veiksmīgi pabeigts
              </p>
            </div>
            {/* Details */}
            <div className="px-6 py-5 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-gray-700 font-medium">{deliveredJob.pickupCity}</span>
                <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-700 font-medium">{deliveredJob.deliveryCity}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-gray-600">{deliveredJob.cargoType}</span>
                {deliveredJob.cargoWeight != null && (
                  <span className="text-gray-400">· {deliveredJob.cargoWeight} t</span>
                )}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Nopelnīts</span>
                <span className="text-2xl font-extrabold text-green-700">
                  €{(deliveredJob.rate ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
            {/* Actions */}
            <div className="px-6 pb-6">
              <Button
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold text-base"
                onClick={() => {
                  setDeliveredJob(null);
                  setJob(null);
                  onDelivered?.();
                }}
              >
                Skatīt vēsturi
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Proof Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-background w-full max-w-md rounded-[2rem] shadow-2xl border-0 ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                  <ClipboardCheck className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Piegādes apstiprinājums</h2>
                  <p className="text-xs text-muted-foreground">Aizpildiet un iesniedziet</p>
                </div>
              </div>
              <button
                onClick={() => setShowProofModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Saņēmēja vārds
                </label>
                <input
                  type="text"
                  value={proofRecipient}
                  onChange={(e) => setProofRecipient(e.target.value)}
                  placeholder="Jānis Bērziņš"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Piezīmes (pēc izvēles)
                </label>
                <textarea
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder="Piegāde veiksmīga, bez bojājumiem..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
              {proofError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {proofError}
                </p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setShowProofModal(false)}
                disabled={proofSubmitting}
              >
                Atcelt
              </Button>
              <Button
                className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleProofSubmit}
                disabled={proofSubmitting}
              >
                {proofSubmitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {proofSubmitting ? 'Sūta...' : 'Apstiprināt piegādi'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Aktīvais darbs</h2>
          {job && (
            <p className="text-sm text-muted-foreground mt-0.5">
              #{job.jobNumber} · {job.cargoType} {job.cargoWeight ?? 0} t
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* No active job */}
      {!job && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Truck className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Nav aktīva darba</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Jums šobrīd nav neviena aktīva pārvadājuma. Atveriet darbu sarakstu, lai atrastu un
              pieņemtu jaunus uzdevumus.
            </p>
          </div>
          <button
            className="mt-4 flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
            onClick={() => router.push('/dashboard/jobs')}
          >
            <MapPin className="h-4 w-4" />
            Atvērt darbu sarakstu
          </button>
        </div>
      )}

      {job &&
        (() => {
          const currentStatus = job.status as JobStatus;
          const currentIndex = STATUS_STEPS.indexOf(currentStatus);
          const openExceptions = exceptions.filter((item) => item.status === 'OPEN');
          // Safety: if status is not a known in-progress status, show empty state
          if (currentIndex === -1 || currentStatus === 'DELIVERED') return null;
          const nextStatus = NEXT_STATUS[currentStatus];
          const isHeadingToPickup =
            currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';

          return (
            <>
              {/* Status card */}
              <div className="bg-muted/40 rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 bg-red-50 border-0 text-red-700 text-sm font-bold rounded-full px-4 py-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {STATUS_LABEL[currentStatus]}
                  </span>
                  <span className="text-xl font-extrabold text-primary">
                    €{(job.rate ?? 0).toFixed(2)}
                  </span>
                </div>
                <ActiveProgressBar currentStatus={currentStatus} />
                <p className="text-xs text-muted-foreground">
                  Solis {currentIndex + 1} no {STATUS_STEPS.length}
                </p>
              </div>

              {/* SLA widget */}
              <div
                className={`rounded-3xl border-0 p-6 ${
                  job.sla?.isOverdue ? 'bg-red-50 text-red-900' : 'bg-blue-50/50 text-blue-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-full p-1.5 ${
                      job.sla?.isOverdue ? 'bg-red-100' : 'bg-blue-100'
                    }`}
                  >
                    <CalendarDays
                      className={`h-4 w-4 ${job.sla?.isOverdue ? 'text-red-700' : 'text-blue-700'}`}
                    />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-bold ${
                        job.sla?.isOverdue ? 'text-red-800' : 'text-blue-800'
                      }`}
                    >
                      SLA statuss
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        job.sla?.isOverdue ? 'text-red-700' : 'text-blue-700'
                      }`}
                    >
                      {job.sla?.isOverdue
                        ? `${formatSlaStage(job.sla?.stage)} · ${job.sla?.overdueMinutes ?? 0} min`
                        : 'Grafikā, kavējums nav konstatēts'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Map */}
              {job.pickupLat != null &&
                job.pickupLng != null &&
                job.deliveryLat != null &&
                job.deliveryLng != null && (
                  <StaticMapEmbed
                    pickupLat={job.pickupLat}
                    pickupLng={job.pickupLng}
                    pickupLabel={job.pickupCity}
                    deliveryLat={job.deliveryLat}
                    deliveryLng={job.deliveryLng}
                    deliveryLabel={job.deliveryCity}
                  />
                )}

              {/* Route detail card */}
              <div className="bg-muted/40 rounded-3xl p-6 space-y-5">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                  Maršruts
                </h3>
                {/* Pickup */}
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-primary border-2 border-primary/20 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                      Iekraušana
                    </p>
                    <p className="font-semibold text-sm text-gray-900 mt-0.5">{job.pickupCity}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.pickupAddress}</p>
                    {job.pickupWindow && (
                      <p className="text-xs text-gray-500 mt-1">Logs: {job.pickupWindow}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {isHeadingToPickup && job.pickupLat != null && job.pickupLng != null && (
                      <a
                        href={mapsUrl(job.pickupLat!, job.pickupLng!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Navigēt
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="w-px h-5 bg-gray-200 ml-1.5" />
                {/* Delivery */}
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-600 border-2 border-green-200 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                      Piegāde
                    </p>
                    <p className="font-semibold text-sm text-gray-900 mt-0.5">{job.deliveryCity}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.deliveryAddress}</p>
                    {job.deliveryWindow && (
                      <p className="text-xs text-gray-500 mt-1">Logs: {job.deliveryWindow}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {!isHeadingToPickup && job.deliveryLat != null && job.deliveryLng != null && (
                      <a
                        href={mapsUrl(job.deliveryLat!, job.deliveryLng!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Navigēt
                        <ExternalLink className="h-3 w-3 opacity-70" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Cargo details */}
              <div className="bg-muted/40 rounded-3xl p-6 flex flex-wrap gap-8">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                    Krava
                  </p>
                  <p className="font-bold text-gray-900 mt-0.5">{job.cargoType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                    Svars
                  </p>
                  <p className="font-bold text-gray-900 mt-0.5">{job.cargoWeight ?? '—'} t</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                    Attālums
                  </p>
                  <p className="font-bold text-gray-900 mt-0.5">{job.distanceKm ?? '—'} km</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                    Transportl.
                  </p>
                  <p className="font-bold text-gray-900 mt-0.5">
                    {job.requiredVehicleType ?? job.requiredVehicleEnum ?? '—'}
                  </p>
                </div>
              </div>

              {/* Exceptions widget */}
              <div className="pt-2 mt-4">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-base font-semibold text-foreground">
                      Problēmas / Izņēmumi
                    </h3>
                  </div>
                  {openExceptions.length > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                      {openExceptions.length} atvērti
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <select
                    value={exceptionType}
                    onChange={(e) =>
                      setExceptionType(
                        e.target.value as (typeof EXCEPTION_TYPE_OPTIONS)[number]['value'],
                      )
                    }
                    className="h-11 rounded-lg border-transparent bg-muted/40 px-4 transition-all outline-none focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-55 text-sm"
                  >
                    {EXCEPTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={exceptionNotes}
                    onChange={(e) => setExceptionNotes(e.target.value)}
                    placeholder="Aprakstiet situāciju dispečeram"
                    className="h-11 flex-1 rounded-lg border-transparent bg-muted/40 px-4 transition-all outline-none focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/50 text-sm"
                  />
                  <Button
                    type="button"
                    variant="default"
                    className="h-11"
                    onClick={handleReportException}
                    disabled={reportingException}
                  >
                    {reportingException ? 'Sūta...' : 'Ziņot'}
                  </Button>
                </div>

                {exceptionsLoading ? (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/10">
                    <p className="text-sm text-muted-foreground">Ielādē izņēmumus...</p>
                  </div>
                ) : exceptions.length === 0 ? (
                  <div className="flex flex-col h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/5 gap-2">
                    <AlertTriangle className="h-6 w-6 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Pašlaik nav reģistrētu problēmu.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {exceptions.map((item) => {
                      const isOpen = item.status === 'OPEN';
                      return (
                        <div key={item.id} className="rounded-2xl bg-muted/40 p-5 space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">{item.type}</p>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${
                                isOpen
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOpen ? 'ATVĒRTS' : 'ATRISINĀTS'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.notes}</p>
                          {isOpen && (
                            <div className="flex flex-col sm:flex-row gap-2 mt-2 pt-3 border-t border-border/50">
                              <input
                                value={resolutionById[item.id] ?? ''}
                                onChange={(e) =>
                                  setResolutionById((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="Atrisinājuma komentārs"
                                className="h-10 flex-1 rounded-lg border-transparent bg-muted/40 px-3 text-sm transition-all outline-none focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/50"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-10"
                                onClick={() => handleResolveException(item.id)}
                                disabled={resolvingExceptionId === item.id}
                              >
                                {resolvingExceptionId === item.id ? 'Saglabā...' : 'Atrisināt'}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action */}
              {currentStatus === 'AT_DELIVERY' && deliveryBlockers.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-semibold text-red-700">Trūkst obligāti dokumenti</p>
                  <p className="mt-1 text-xs text-red-700">
                    Piegādi nevar pabeigt, kamēr nav iesniegti:{' '}
                    {deliveryBlockers.map(formatDocCode).join(', ')}
                  </p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 pb-4">
                {nextStatus && (
                  <Button
                    className="flex-1 h-12 text-base font-bold"
                    onClick={handleAdvance}
                    disabled={advancing || (currentStatus === 'AT_DELIVERY' && readinessLoading)}
                  >
                    {advancing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {NEXT_ACTION_LABEL[currentStatus]}
                  </Button>
                )}
                {!nextStatus && (
                  <div className="flex-1 flex items-center justify-center gap-3 bg-green-50 border border-green-200 rounded-2xl h-14">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <span className="font-bold text-green-700 text-base">Piegādāts!</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}
    </div>
  );
}

// ── CARRIER view ───────────────────────────────────────────────────────────────

function CarrierHistoryView({ token }: { token: string }) {
  const { jobs, loading, reload } = useTransportJobs(token);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const ACTIVE = [
    'ACCEPTED',
    'EN_ROUTE_PICKUP',
    'AT_PICKUP',
    'LOADED',
    'EN_ROUTE_DELIVERY',
    'AT_DELIVERY',
  ];

  const filtered = jobs.filter((j) => {
    if (filter === 'active') return ACTIVE.includes(j.status);
    if (filter === 'done') return j.status === 'DELIVERED';
    return true;
  });

  const totalTonnes = filtered
    .filter((j) => ACTIVE.includes(j.status))
    .reduce((s, j) => s + (j.cargoWeight ?? 0) / 1000, 0);

  const totalEarnings = filtered
    .filter((j) => j.status === 'DELIVERED')
    .reduce((s, j) => s + (j.rate ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
        <QuickStat value={String(jobs.length)} label="Kopā darbi" />
        <QuickStat
          value={String(jobs.filter((j) => ACTIVE.includes(j.status)).length)}
          label="Aktīvie"
        />
        <QuickStat value={`${totalTonnes.toFixed(1)} t`} label="Tonnas tranzītā" />
        <QuickStat value={fmtMoney(totalEarnings)} label="Nopelnīts" />
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {f === 'all' ? 'Visi' : f === 'active' ? 'Aktīvie' : 'Pabeigti'}
            </button>
          ))}
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Truck className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">Nav neviena darba</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Vēl neesat pieņēmuši nevienu darbu. Atveriet darbu dēli, lai atrastu un pieņemtu
              jaunus kravu pārvadāšanas darbus.
            </p>
          </div>
          <Link
            href="/dashboard/jobs"
            className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
          >
            <Search className="h-4 w-4" />
            Meklēt darbus
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Truck className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav darbu šajā kategorijā</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((job) => {
            const st = JOB_STATUS[job.status] ?? {
              label: job.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const weightTStr = job.cargoWeight ? `${(job.cargoWeight / 1000).toFixed(2)} t` : '—';
            return (
              <Link
                key={job.id}
                href={`/dashboard/orders/${job.id}`}
                className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
              >
                {/* Meta Top Row */}
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="font-mono font-bold text-[11px] text-muted-foreground border bg-muted/30 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        #{job.jobNumber}
                      </p>
                      <StatusBadgeHex cfg={st} />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground">
                      {fmtMoney(job.rate ?? 0)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-sm text-muted-foreground/90 font-medium">
                      <span>{job.cargoType}</span>
                      <span>•</span>
                      <span>{weightTStr}</span>
                      {job.distanceKm && (
                        <>
                          <span>•</span>
                          <span>{job.distanceKm} km</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Route */}
                <div className="flex items-start my-5 bg-muted/20 rounded-xl p-4 border border-border/30">
                  <div className="flex flex-col items-center mr-4 mt-1.5">
                    <div className="w-2 h-2 rounded-full bg-foreground z-10 shrink-0" />
                    <div className="w-px h-5.5 bg-foreground opacity-20 shrink-0" />
                    <div className="w-2 h-2 rounded-[1px] bg-foreground z-10 shrink-0" />
                  </div>
                  <div className="flex flex-col gap-3 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[15px] font-semibold leading-none">{job.pickupCity}</p>
                      <span className="text-xs font-semibold text-muted-foreground bg-white border shadow-sm rounded-md px-2 py-1">
                        {fmtDate(job.pickupDate)}
                      </span>
                    </div>
                    <p className="text-[15px] font-semibold leading-none text-muted-foreground">
                      {job.deliveryCity}
                    </p>
                  </div>
                </div>

                {/* Vehicle & assignment footer */}
                {job.vehicle && (
                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5 border border-border/50">
                      <Truck className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-foreground">
                        {job.vehicle.licensePlate}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground uppercase">
                        {job.vehicle.vehicleType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-primary">
                      Sekot darbam
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                )}
                {!job.vehicle && (
                  <div className="pt-2 flex items-center justify-end">
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-primary group-hover:underline">
                      Sekot darbam
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CarrierView({ token }: { token: string }) {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [historyKey, setHistoryKey] = useState(0);
  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit mb-4">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-background shadow-xs text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {t === 'active' ? 'Aktīvais' : 'Vēsture'}
          </button>
        ))}
      </div>
      {tab === 'active' ? (
        <ActiveJobTab
          token={token}
          onDelivered={() => {
            setHistoryKey((k) => k + 1);
            setTab('history');
          }}
        />
      ) : (
        <CarrierHistoryView key={historyKey} token={token} />
      )}
    </div>
  );
}

// ── SUPPLIER view ──────────────────────────────────────────────────────────────

function SupplierView({ token }: { token: string }) {
  const { orders, setOrders, loading, reload } = useMaterialOrders(token);
  const [actioning, setActioning] = useState<string | null>(null);

  const handleConfirm = async (id: string) => {
    setActioning(id);
    try {
      const updated = await confirmOrder(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
    } catch {
      /**/
    } finally {
      setActioning(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Vai atcelt šo pasūtījumu?')) return;
    setActioning(id);
    try {
      await cancelOrder(id, token);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch {
      /**/
    } finally {
      setActioning(null);
    }
  };

  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const revenue = orders
    .filter((o) => !['PENDING', 'CANCELLED'].includes(o.status))
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
        <QuickStat value={String(orders.length)} label="Kopā pasūtījumi" />
        <QuickStat value={String(pending)} label="Gaida apstiprinājumu" alert={pending > 0} />
        <QuickStat value={fmtMoney(revenue)} label="Kopā ieņēmumi" />
      </div>

      <div className="flex justify-end mb-4">
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">Nav ienākošu pasūtījumu</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Kad pircēji veiks pasūtījumu, tas parādīsies šeit. Pārliecinieties, ka jūsu
              piedāvājumi ir aktīvi.
            </p>
          </div>
          <Link
            href="/dashboard/materials"
            className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
          >
            <Package className="h-4 w-4" />
            Pārvaldīt piedāvājumus
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>{orders.length} pasūtījumi</span>
            <span className="font-medium text-foreground">
              Kopā: {fmtMoney(orders.reduce((s, o) => s + o.total, 0))}
            </span>
          </div>
          {orders.map((order) => {
            const st = ORDER_STATUS[order.status] ?? {
              label: order.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const item = order.items?.[0];
            const busy = actioning === order.id;

            return (
              <div
                key={order.id}
                className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
              >
                {/* Header row */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                      #{order.orderNumber}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {fmtDate(order.createdAt)}
                    </span>
                  </div>
                  <div
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: st.bg, color: st.text }}
                  >
                    {st.label}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                  {/* Material Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-medium text-base">{item?.material?.name ?? '—'}</h3>
                      {item && (
                        <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                    {item?.material?.category && (
                      <p className="text-sm text-muted-foreground">{item.material.category}</p>
                    )}
                  </div>

                  {/* Route & Contact Timeline */}
                  <div className="flex-[1.5] space-y-4">
                    <div className="relative pl-6">
                      <div className="absolute left-2.75 top-2 -bottom-4 w-px bg-black/10" />

                      {/* Buyer */}
                      <div className="relative mb-4">
                        <div className="absolute -left-6 top-1.5 size-2 rounded-full bg-blue-500 ring-4 ring-white" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Pircējs</p>
                        {order.buyer ? (
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {order.buyer.firstName} {order.buyer.lastName}
                            </p>
                            {order.buyer.phone && (
                              <div
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `tel:${order.buyer?.phone}`;
                                }}
                              >
                                <Phone className="size-3.5" />
                                {order.buyer.phone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Delivery */}
                      <div className="relative">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          Piegāde • {fmtDate(order.deliveryDate)}
                        </p>
                        <p className="text-sm font-medium text-foreground pr-8">
                          {order.deliveryAddress || order.deliveryCity || '—'}
                        </p>
                        {order.siteContactPhone && (
                          <div
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-1 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${order.siteContactPhone}`;
                            }}
                          >
                            <Phone className="size-3.5" />
                            {order.siteContactName ?? 'Objekta'}, {order.siteContactPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Actions */}
                  <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-0">
                    <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1 mb-4">
                      <span className="text-sm text-muted-foreground sm:text-right">Summa</span>
                      <span className="text-lg font-bold tabular-nums">
                        {fmtMoney(order.total)}
                      </span>
                    </div>

                    {order.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 mt-auto">
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            handleConfirm(order.id);
                          }}
                          className="flex items-center justify-center w-full gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="size-4" />
                          Apstiprināt
                        </button>
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            handleCancel(order.id);
                          }}
                          className="flex items-center justify-center w-full gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <X className="size-4" />
                          Noraidīt
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── BUYER view ─────────────────────────────────────────────────────────────────

function BuyerView({ token }: { token: string }) {
  const [tab, setTab] = useState<'skip' | 'material'>('skip');
  const { skipOrders, matOrders, loading, reload } = useBuyerOrders(token);

  const totalSpent =
    skipOrders.reduce((s, o) => s + o.price, 0) + matOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
        <QuickStat value={String(skipOrders.length)} label="Konteineri" />
        <QuickStat value={String(matOrders.length)} label="Materiāli" />
        <QuickStat value={fmtMoney(totalSpent)} label="Kopā iztērēts" />
      </div>

      {/* Tabs + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          {[
            { key: 'skip', label: `Konteineri (${skipOrders.length})` },
            { key: 'material', label: `Materiāli (${matOrders.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'skip' | 'material')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : tab === 'skip' ? (
        /* Skip-hire table */
        skipOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
              <Trash2 className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-foreground">Nav konteineru pasūtījumu</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Jums vēl nav neviena konteinera nomas pasūtījuma. Pasūtiet konteineru atkritumu
                izvešanai.
              </p>
            </div>
            <Link
              href="/dashboard/order/skip-hire"
              className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Pasūtīt konteineru
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{skipOrders.length} konteineri</span>
            </div>
            {skipOrders.map((o) => {
              const st = SKIP_STATUS[o.status] ?? {
                label: o.status,
                bg: '#f3f4f6',
                text: '#374151',
              };
              return (
                <div
                  key={o.id}
                  className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                        #{o.orderNumber}
                      </span>
                    </div>
                    <div
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: st.bg, color: st.text }}
                    >
                      {st.label}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                    {/* Skip Info */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline justify-between mb-2">
                        <h3 className="font-medium text-base">
                          {SKIP_SIZE_LABEL[o.skipSize] ?? o.skipSize}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {o.wasteCategory.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>

                    {/* Timeline */}
                    <div className="flex-[1.5] space-y-4">
                      <div className="relative pl-6">
                        <div className="absolute left-2.75 top-2 bottom-2 w-px bg-black/10" />

                        {/* Delivery */}
                        <div className="relative">
                          <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">
                            Adrese • {fmtDate(o.deliveryDate)}
                          </p>
                          <p className="text-sm font-medium text-foreground pr-8">
                            {o.location || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-0">
                      <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
                        <span className="text-sm text-muted-foreground sm:text-right">Cena</span>
                        <div className="text-lg font-bold tabular-nums">
                          €{o.price}{' '}
                          <span className="text-sm font-normal text-muted-foreground">
                            {o.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : /* Material orders table */
      matOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">Nav materiālu pasūtījumu</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Jums vēl nav neviena materiālu pasūtījuma. Apskatiet piedāvājumus un pasūtiet
              nepieciešamos materiālus.
            </p>
          </div>
          <Link
            href="/dashboard/materials"
            className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
          >
            <Search className="h-4 w-4" />
            Meklēt materiālus
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>{matOrders.length} pasūtījumi</span>
          </div>
          {matOrders.map((o) => {
            const st = ORDER_STATUS[o.status] ?? {
              label: o.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const item = o.items?.[0];
            return (
              <div
                key={o.id}
                className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
              >
                {/* Header row */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                      #{o.orderNumber}
                    </span>
                  </div>
                  <div
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: st.bg, color: st.text }}
                  >
                    {st.label}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                  {/* Material Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-medium text-base">{item?.material?.name ?? '—'}</h3>
                      {item && (
                        <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="flex-[1.5] space-y-4">
                    <div className="relative pl-6">
                      <div className="absolute left-2.75 top-2 bottom-2 w-px bg-black/10" />

                      {/* Delivery */}
                      <div className="relative">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          Adrese • {fmtDate(o.deliveryDate)}
                        </p>
                        <p className="text-sm font-medium text-foreground pr-8">
                          {o.deliveryAddress || o.deliveryCity || '—'}
                        </p>
                        {(() => {
                          const driver = o.transportJobs?.find(
                            (j) =>
                              j.status === 'EN_ROUTE_DELIVERY' ||
                              j.status === 'AT_DELIVERY' ||
                              j.status === 'LOADED',
                          )?.driver;
                          if (!driver) return null;
                          return (
                            <div className="mt-2 flex items-center gap-1.5">
                              <User className="size-3 text-blue-500 shrink-0" />
                              <span className="text-xs text-blue-700 font-medium">
                                {driver.firstName} {driver.lastName}
                              </span>
                              {driver.phone && (
                                <a
                                  href={`tel:${driver.phone}`}
                                  className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="size-3" />
                                  Zvanīt
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-0">
                    <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
                      <span className="text-sm text-muted-foreground sm:text-right">Summa</span>
                      <div className="text-lg font-bold tabular-nums">{fmtMoney(o.total)}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, token } = useRequireAuth();
  const { activeMode } = useMode();

  if (!token || !user) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  const isCarrier = activeMode === 'CARRIER';
  const isSupplier = activeMode === 'SUPPLIER';

  const title = isCarrier ? 'Mani Darbi' : isSupplier ? 'Ienākošie Pasūtījumi' : 'Mani Pasūtījumi';

  const subtitle = isCarrier
    ? 'Visi transporta darbi — aktīvie, pabeigti, tonnas tranzītā'
    : isSupplier
      ? 'Pilna pārredzamība — pircēji, materiāli, piegādes datumi, kontakti'
      : 'Jūsu konteineru un materiālu pasūtījumi reāllaikā';

  return (
    <div className="w-full h-full pb-20 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">{subtitle}</p>
      </div>

      {/* Role-aware content */}
      {isCarrier ? (
        <CarrierView token={token} />
      ) : isSupplier ? (
        <SupplierView token={token} />
      ) : (
        <BuyerView token={token} />
      )}
    </div>
  );
}
// reload
// force next reload
