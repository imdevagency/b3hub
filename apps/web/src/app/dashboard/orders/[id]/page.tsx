'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const TrackingMap = dynamic(() => import('@/components/tracking/TrackingMap'), {
  ssr: false,
  loading: () => <div className="rounded-2xl bg-slate-100 animate-pulse" style={{ height: 360 }} />,
});
import {
  getTransportJob,
  getTransportJobLocation,
  type ApiTransportJob,
  type TransportJobLocation,
  type TransportJobStatus,
} from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Phone,
  RefreshCw,
  Truck,
  User,
} from 'lucide-react';

// ── Status timeline config ─────────────────────────────────────────────────────

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
  { status: 'DELIVERED', label: 'Piegādāts', description: 'Krava piegādāta. Pasūtījums pabeigts!' },
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' });
}

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [location, setLocation] = useState<TransportJobLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived truck position from location poll
  const truckPos = location?.currentLocation ?? null;

  // Fetch full job details once
  const loadJob = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const data = await getTransportJob(id, token);
      setJob(data);
    } catch (e: any) {
      setError(e.message ?? 'Kļūda ielādējot pasūtījumu');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  // Poll location endpoint
  const pollLocation = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await getTransportJobLocation(id, token);
      setLocation(data);
      setLastPoll(new Date());
    } catch {
      // silently ignore poll errors
    }
  }, [id, token]);

  useEffect(() => {
    loadJob();
    pollLocation();

    pollTimer.current = setInterval(pollLocation, 10_000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [loadJob, pollLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="mb-4">{error ?? 'Pasūtījums nav atrasts'}</p>
        <button onClick={() => router.back()} className="text-sm text-slate-600 underline">
          ← Atpakaļ
        </button>
      </div>
    );
  }

  const currentIdx = statusIndex(job.status);

  const isLive = job.status === 'EN_ROUTE_PICKUP' || job.status === 'EN_ROUTE_DELIVERY';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{job.jobNumber}</h1>
          <p className="text-sm text-slate-500">
            {CARGO_LABELS[job.cargoType] ?? job.cargoType}
            {job.cargoWeight ? ` · ${job.cargoWeight} t` : ''}
          </p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* ── Live Mapbox Map ── */}
      <div>
        <TrackingMap
          pickupLat={location?.pickupLat ?? job.pickupLat}
          pickupLng={location?.pickupLng ?? job.pickupLng}
          pickupAddress={job.pickupAddress}
          deliveryLat={location?.deliveryLat ?? job.deliveryLat}
          deliveryLng={location?.deliveryLng ?? job.deliveryLng}
          deliveryAddress={job.deliveryAddress}
          truckPos={truckPos}
          isLive={isLive}
        />
        {lastPoll && (
          <p className="text-xs text-slate-400 mt-1.5 text-right pr-1">
            GPS atjaunots {fmtTime(lastPoll.toISOString())} · atsvaidzina ik 10s
          </p>
        )}
      </div>

      {/* ── Status Timeline ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Statusa hronoloģija</h2>
        <div className="space-y-0">
          {STATUS_STEPS.map((step, i) => {
            const stepIdx = statusIndex(step.status);
            const done = stepIdx < currentIdx;
            const active = stepIdx === currentIdx;
            const upcoming = stepIdx > currentIdx;

            return (
              <div key={step.status} className="flex gap-3">
                {/* icon column */}
                <div className="flex flex-col items-center">
                  <div
                    className={[
                      'flex items-center justify-center w-7 h-7 rounded-full shrink-0',
                      done ? 'bg-green-100 text-green-600' : '',
                      active ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-300' : '',
                      upcoming ? 'bg-slate-100 text-slate-400' : '',
                    ].join(' ')}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : active ? (
                      <Truck className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div
                      className={['w-0.5 flex-1 my-1', done ? 'bg-green-300' : 'bg-slate-200'].join(
                        ' ',
                      )}
                      style={{ minHeight: 20 }}
                    />
                  )}
                </div>

                {/* content column */}
                <div className="pb-4 pt-0.5">
                  <p
                    className={[
                      'text-sm font-medium leading-tight',
                      done ? 'text-green-700' : '',
                      active ? 'text-blue-700' : '',
                      upcoming ? 'text-slate-400' : '',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>
                  {(done || active) && (
                    <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Route Details ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Maršruts</h2>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex flex-col items-center gap-0.5 pt-1">
              <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
              <div className="w-0.5 flex-1 bg-slate-200" style={{ minHeight: 24 }} />
            </div>
            <div className="flex-1 pb-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                Iekraušana
              </p>
              <p className="text-sm text-slate-900">{job.pickupAddress}</p>
              <p className="text-xs text-slate-500">{job.pickupCity}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                {fmtDate(job.pickupDate)}
                {job.pickupWindow && ` · ${job.pickupWindow}`}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="pt-1">
              <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Piegāde</p>
              <p className="text-sm text-slate-900">{job.deliveryAddress}</p>
              <p className="text-xs text-slate-500">{job.deliveryCity}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                {fmtDate(job.deliveryDate)}
                {job.deliveryWindow && ` · ${job.deliveryWindow}`}
              </div>
            </div>
          </div>
        </div>

        {job.distanceKm && (
          <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
            Attālums: <span className="font-medium text-slate-600">{job.distanceKm} km</span>
          </p>
        )}
      </div>

      {/* ── Driver & Vehicle ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Driver */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
          <div className="p-2 bg-slate-100 rounded-xl">
            <User className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Vadītājs</p>
            {job.driver ? (
              <>
                <p className="text-sm font-medium text-slate-900">
                  {job.driver.firstName} {job.driver.lastName}
                </p>
                {job.driver.phone && (
                  <a
                    href={`tel:${job.driver.phone}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {job.driver.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">Nav piešķirts</p>
            )}
          </div>
        </div>

        {/* Vehicle */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
          <div className="p-2 bg-slate-100 rounded-xl">
            <Truck className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Transportlīdzeklis</p>
            {job.vehicle ? (
              <>
                <p className="text-sm font-medium text-slate-900">
                  {VEHICLE_LABELS[job.vehicle.vehicleType] ?? job.vehicle.vehicleType}
                </p>
                <p className="text-xs text-slate-500">{job.vehicle.licensePlate}</p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Nav piešķirts</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Site Contact ── */}
      {(job.order?.siteContactName || job.order?.siteContactPhone) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
          <div className="p-2 bg-green-50 rounded-xl">
            <Phone className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Objekta kontaktpersona</p>
            {job.order.siteContactName && (
              <p className="text-sm font-medium text-slate-900">{job.order.siteContactName}</p>
            )}
            {job.order.siteContactPhone && (
              <a
                href={`tel:${job.order.siteContactPhone}`}
                className="text-xs text-green-600 hover:underline font-medium"
              >
                {job.order.siteContactPhone}
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Cargo summary ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Krava</h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Veids</p>
            <p className="font-medium text-slate-800">
              {CARGO_LABELS[job.cargoType] ?? job.cargoType}
            </p>
          </div>
          {job.cargoWeight && (
            <div>
              <p className="text-xs text-slate-400">Svars</p>
              <p className="font-medium text-slate-800">{job.cargoWeight} t</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400">Darba nr.</p>
            <p className="font-medium text-slate-800">{job.jobNumber}</p>
          </div>
          {job.order && (
            <div>
              <p className="text-xs text-slate-400">Pasūtījuma nr.</p>
              <p className="font-medium text-slate-800">{job.order.orderNumber}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status Badge component ─────────────────────────────────────────────────────

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
};

function StatusBadge({ status }: { status: TransportJobStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: '#f1f5f9', text: '#475569' };
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
    >
      {cfg.label}
    </span>
  );
}
