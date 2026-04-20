'use client';

/**
 * Public order tracking page — /track/[token]
 * No authentication required. Refreshes every 30 seconds.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  fetchTrackingData,
  type TrackingData,
  type TrackingTransportJob,
} from '@/lib/api/tracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Package, Truck, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Awaiting Confirmation',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
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
  PENDING: 'Searching for driver',
  OFFERED: 'Offer sent to driver',
  ACCEPTED: 'Driver assigned',
  EN_ROUTE_PICKUP: 'En route to pickup',
  ARRIVED_PICKUP: 'Arrived at pickup',
  LOADED: 'Loaded — en route to you',
  EN_ROUTE_DELIVERY: 'On the way',
  ARRIVED_DELIVERY: 'Arrived at delivery site',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Driver no-show',
};

const JOB_STATUS_ICON: Record<string, React.ReactNode> = {
  DELIVERED: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  CANCELLED: <AlertCircle className="h-4 w-4 text-red-500" />,
  NO_SHOW: <AlertCircle className="h-4 w-4 text-red-500" />,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TransportJobCard({ job }: { job: TrackingTransportJob }) {
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? job.status;
  const statusIcon = JOB_STATUS_ICON[job.status] ?? <Truck className="h-4 w-4 text-blue-500" />;

  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-sm font-medium">{statusLabel}</span>
          </div>
          {job.truckIndex != null && (
            <span className="text-xs text-muted-foreground">Truck #{job.truckIndex}</span>
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
              {job.driver?.firstName ?? 'Driver'}
              {job.carrier ? ` · ${job.carrier.name}` : ''}
            </span>
          </div>
        )}

        {job.estimatedArrival && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>ETA: {formatDate(job.estimatedArrival)}</span>
          </div>
        )}

        {job.currentLocation && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live GPS active
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
      <Skeleton className="h-32 w-full" />
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

  // ── Render states ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">B3Hub</span>
          <span className="text-muted-foreground">· Live Order Tracking</span>
        </div>

        {/* Content */}
        {loading && <LoadingSkeleton />}

        {!loading && error === 'not_found' && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium">Tracking link not found</p>
              <p className="text-sm text-muted-foreground">
                This link may have expired or is invalid.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && error === 'fetch_error' && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="font-medium">Could not load tracking data</p>
              <p className="text-sm text-muted-foreground">
                Check your connection — retrying automatically.
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
                  <CardTitle className="text-base">Order #{data.orderNumber}</CardTitle>
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
                      Delivery: {formatDateOnly(data.deliveryDate)}
                      {data.deliveryWindow ? ` · ${data.deliveryWindow}` : ''}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cargo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cargo</CardTitle>
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
                  Transport
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
                Updated {lastUpdated.toLocaleTimeString()} · refreshes every 30s
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
