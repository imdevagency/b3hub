'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  getMyOrders,
  getMySkipHireOrders,
  getMyTransportJobs,
  getMyActiveTransportJob,
  updateTransportJobStatus,
  submitDeliveryProof,
  confirmOrder,
  cancelOrder,
  type ApiOrder,
  type SkipHireOrder,
  type ApiTransportJob,
} from '@/lib/api';
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
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
  Weight,
  X,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtMoney(n: number): string {
  return `€${Math.round(n).toLocaleString('lv-LV')}`;
}

// ── Status config ──────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Gaidā', bg: '#fef3c7', text: '#b45309' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#dbeafe', text: '#1d4ed8' },
  PROCESSING: { label: 'Apstrādē', bg: '#e0e7ff', text: '#4338ca' },
  LOADING: { label: 'Iekraušana', bg: '#fce7f3', text: '#be185d' },
  DISPATCHED: { label: 'Nosūtīts', bg: '#dcfce7', text: '#15803d' },
  DELIVERING: { label: 'Piegāde', bg: '#dcfce7', text: '#15803d' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', text: '#166534' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

const JOB_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  AVAILABLE: { label: 'Pieejams', bg: '#f0fdf4', text: '#166534' },
  ASSIGNED: { label: 'Piešķirts', bg: '#e0e7ff', text: '#4338ca' },
  ACCEPTED: { label: 'Pieņemts', bg: '#dbeafe', text: '#1d4ed8' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz Iek.', bg: '#fef3c7', text: '#b45309' },
  AT_PICKUP: { label: 'Uz vietas', bg: '#fce7f3', text: '#be185d' },
  LOADED: { label: 'Iekrauts', bg: '#e0e7ff', text: '#4338ca' },
  EN_ROUTE_DELIVERY: { label: 'Piegādē', bg: '#fef3c7', text: '#b45309' },
  AT_DELIVERY: { label: 'Atvedis', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

const SKIP_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Gaidā', bg: '#fef3c7', text: '#b45309' },
  CONFIRMED: { label: 'Apst.', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#dcfce7', text: '#15803d' },
  COLLECTED: { label: 'Savākts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

const SKIP_SIZE_LABEL: Record<string, string> = {
  MINI: 'Mini 2 m³',
  MIDI: 'Midi 4 m³',
  BUILDERS: 'Celtn. 6 m³',
  LARGE: 'Liels 8 m³',
};

function StatusBadge({ cfg }: { cfg: { label: string; bg: string; text: string } }) {
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
    >
      {cfg.label}
    </span>
  );
}

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
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
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
            i < currentIndex ? 'bg-red-600' : i === currentIndex ? 'bg-red-300' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

// ── Active-job tab ─────────────────────────────────────────────────────────────

function ActiveJobTab({ token, onDelivered }: { token: string; onDelivered?: () => void }) {
  const router = useRouter();
  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Delivery proof modal
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofRecipient, setProofRecipient] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Delivery success modal
  const [deliveredJob, setDeliveredJob] = useState<ApiTransportJob | null>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await getMyActiveTransportJob(token);
      // Only show jobs that are in-progress (not delivered or assigned-but-not-started)
      const isActive =
        data != null &&
        (STATUS_STEPS as readonly string[]).includes(data.status) &&
        data.status !== 'DELIVERED';
      setJob(isActive ? data : null);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJob();
    setRefreshing(false);
  };

  const handleAdvance = async () => {
    if (!job) return;
    const current = job.status as JobStatus;
    if (current === 'AT_DELIVERY') {
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
    } catch (e: any) {
      alert(e?.message ?? 'Neizdevās atjaunināt statusu');
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
    } catch (e: any) {
      setProofError(e?.message ?? 'Neizdevās iesniegt piegādes apstiprinājumu');
    } finally {
      setProofSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delivery Success Modal */}
      {deliveredJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
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
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Aktīvais darbs</h2>
          {job && (
            <p className="text-sm text-muted-foreground mt-0.5">
              #{job.jobNumber} · {job.cargoType} {job.cargoWeight ?? 0} t
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* No active job */}
      {!job && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Truck className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-700">Nav aktīva darba</p>
            <p className="text-sm text-muted-foreground mt-1">Pieņemiet darbu no darbu saraksta</p>
          </div>
          <button
            className="mt-2 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
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
          // Safety: if status is not a known in-progress status, show empty state
          if (currentIndex === -1 || currentStatus === 'DELIVERED') return null;
          const nextStatus = NEXT_STATUS[currentStatus];
          const isHeadingToPickup =
            currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';

          return (
            <>
              {/* Status card */}
              <div className="bg-white border rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-full px-3 py-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {STATUS_LABEL[currentStatus]}
                  </span>
                  <span className="text-xl font-extrabold text-red-600">
                    €{(job.rate ?? 0).toFixed(2)}
                  </span>
                </div>
                <ActiveProgressBar currentStatus={currentStatus} />
                <p className="text-xs text-muted-foreground">
                  Solis {currentIndex + 1} no {STATUS_STEPS.length}
                </p>
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
              <div className="bg-white border rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                  Maršruts
                </h3>
                {/* Pickup */}
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-red-200 mt-1 shrink-0" />
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
              <div className="bg-white border rounded-2xl px-5 py-4 shadow-sm flex flex-wrap gap-6">
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

              {/* Action */}
              <div className="flex flex-col sm:flex-row gap-3 pb-4">
                {nextStatus && (
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 text-base font-bold"
                    onClick={handleAdvance}
                    disabled={advancing}
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
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyTransportJobs(token);
      setJobs(data);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Kopā darbi', value: String(jobs.length), icon: ClipboardList },
          {
            label: 'Aktīvie',
            value: String(jobs.filter((j) => ACTIVE.includes(j.status)).length),
            icon: Truck,
          },
          { label: 'Tonnas tranzītā', value: `${totalTonnes.toFixed(1)} t`, icon: Weight },
          { label: 'Nopelnīts (pabeigts)', value: fmtMoney(totalEarnings), icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className="size-4" />
              {label}
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'active', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f === 'all' ? 'Visi' : f === 'active' ? 'Aktīvie' : 'Pabeigti'}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <Truck className="h-10 w-10 text-red-300" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-gray-800">Nav neviena darba</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Vēl neesat pieņēmuši nevienu darbu. Atveriet darbu dēli, lai atrastu un pieņemtu
              jaunus kravu pārvadāšanas darbus.
            </p>
          </div>
          <Link
            href="/dashboard/jobs"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
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
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Darbs</th>
                <th className="px-4 py-3 text-left font-medium">Statuss</th>
                <th className="px-4 py-3 text-left font-medium">Krava</th>
                <th className="px-4 py-3 text-left font-medium">Svars</th>
                <th className="px-4 py-3 text-left font-medium">Maršruts</th>
                <th className="px-4 py-3 text-left font-medium">Datums</th>
                <th className="px-4 py-3 text-left font-medium">Transportlīdzeklis</th>
                <th className="px-4 py-3 text-right font-medium">Cena</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((job) => {
                const st = JOB_STATUS[job.status] ?? {
                  label: job.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const weightTStr = job.cargoWeight
                  ? `${(job.cargoWeight / 1000).toFixed(2)} t`
                  : '—';
                return (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-xs">#{job.jobNumber}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{job.jobType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge cfg={st} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{job.cargoType}</p>
                      {job.requiredVehicleType && (
                        <p className="text-muted-foreground text-xs">{job.requiredVehicleType}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{weightTStr}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">{job.pickupCity}</span>
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{job.deliveryCity}</span>
                      </div>
                      {job.distanceKm && (
                        <p className="text-muted-foreground text-xs mt-0.5">{job.distanceKm} km</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{fmtDate(job.pickupDate)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {job.vehicle ? (
                        <>
                          <p className="font-medium">{job.vehicle.licensePlate}</p>
                          <p className="text-muted-foreground">{job.vehicle.vehicleType}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {fmtMoney(job.rate ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/orders/${job.id}`}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        <Truck className="size-3" />
                        Sekot
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td colSpan={8} className="px-4 py-2 text-muted-foreground">
                  {filtered.length} ieraksti
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {fmtMoney(filtered.reduce((s, j) => s + (j.rate ?? 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
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
      <div className="flex gap-2">
        {(['active', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
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
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyOrders(token);
      setOrders(data);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Kopā pasūtījumi', value: String(orders.length), icon: ClipboardList },
          {
            label: 'Gaida apstiprinājumu',
            value: String(pending),
            icon: Package,
            alert: pending > 0,
          },
          { label: 'Kopā ieņēmumi', value: fmtMoney(revenue), icon: Banknote },
        ].map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${alert ? 'border-amber-300 bg-amber-50' : 'bg-card'}`}
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className={`size-4 ${alert ? 'text-amber-600' : ''}`} />
              {label}
            </div>
            <p className={`text-xl font-bold ${alert ? 'text-amber-700' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <Package className="h-10 w-10 text-emerald-300" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-gray-800">Nav ienākošu pasūtījumu</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Kad pircēji veiks pasūtījumu, tas parādīsies šeit. Pārliecinieties, ka jūsu
              piedāvājumi ir aktīvi.
            </p>
          </div>
          <Link
            href="/dashboard/materials"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            <Package className="h-4 w-4" />
            Pārvaldīt piedāvājumus
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Pasūtījums</th>
                <th className="px-4 py-3 text-left font-medium">Statuss</th>
                <th className="px-4 py-3 text-left font-medium">Materiāls</th>
                <th className="px-4 py-3 text-left font-medium">Svars</th>
                <th className="px-4 py-3 text-left font-medium">Pircējs</th>
                <th className="px-4 py-3 text-left font-medium">Piegādes adrese</th>
                <th className="px-4 py-3 text-left font-medium">Datums</th>
                <th className="px-4 py-3 text-right font-medium">Summa</th>
                <th className="px-4 py-3 text-center font-medium">Darbības</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const st = ORDER_STATUS[order.status] ?? {
                  label: order.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const item = order.items?.[0];
                const busy = actioning === order.id;
                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-xs">#{order.orderNumber}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {fmtDate(order.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge cfg={st} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item?.material?.name ?? '—'}</p>
                      {item?.material?.category && (
                        <p className="text-muted-foreground text-xs">{item.material.category}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {item ? `${item.quantity} ${item.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {order.buyer ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <User className="size-3 text-muted-foreground" />
                            {order.buyer.firstName} {order.buyer.lastName}
                          </div>
                          {order.buyer.phone && (
                            <a
                              href={`tel:${order.buyer.phone}`}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                            >
                              <Phone className="size-3" />
                              {order.buyer.phone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{order.deliveryAddress || order.deliveryCity || '—'}</span>
                      </div>
                      {order.siteContactPhone && (
                        <a
                          href={`tel:${order.siteContactPhone}`}
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          title={order.siteContactName ?? 'Objekta kontakts'}
                        >
                          <Phone className="size-3" />
                          {order.siteContactName ?? order.siteContactPhone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtDate(order.deliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {fmtMoney(order.total)}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'PENDING' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            disabled={busy}
                            onClick={() => handleConfirm(order.id)}
                            className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle className="size-3" />
                            Apstiprināt
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => handleCancel(order.id)}
                            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <X className="size-3" />
                            Noraidīt
                          </button>
                        </div>
                      ) : (
                        <span className="block text-center text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td colSpan={7} className="px-4 py-2 text-muted-foreground">
                  {orders.length} pasūtījumi
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {fmtMoney(orders.reduce((s, o) => s + o.total, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── BUYER view ─────────────────────────────────────────────────────────────────

function BuyerView({ token }: { token: string }) {
  const [tab, setTab] = useState<'skip' | 'material'>('skip');
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skip, mat] = await Promise.all([getMySkipHireOrders(token), getMyOrders(token)]);
      setSkipOrders(skip);
      setMatOrders(mat);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const totalSpent =
    skipOrders.reduce((s, o) => s + o.price, 0) + matOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Konteineri', value: String(skipOrders.length), icon: Trash2 },
          { label: 'Materiālu pasūtījumi', value: String(matOrders.length), icon: Package },
          { label: 'Kopā iztērēts', value: fmtMoney(totalSpent), icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className="size-4" />
              {label}
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + refresh */}
      <div className="flex items-center gap-2">
        {[
          { key: 'skip', label: `Konteineri (${skipOrders.length})` },
          { key: 'material', label: `Materiāli (${matOrders.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'skip' | 'material')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : tab === 'skip' ? (
        /* Skip-hire table */
        skipOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
              <Trash2 className="h-10 w-10 text-blue-300" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-gray-800">Nav konteineru pasūtījumu</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Jums vēl nav neviena konteinera nomas pasūtījuma. Pasūtiet konteineru atkritumu
                izvešanai.
              </p>
            </div>
            <Link
              href="/dashboard/skip-hire"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Pasūtīt konteineru
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Pasūtījums</th>
                  <th className="px-4 py-3 text-left font-medium">Statuss</th>
                  <th className="px-4 py-3 text-left font-medium">Konteiners</th>
                  <th className="px-4 py-3 text-left font-medium">Atkritumu veids</th>
                  <th className="px-4 py-3 text-left font-medium">Adrese</th>
                  <th className="px-4 py-3 text-left font-medium">Piegādes datums</th>
                  <th className="px-4 py-3 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {skipOrders.map((o) => {
                  const st = SKIP_STATUS[o.status] ?? {
                    label: o.status,
                    bg: '#f3f4f6',
                    text: '#374151',
                  };
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-xs">#{o.orderNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge cfg={st} />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {SKIP_SIZE_LABEL[o.skipSize] ?? o.skipSize}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.wasteCategory.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5 text-xs">
                          <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                          <span>{o.location}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="size-3" />
                          {fmtDate(o.deliveryDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        €{o.price}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          {o.currency}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : /* Material orders table */
      matOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
            <Package className="h-10 w-10 text-blue-300" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-gray-800">Nav materiālu pasūtījumu</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Jums vēl nav neviena materiālu pasūtījuma. Apskatiet piedāvājumus un pasūtiet
              nepieciešamos materiālus.
            </p>
          </div>
          <Link
            href="/dashboard/materials"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            <Search className="h-4 w-4" />
            Meklēt materiālus
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Pasūtījums</th>
                <th className="px-4 py-3 text-left font-medium">Statuss</th>
                <th className="px-4 py-3 text-left font-medium">Materiāls</th>
                <th className="px-4 py-3 text-left font-medium">Daudzums</th>
                <th className="px-4 py-3 text-left font-medium">Piegādes adrese</th>
                <th className="px-4 py-3 text-left font-medium">Datums</th>
                <th className="px-4 py-3 text-right font-medium">Summa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {matOrders.map((o) => {
                const st = ORDER_STATUS[o.status] ?? {
                  label: o.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const item = o.items?.[0];
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-xs">#{o.orderNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge cfg={st} />
                    </td>
                    <td className="px-4 py-3 font-medium">{item?.material?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {item ? `${item.quantity} ${item.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{o.deliveryAddress || o.deliveryCity || '—'}</span>
                      </div>
                      {/* Driver contact when in transit */}
                      {(() => {
                        const driver = o.transportJobs?.find(
                          (j) =>
                            j.status === 'EN_ROUTE_DELIVERY' ||
                            j.status === 'AT_DELIVERY' ||
                            j.status === 'LOADED',
                        )?.driver;
                        if (!driver) return null;
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <User className="size-3 text-blue-500 shrink-0" />
                            <span className="text-xs text-blue-700 font-medium">
                              {driver.firstName} {driver.lastName}
                            </span>
                            {driver.phone && (
                              <a
                                href={`tel:${driver.phone}`}
                                className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                <Phone className="size-3" />
                                Zvanīt
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtDate(o.deliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {fmtMoney(o.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td colSpan={6} className="px-4 py-2 text-muted-foreground">
                  {matOrders.length} pasūtījumi
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {fmtMoney(matOrders.reduce((s, o) => s + o.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.push('/');
  }, [token, router]);

  if (!token || !user) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  const isCarrier = user.canTransport || user.userType === 'CARRIER';
  const isSupplier = user.canSell || user.userType === 'SUPPLIER';

  const title = isCarrier ? 'Mani Darbi' : isSupplier ? 'Ienākošie Pasūtījumi' : 'Mani Pasūtījumi';

  const subtitle = isCarrier
    ? 'Visi transporta darbi — aktīvie, pabeigti, tonnas tranzītā'
    : isSupplier
      ? 'Pilna pārredzamība — pircēji, materiāli, piegādes datumi, kontakti'
      : 'Jūsu konteineru un materiālu pasūtījumi reāllaikā';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="size-6 text-red-600" />
            {title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        </div>
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
