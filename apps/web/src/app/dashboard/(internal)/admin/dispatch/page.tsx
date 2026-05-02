/**
 * Admin Live Dispatcher — /dashboard/admin/dispatch
 *
 * Real-time fleet map view showing:
 *  - Google Map with all active transport jobs plotted by GPS coordinates
 *  - Live driver markers (larger + white-stroked when isOnline + has GPS)
 *  - Right panel: fleet summary, online drivers list, carrier stats
 *  - Status filter chips to focus on specific job states
 *  - Auto-refresh every 30s with countdown indicator
 */
'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import Link from 'next/link';
import {
  Navigation,
  RefreshCw,
  Truck,
  Users,
  Activity,
  Building2,
  MapPin,
  Phone,
  ChevronRight,
  Loader2,
  Circle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { adminGetDispatch, type AdminDispatchData, type AdminDispatchJob } from '@/lib/api/admin';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const GOOGLE_KEY = getGoogleMapsPublicKey();
const REFRESH_INTERVAL_S = 30;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_PIN: Record<string, string> = {
  ASSIGNED: '#6366f1',
  ACCEPTED: '#3b82f6',
  EN_ROUTE_PICKUP: '#f97316',
  AT_PICKUP: '#ec4899',
  LOADED: '#8b5cf6',
  EN_ROUTE_DELIVERY: '#22c55e',
  AT_DELIVERY: '#10b981',
};

const STATUS_LV: Record<string, string> = {
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Pieņemts',
  EN_ROUTE_PICKUP: 'Brauc uz iekr.',
  AT_PICKUP: 'Iekraušanā',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Ceļā uz pieg.',
  AT_DELIVERY: 'Izkraušanā',
};

const STATUS_ORDER = Object.keys(STATUS_LV);

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'EN_ROUTE_DELIVERY' || s === 'AT_DELIVERY') return 'default';
  if (s === 'EN_ROUTE_PICKUP' || s === 'AT_PICKUP' || s === 'LOADED') return 'secondary';
  return 'outline';
}

// ─── Map helpers ──────────────────────────────────────────────────────────────

function jobCoord(job: AdminDispatchJob): { lat: number; lng: number } | null {
  const enRouteDelivery = job.status === 'EN_ROUTE_DELIVERY' || job.status === 'AT_DELIVERY';
  if (enRouteDelivery && job.deliveryLat && job.deliveryLng) {
    return { lat: job.deliveryLat, lng: job.deliveryLng };
  }
  if (job.pickupLat && job.pickupLng) return { lat: job.pickupLat, lng: job.pickupLng };
  if (job.deliveryLat && job.deliveryLng) return { lat: job.deliveryLat, lng: job.deliveryLng };
  return null;
}

// ─── Dispatch Map ─────────────────────────────────────────────────────────────

interface DispatchMapProps {
  jobs: AdminDispatchJob[];
  activeStatuses: Set<string>;
  onSelectJob: (job: AdminDispatchJob | null) => void;
  selectedJobId: string | null;
}

function DispatchMap({ jobs, activeStatuses, onSelectJob, selectedJobId }: DispatchMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: 'b3hub-google-maps',
    googleMapsApiKey: GOOGLE_KEY ?? '',
  });

  const filteredJobs = useMemo(
    () => (activeStatuses.size === 0 ? jobs : jobs.filter((j) => activeStatuses.has(j.status))),
    [jobs, activeStatuses],
  );

  const mappable = useMemo(
    () =>
      filteredJobs
        .map((job) => {
          // Prefer live GPS from driver profile
          const loc = job.driver?.driverProfile?.currentLocation;
          const liveCoord =
            loc && typeof loc === 'object' && 'lat' in loc && 'lng' in loc
              ? (loc as { lat: number; lng: number })
              : null;
          const coord = liveCoord ?? jobCoord(job);
          return { job, coord, isLive: !!liveCoord };
        })
        .filter((x) => x.coord !== null) as {
        job: AdminDispatchJob;
        coord: { lat: number; lng: number };
        isLive: boolean;
      }[],
    [filteredJobs],
  );

  const selectedJob = useMemo(
    () => mappable.find((m) => m.job.id === selectedJobId) ?? null,
    [mappable, selectedJobId],
  );

  // Auto-fit bounds when jobs change
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mappable.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    mappable.forEach(({ coord }) => bounds.extend(coord));
    mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, mappable]);

  if (!GOOGLE_KEY) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border">
        <p className="text-sm text-muted-foreground">Google Maps API atslēga nav konfigurēta</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Karte tiek ielādēta...</span>
      </div>
    );
  }

  if (mappable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/30 rounded-lg border gap-2">
        <MapPin className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nav aktīvo darbu ar koordinātām</p>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={{ lat: 56.95, lng: 24.1 }}
      zoom={7}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      onUnmount={() => {
        mapRef.current = null;
      }}
      onClick={() => onSelectJob(null)}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        zoomControlOptions: { position: 7 /* RIGHT_CENTER */ },
      }}
    >
      {mappable.map(({ job, coord, isLive }) => (
        <MarkerF
          key={job.id}
          position={coord}
          onClick={(e) => {
            e.domEvent?.stopPropagation();
            onSelectJob(job);
          }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: STATUS_PIN[job.status] ?? '#64748b',
            fillOpacity: 1,
            strokeColor: isLive ? '#ffffff' : '#94a3b8',
            strokeWeight: isLive ? 3 : 2,
            scale: job.id === selectedJobId ? 14 : isLive ? 11 : 8,
          }}
          title={`${job.jobNumber} · ${STATUS_LV[job.status] ?? job.status}${isLive ? ' · Live GPS' : ''}`}
        >
          <span />
        </MarkerF>
      ))}

      {selectedJob &&
        (() => {
          const { job, coord, isLive } = selectedJob;
          return (
            <InfoWindowF
              position={coord}
              onCloseClick={() => onSelectJob(null)}
              options={{ maxWidth: 260 }}
            >
              <div className="p-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_PIN[job.status] ?? '#64748b' }}
                  />
                  <span className="font-bold text-slate-800 text-sm">{job.jobNumber}</span>
                  {isLive && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                      Live GPS
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  {STATUS_LV[job.status] ?? job.status}
                </p>
                <p className="text-xs text-slate-500">
                  {job.pickupCity} → {job.deliveryCity}
                </p>
                {job.driver && (
                  <p className="text-xs text-slate-500">
                    {job.driver.firstName} {job.driver.lastName}
                    {job.driver.phone && ` · ${job.driver.phone}`}
                  </p>
                )}
                {job.carrier && <p className="text-xs text-slate-400">{job.carrier.name}</p>}
                {job.cargoWeight && (
                  <p className="text-xs text-slate-400">
                    {job.cargoWeight} t · {job.cargoType}
                  </p>
                )}
                <a
                  href={`/dashboard/admin/jobs/${job.id}`}
                  className="block text-xs text-blue-600 hover:underline font-medium"
                >
                  Skatīt darbu →
                </a>
              </div>
            </InfoWindowF>
          );
        })()}
    </GoogleMap>
  );
}

// ─── Status Legend ────────────────────────────────────────────────────────────

function StatusLegend({
  counts,
  active,
  onToggle,
}: {
  counts: Record<string, number>;
  active: Set<string>;
  onToggle: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_ORDER.map((s) => {
        const count = counts[s] ?? 0;
        const isActive = active.size === 0 || active.has(s);
        return (
          <button
            key={s}
            onClick={() => onToggle(s)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
              ${isActive ? 'border-transparent text-white shadow-sm' : 'border-border bg-card text-muted-foreground opacity-60'}`}
            style={isActive ? { backgroundColor: STATUS_PIN[s] } : {}}
          >
            <span>{STATUS_LV[s]}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs leading-none
                ${isActive ? 'bg-white/25' : 'bg-muted'}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function FleetPanel({
  data,
  onSelectJob,
  selectedJobId,
}: {
  data: AdminDispatchData;
  onSelectJob: (job: AdminDispatchJob) => void;
  selectedJobId: string | null;
}) {
  const { summary, onlineDrivers, carriers, jobs } = data;

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 shrink-0">
        <Card className="py-3">
          <CardContent className="p-0 text-center">
            <p className="text-xl font-bold text-foreground">{summary.totalActiveJobs}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Aktīvi darbi</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-0 text-center">
            <p className="text-xl font-bold text-green-600">{summary.totalOnlineDrivers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Online vadītāji</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-0 text-center">
            <p className="text-xl font-bold text-foreground">{summary.totalCarriers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pārvadātāji</p>
          </CardContent>
        </Card>
      </div>

      {/* Online Drivers */}
      <Card className="flex flex-col flex-1 min-h-0">
        <CardHeader className="pb-2 pt-3 px-3 shrink-0">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Online vadītāji ({onlineDrivers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0">
          <div className="h-full overflow-y-auto px-3 pb-3">
            {onlineDrivers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nav online vadītāju</p>
            ) : (
              <div className="space-y-2">
                {onlineDrivers.map((d) => {
                  // Find the active job for this driver
                  const activeJob = jobs.find((j) => j.driver?.id === d.user.id);
                  return (
                    <div
                      key={d.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors
                        ${activeJob?.id === selectedJobId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                      onClick={() => activeJob && onSelectJob(activeJob)}
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                          {d.user.firstName[0]}
                          {d.user.lastName[0]}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {d.user.firstName} {d.user.lastName}
                        </p>
                        {d.user.company && (
                          <p className="text-xs text-muted-foreground truncate">
                            {d.user.company.name}
                          </p>
                        )}
                        {activeJob ? (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            {activeJob.jobNumber} ·{' '}
                            {STATUS_LV[activeJob.status] ?? activeJob.status}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Brīvs</p>
                        )}
                        {d.rating !== null && (
                          <p className="text-xs text-amber-600">★ {d.rating.toFixed(1)}</p>
                        )}
                      </div>
                      {d.user.phone && (
                        <a
                          href={`tel:${d.user.phone}`}
                          className="shrink-0 p-1 hover:bg-muted rounded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Carrier breakdown */}
      {carriers.length > 0 && (
        <Card className="shrink-0">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Pārvadātāji
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <div className="space-y-1 px-3">
              {carriers.slice(0, 8).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/admin/companies/${c.id}`}
                      className="font-medium text-foreground hover:text-primary truncate block"
                    >
                      {c.name}
                    </Link>
                    <span className="text-muted-foreground">{c.city}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {c.onlineDrivers > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600">
                        <Users className="h-2.5 w-2.5" />
                        {c.onlineDrivers}
                      </span>
                    )}
                    {c.activeJobs > 0 && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <Truck className="h-2.5 w-2.5" />
                        {c.activeJobs}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function DispatchContent() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminDispatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_S);
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const result = await adminGetDispatch(token);
        setData(result);
      } catch {
        // silently fail on background refresh
      } finally {
        setLoading(false);
        setRefreshing(false);
        setCountdown(REFRESH_INTERVAL_S);
      }
    },
    [token],
  );

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh + countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          load(true);
          return REFRESH_INTERVAL_S;
        }
        return prev - 1;
      });
    }, 1000);
    countdownRef.current = interval;
    return () => clearInterval(interval);
  }, [load]);

  const toggleStatus = (s: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleSelectJob = (job: AdminDispatchJob | null) => {
    setSelectedJobId(job?.id ?? null);
  };

  const statusCounts = useMemo(
    () =>
      STATUS_ORDER.reduce(
        (acc, s) => {
          acc[s] = data?.jobs.filter((j) => j.status === s).length ?? 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [data],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <div className="flex gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
        <div className="flex gap-4 flex-1">
          <Skeleton className="flex-1 rounded-xl" />
          <div className="w-72 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            <Skeleton className="flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      {/* Filter chips + refresh */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <StatusLegend counts={statusCounts} active={activeStatuses} onToggle={toggleStatus} />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {countdown}s
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-7 px-2.5 gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-xs">Atjaunināt</span>
          </Button>
        </div>
      </div>

      {/* Map + panel */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 min-h-0 rounded-xl overflow-hidden border shadow-sm">
          <DispatchMap
            jobs={data.jobs}
            activeStatuses={activeStatuses}
            onSelectJob={handleSelectJob}
            selectedJobId={selectedJobId}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 overflow-hidden">
          <FleetPanel
            data={data}
            onSelectJob={(job) => setSelectedJobId(job.id)}
            selectedJobId={selectedJobId}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DispatchPage() {
  return (
    <div className="flex flex-col gap-4 h-screen max-h-screen overflow-hidden p-4">
      <PageHeader
        title="Dispečerizācija"
        description="Reāllaika flotes pārskats — aktīvie transporta darbi un online vadītāji"
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin/jobs">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Visi darbi
              </Button>
            </Link>
          </div>
        }
      />
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Ielādē dispečerizāciju...</span>
          </div>
        }
      >
        <DispatchContent />
      </Suspense>
    </div>
  );
}
