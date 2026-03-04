'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getMyActiveTransportJob, updateTransportJobStatus, type ApiTransportJob } from '@/lib/api';
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
    const next = NEXT_STATUS[job.status as JobStatus];
    if (!next) return;
    if (!confirm(`Apstiprināt: ${STATUS_LABEL[job.status as JobStatus]} → ${STATUS_LABEL[next]}?`))
      return;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                    €{job.rate.toFixed(2)}
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
