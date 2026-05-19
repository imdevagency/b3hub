/**
 * Transport job detail page — /dashboard/transport-jobs/[id]
 * Used by carriers (fleet managers) to view transport job details and live tracking.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getTransportJob, type ApiTransportJob, type TransportJobStatus } from '@/lib/api';
import { useJobTracking } from '@/lib/use-job-tracking';
import { fmtDate } from '@/lib/format';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Clock, MessageSquare, Truck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/page-spinner';

const TrackingMap = dynamic(() => import('@/components/tracking/TrackingMap'), {
  ssr: false,
  loading: () => <div className="rounded-2xl bg-slate-100 animate-pulse" style={{ height: 360 }} />,
});

// ── Status timeline ────────────────────────────────────────────────────────────

interface StatusStep {
  status: TransportJobStatus;
  label: string;
  description: string;
}

const STATUS_STEPS: StatusStep[] = [
  { status: 'ACCEPTED', label: 'Pieņemts', description: 'Vadītājs pieņēmis pasūtījumu' },
  {
    status: 'EN_ROUTE_PICKUP',
    label: 'Brauc uz iekraušanu',
    description: 'Transportlīdzeklis dodas uz iekraušanas vietu',
  },
  { status: 'AT_PICKUP', label: 'Iekraušanas vietā', description: 'Transportlīdzeklis ieradies' },
  { status: 'LOADED', label: 'Iekrauts', description: 'Krava iekrauta, gatavs piegādei' },
  {
    status: 'EN_ROUTE_DELIVERY',
    label: 'Piegādē',
    description: 'Transportlīdzeklis dodas uz piegādes vietu',
  },
  { status: 'AT_DELIVERY', label: 'Piegādes vietā', description: 'Transportlīdzeklis ieradies' },
  {
    status: 'DELIVERED',
    label: 'Piegādāts',
    description: 'Krava piegādāta. Pasūtījums pabeigts!',
  },
];

const STATUS_ORDER: TransportJobStatus[] = [
  'AVAILABLE',
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
];

function statusIndex(s: TransportJobStatus) {
  return STATUS_ORDER.indexOf(s);
}

const STATUS_CFG: Record<TransportJobStatus, { label: string; bg: string; text: string }> = {
  AVAILABLE: { label: 'Pieejams', bg: '#f0fdf4', text: '#166534' },
  ASSIGNED: { label: 'Piešķirts', bg: '#e0e7ff', text: '#4338ca' },
  ACCEPTED: { label: 'Pieņemts', bg: '#dbeafe', text: '#1d4ed8' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz iek.', bg: '#fef3c7', text: '#b45309' },
  AT_PICKUP: { label: 'Uz iekr. vietu', bg: '#fce7f3', text: '#be185d' },
  LOADED: { label: 'Iekrauts', bg: '#e0e7ff', text: '#4338ca' },
  EN_ROUTE_DELIVERY: { label: 'Piegādē', bg: '#fef3c7', text: '#b45309' },
  AT_DELIVERY: { label: 'Atvedis', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
  DELIVERY_REFUSED: { label: 'Piegāde atteikta', bg: '#fef2f2', text: '#991b1b' },
};

const CARGO_LABELS: Record<string, string> = {
  BULK_MATERIAL: 'Birstošais materiāls',
  CONSTRUCTION_WASTE: 'Celtniecības atkritumi',
  SKIP_HIRE: 'Konteinera piegāde',
  EQUIPMENT: 'Tehnika',
  GENERAL: 'Vispārīga krava',
};

const VEHICLE_LABELS: Record<string, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  HOOK_LIFT: 'Hāku pacēlājs',
  SKIP_LOADER: 'Konteinera auto',
  SEMI_TRAILER: 'Puspiekabe',
  TANKER: 'Cisterna',
  VAN: 'Furgons',
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' });
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TransportJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time location via WebSocket (replaces 10s poll)
  const {
    truckPos: livePos,
    liveStatus,
    connected: wsConnected,
  } = useJobTracking({ jobId: id, token });
  const truckPos = livePos ? { lat: livePos.lat, lng: livePos.lng } : null;

  const loadJob = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const data = await getTransportJob(id, token);
      setJob(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda ielādējot darbu');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  if (loading) return <PageSpinner className="min-h-[60vh]" />;

  if (error || !job) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="mb-4">{error ?? 'Darbs nav atrasts'}</p>
        <Button variant="link" onClick={() => router.back()} className="text-sm">
          ← Atpakaļ
        </Button>
      </div>
    );
  }

  const currentIdx = statusIndex(job.status);
  const activeStatus = (liveStatus as TransportJobStatus) ?? job.status;
  const isLive =
    (activeStatus === 'EN_ROUTE_PICKUP' || activeStatus === 'EN_ROUTE_DELIVERY') && wsConnected;
  const statusCfg = STATUS_CFG[job.status] ?? { label: job.status, bg: '#f1f5f9', text: '#475569' };

  return (
    <div className="w-full max-w-350 mx-auto p-4 lg:p-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0 bg-slate-100 hover:bg-slate-200 border border-slate-200"
          >
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">#{job.jobNumber}</h1>
              <span
                style={{ backgroundColor: statusCfg.bg, color: statusCfg.text }}
                className="inline-block rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              >
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              {CARGO_LABELS[job.cargoType] ?? job.cargoType}
              {job.cargoWeight ? ` · ${job.cargoWeight} t` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="shadow-sm border-slate-200 font-semibold" asChild>
            <Link href={`/dashboard/chat/${job.id}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Sarakste
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* ── Left Column: Details ── */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Route Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                Maršruts
              </h2>
              <div className="relative">
                <div className="absolute left-2.5 top-3 bottom-4 w-0.5 bg-slate-200" />

                <div className="flex gap-4 relative z-10 mb-6">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-slate-900 ring-4 ring-white flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Iekraušana
                    </p>
                    <p className="text-base font-semibold text-slate-900 mt-0.5">
                      {job.pickupCity}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">{job.pickupAddress}</p>
                    <div className="flex items-center gap-1.5 mt-2 bg-slate-50 w-fit px-2 py-1 rounded-md border border-slate-100">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">
                        {fmtDate(job.pickupDate)}
                        {job.pickupWindow && ` · ${job.pickupWindow}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 relative z-10">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Piegāde
                    </p>
                    <p className="text-base font-semibold text-slate-900 mt-0.5">
                      {job.deliveryCity}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">{job.deliveryAddress}</p>
                    <div className="flex items-center gap-1.5 mt-2 bg-slate-50 w-fit px-2 py-1 rounded-md border border-slate-100">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs font-medium text-slate-700">
                        {fmtDate(job.deliveryDate)}
                        {job.deliveryWindow && ` · ${job.deliveryWindow}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Driver */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-4">
              <div className="h-10 w-10 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Vadītājs
                </p>
                {job.driver ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {job.driver.firstName} {job.driver.lastName}
                    </p>
                    {job.driver.phone && (
                      <a
                        href={`tel:${job.driver.phone}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 truncate mt-0.5 inline-block"
                      >
                        {job.driver.phone}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-medium text-slate-500">Nav piesaistīts</p>
                )}
              </div>
            </div>

            {/* Vehicle */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-4">
              <div className="h-10 w-10 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Auto
                </p>
                {job.vehicle ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {job.vehicle.licensePlate}
                    </p>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                      {VEHICLE_LABELS[job.vehicle.vehicleType] ?? job.vehicle.vehicleType}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-slate-500">Nav piesaistīts</p>
                )}
              </div>
            </div>

            {/* Cargo specifics */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                Kravas Detaļas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Pasūtījums
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {job.order?.orderNumber ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Svars
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {job.cargoWeight ? `${job.cargoWeight} t` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Attālums
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {job.distanceKm ? `${job.distanceKm} km` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Likme
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {job.rate && job.currency
                      ? job.rate.toLocaleString('lv-LV', {
                          style: 'currency',
                          currency: job.currency,
                        })
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:col-span-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-5">
                Izpildes Gaita
              </h2>
              <div className="space-y-0">
                {STATUS_STEPS.map((step, i) => {
                  const stepIdx = statusIndex(step.status);
                  const done = stepIdx < currentIdx;
                  const active = stepIdx === currentIdx;
                  const upcoming = stepIdx > currentIdx;

                  return (
                    <div key={step.status} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div
                          className={[
                            'flex items-center justify-center w-6 h-6 rounded-full shrink-0 border-2 transition-all',
                            done ? 'bg-slate-900 border-slate-900 text-white' : '',
                            active ? 'bg-white border-blue-600 ring-4 ring-blue-50' : '',
                            upcoming ? 'bg-white border-slate-200' : '',
                          ].join(' ')}
                        >
                          {done && <CheckCircle2 className="h-3 w-3" />}
                          {active && <div className="h-2 w-2 rounded-full bg-blue-600" />}
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div
                            className={[
                              'w-0.5 flex-1 my-1',
                              done ? 'bg-slate-900' : 'bg-slate-100',
                            ].join(' ')}
                            style={{ minHeight: 24 }}
                          />
                        )}
                      </div>
                      <div className="pb-5 pt-0.5">
                        <p
                          className={[
                            'text-sm font-bold',
                            done || active ? 'text-slate-900' : 'text-slate-400',
                          ].join(' ')}
                        >
                          {step.label}
                        </p>
                        {(done || active) && (
                          <p className="text-[13px] font-medium text-slate-500 mt-0.5 leading-snug">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Map ── */}
        <div className="w-full lg:w-120 xl:w-150 shrink-0">
          <div className="lg:sticky lg:top-6 bg-slate-100 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-100 lg:h-[calc(100vh-120px)] min-h-125">
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                  {wsConnected && isLive && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${wsConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  ></span>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  {wsConnected ? 'Live Karte' : 'Karte (Bezsaistē)'}
                </p>
              </div>
              {livePos?.estimatedArrivalMin != null && (
                <p className="text-xs font-medium text-slate-500">
                  PTA:{' '}
                  <span className="font-bold text-slate-900">
                    ~{livePos.estimatedArrivalMin} min
                  </span>
                </p>
              )}
            </div>
            <div className="flex-1 relative z-0">
              <TrackingMap
                token={token ?? undefined}
                pickupLat={job.pickupLat}
                pickupLng={job.pickupLng}
                pickupAddress={job.pickupAddress}
                deliveryLat={job.deliveryLat}
                deliveryLng={job.deliveryLng}
                deliveryAddress={job.deliveryAddress}
                truckPos={truckPos}
                isLive={isLive}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
