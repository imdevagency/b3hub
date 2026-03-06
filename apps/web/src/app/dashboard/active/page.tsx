'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getMyActiveTransportJob,
  updateTransportJobStatus,
  submitDeliveryProof,
  type ApiTransportJob,
} from '@/lib/api';
import {
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  CheckCircle,
  Truck,
  ArrowRight,
  Map,
  ExternalLink,
  ClipboardCheck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Status progression (mirrors mobile active.tsx) ────────────────────────────

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

// ── Static map via Google Maps Embed ─────────────────────────────────────────

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
          title="Maršruts"
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

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ currentStatus }: { currentStatus: JobStatus }) {
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

// ── Google Maps deep link ─────────────────────────────────────────────────────

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ActiveJobPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Delivery proof modal state
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofRecipient, setProofRecipient] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const fetchJob = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getMyActiveTransportJob(token);
      setJob(data);
    } catch (e) {
      console.error('Failed to load active job', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchJob();
  }, [isLoading, token, fetchJob]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJob();
    setRefreshing(false);
  };

  const handleAdvance = async () => {
    if (!token || !job) return;
    const current = job.status as JobStatus;
    // For AT_DELIVERY → DELIVERED, open proof modal instead
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
    if (!token || !job) return;
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
      {/* Delivery Proof Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
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

            {/* Body */}
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

            {/* Footer */}
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
          <h1 className="text-2xl font-bold tracking-tight">Aktīvais darbs</h1>
          {job && (
            <p className="text-sm text-muted-foreground mt-0.5">
              #{job.jobNumber} · {job.cargoType} {job.cargoWeight ?? 0} t
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atjaunot
        </Button>
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
          <Button
            className="bg-red-600 hover:bg-red-700 text-white mt-2"
            onClick={() => router.push('/dashboard/jobs')}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Atvērt darbu sarakstu
          </Button>
        </div>
      )}

      {job &&
        (() => {
          const currentStatus = job.status as JobStatus;
          const nextStatus = NEXT_STATUS[currentStatus];
          const currentIndex = STATUS_STEPS.indexOf(currentStatus);
          const isHeadingToPickup =
            currentStatus === 'ACCEPTED' || currentStatus === 'EN_ROUTE_PICKUP';
          const navLat = isHeadingToPickup ? job.pickupLat : job.deliveryLat;
          const navLng = isHeadingToPickup ? job.pickupLng : job.deliveryLng;

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
                <ProgressBar currentStatus={currentStatus} />
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
                    {navLat != null && navLng != null && isHeadingToPickup && (
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
                    {job.pickupWindow && (
                      <a
                        href={`tel:${job.pickupWindow}`}
                        className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Zvanīt
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
                    {!isHeadingToPickup && navLat != null && navLng != null && (
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
                    {job.deliveryWindow && (
                      <a
                        href={`tel:${job.deliveryWindow}`}
                        className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Zvanīt
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

              {/* Action buttons */}
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
