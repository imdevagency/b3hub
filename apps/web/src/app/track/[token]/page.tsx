'use client';

/**
 * Public order tracking page — /track/[token]
 * No authentication required. Refreshes every 10 seconds.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  fetchTrackingData,
  type TrackingData,
  type TrackingTransportJob,
} from '@/lib/api/tracking';
import TrackingMap from '@/components/tracking/TrackingMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Package, Truck, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 10_000;

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Notiek iekraušana',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const ORDER_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  DELIVERED: 'default',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
};

const JOB_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Meklē vadītāju',
  PENDING: 'Meklē vadītāju',
  OFFERED: 'Piedāvājums nosūtīts vadītājam',
  ASSIGNED: 'Vadītājs piešķirts',
  ACCEPTED: 'Vadītājs apstiprināts',
  EN_ROUTE_PICKUP: 'Ceļā uz iekraušanas vietu',
  AT_PICKUP: 'Notiek iekraušana',
  LOADED: 'Iekrauts — ceļā pie jums',
  EN_ROUTE_DELIVERY: 'Ceļā uz piegādes vietu',
  AT_DELIVERY: 'Ieradies piegādes vietā',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
  NO_SHOW: 'Vadītājs neieradās',
};

// Statuses where the truck is physically moving and GPS tracking is meaningful
const TRACKABLE_STATUSES = new Set([
  'EN_ROUTE_PICKUP',
  'AT_PICKUP',
  'LOADED',
  'EN_ROUTE_DELIVERY',
  'AT_DELIVERY',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('lv-LV', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TransportJobCard({ job }: { job: TrackingTransportJob }) {
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? job.status;
  const isDelivered = job.status === 'DELIVERED';
  const isCancelled = job.status === 'CANCELLED' || job.status === 'NO_SHOW';

  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isDelivered ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : isCancelled ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Truck className="h-4 w-4 text-blue-500" />
            )}
            <span className="text-sm font-medium">{statusLabel}</span>
          </div>
          {job.truckIndex != null && (
            <span className="text-xs text-muted-foreground">Kravas auto #{job.truckIndex}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>
            {job.pickupCity} → {job.deliveryCity}
          </span>
        </div>

        {(job.driver || job.carrier) && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Truck className="h-3.5 w-3.5 shrink-0" />
            <span>
              {job.driver?.firstName ?? 'Vadītājs'}
              {job.carrier ? ` · ${job.carrier.name}` : ''}
            </span>
          </div>
        )}

        {job.estimatedArrival && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Paredzamais ierašanās laiks: {formatDate(job.estimatedArrival)}</span>
          </div>
        )}

        {job.currentLocation && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            GPS izsekošana aktīva
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchTrackingData(token);
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg === 'not_found' ? 'not_found' : 'fetch_error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // First job in an active/trackable status drives the map; fall back to any first job
  const mapJob =
    data?.transportJobs.find((j) => TRACKABLE_STATUSES.has(j.status)) ?? data?.transportJobs[0];
  const showMap = !!mapJob && TRACKABLE_STATUSES.has(mapJob.status);

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">B3Hub</span>
          <span className="text-muted-foreground">· Piegādes izsekošana</span>
        </div>

        {/* Content */}
        {loading && <LoadingSkeleton />}

        {!loading && error === 'not_found' && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium">Izsekošanas saite nav atrasta</p>
              <p className="text-sm text-muted-foreground">
                Šī saite var būt beigusi derīguma termiņu vai ir nederīga.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && error === 'fetch_error' && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="font-medium">Neizdevās ielādēt izsekošanas datus</p>
              <p className="text-sm text-muted-foreground">
                Pārbaudiet interneta savienojumu — mēģina atkārtoti.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && data && (
          <>
            {/* Order summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">Pasūtījums #{data.orderNumber}</CardTitle>
                  <Badge variant={ORDER_STATUS_VARIANT[data.status] ?? 'secondary'}>
                    {ORDER_STATUS_LABELS[data.status] ?? data.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {data.deliveryAddress}, {data.deliveryCity}
                  </span>
                </div>
                {data.deliveryDate && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Piegāde: {formatDateOnly(data.deliveryDate)}
                      {data.deliveryWindow ? ` · ${data.deliveryWindow}` : ''}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live map — shown while driver is en-route */}
            {showMap && mapJob && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Tiešraides karte
                </h2>
                <TrackingMap
                  pickupLat={mapJob.pickupLat ?? null}
                  pickupLng={mapJob.pickupLng ?? null}
                  pickupAddress={mapJob.pickupCity}
                  deliveryLat={data.deliveryLat ?? mapJob.deliveryLat ?? null}
                  deliveryLng={data.deliveryLng ?? mapJob.deliveryLng ?? null}
                  deliveryAddress={data.deliveryAddress}
                  truckPos={mapJob.currentLocation}
                  isLive={!!mapJob.currentLocation}
                />
              </div>
            )}

            {/* Cargo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Krava</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {data.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.material.name}</span>
                    <span className="text-muted-foreground">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Transport jobs */}
            {data.transportJobs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Transports
                </h2>
                {data.transportJobs.map((job) => (
                  <TransportJobCard key={job.id} job={job} />
                ))}
              </div>
            )}

            {/* Last updated */}
            {lastUpdated && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
                <RefreshCw className="h-3 w-3" />
                Atjaunots {lastUpdated.toLocaleTimeString('lv-LV')} · atsvaidzina ik 10s
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
