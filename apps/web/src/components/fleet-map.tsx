/**
 * FleetMap component.
 * Leaflet map showing all active carrier vehicle positions for the fleet manager.
 * When liveLocations is provided, active trucks are shown at their real GPS position
 * instead of the static pickup/delivery coords.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { useRouter } from 'next/navigation';
import { type ApiTransportJob } from '@/lib/api';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

const GOOGLE_KEY = getGoogleMapsPublicKey();

// Pin color by status
const STATUS_PIN: Record<string, string> = {
  AVAILABLE: '#f59e0b', // amber
  ASSIGNED: '#6366f1', // indigo
  ACCEPTED: '#3b82f6', // blue
  EN_ROUTE_PICKUP: '#f97316', // orange
  AT_PICKUP: '#ec4899', // pink
  LOADED: '#8b5cf6', // violet
  EN_ROUTE_DELIVERY: '#22c55e', // green
  AT_DELIVERY: '#10b981', // emerald
  DELIVERED: '#94a3b8', // slate
  CANCELLED: '#ef4444', // red
};

const STATUS_LV: Record<string, string> = {
  AVAILABLE: 'Nepiešķirts',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Pieņemts',
  EN_ROUTE_PICKUP: 'Brauc uz iekr.',
  AT_PICKUP: 'Iekraušanā',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Ceļā uz pieg.',
  AT_DELIVERY: 'Izkraušanā',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

// Determine which coordinate to show for a job (truck's likely current position)
function jobCoord(job: ApiTransportJob): { lat: number; lng: number } | null {
  const enRouteDelivery =
    job.status === 'EN_ROUTE_DELIVERY' ||
    job.status === 'AT_DELIVERY' ||
    job.status === 'DELIVERED';

  if (enRouteDelivery && job.deliveryLat && job.deliveryLng) {
    return { lat: job.deliveryLat, lng: job.deliveryLng };
  }
  if (job.pickupLat && job.pickupLng) {
    return { lat: job.pickupLat, lng: job.pickupLng };
  }
  if (job.deliveryLat && job.deliveryLng) {
    return { lat: job.deliveryLat, lng: job.deliveryLng };
  }
  return null;
}

interface FleetMapProps {
  jobs: ApiTransportJob[];
  /** Live GPS positions keyed by job ID, polled from /transport-jobs/:id/location */
  liveLocations?: Record<string, { lat: number; lng: number }>;
}

export function FleetMap({ jobs, liveLocations = {} }: FleetMapProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<ApiTransportJob | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: 'b3hub-google-maps',
    googleMapsApiKey: GOOGLE_KEY,
  });

  const mappable = useMemo(
    () =>
      jobs
        .map((j) => {
          const live = liveLocations[j.id];
          const coord = live ?? jobCoord(j);
          return { job: j, coord, isLive: !!live };
        })
        .filter((x) => x.coord !== null) as {
        job: ApiTransportJob;
        coord: { lat: number; lng: number };
        isLive: boolean;
      }[],
    [jobs, liveLocations],
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-96">
        <p className="text-sm text-muted-foreground">
          Google Maps API atslēga nav konfigurēta (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>)
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-96">
        <p className="text-sm text-muted-foreground">Karte tiek ielādēta...</p>
      </div>
    );
  }

  if (mappable.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-96">
        <p className="text-sm text-muted-foreground">Nav darbu ar koordinātām kartē</p>
      </div>
    );
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-200"
      style={{ height: 520 }}
    >
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={{ lat: 56.95, lng: 24.1 }}
        zoom={6}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        onClick={() => setSelected(null)}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {mappable.map(({ job, coord, isLive }) => (
          <MarkerF
            key={job.id}
            position={coord}
            onClick={(e) => {
              e.domEvent?.stopPropagation();
              setSelected(job);
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: STATUS_PIN[job.status] ?? '#64748b',
              fillOpacity: 1,
              strokeColor: isLive ? '#ffffff' : '#94a3b8',
              strokeWeight: isLive ? 3 : 2,
              scale: isLive ? 10 : 8,
            }}
            title={`${job.jobNumber} · ${STATUS_LV[job.status] ?? job.status}${isLive ? ' · 🟢 Live' : ''}`}
          >
            <span />
          </MarkerF>
        ))}

        {selected &&
          (() => {
            const coord = jobCoord(selected);
            if (!coord) return null;
            return (
              <InfoWindowF
                position={coord}
                onCloseClick={() => setSelected(null)}
                options={{ maxWidth: 240 }}
              >
                <div className="p-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_PIN[selected.status] ?? '#64748b' }}
                    />
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {selected.jobNumber}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600">
                    {STATUS_LV[selected.status] ?? selected.status}
                  </p>
                  <p className="text-xs text-slate-500 leading-snug">
                    {selected.pickupCity} → {selected.deliveryCity}
                  </p>
                  {selected.driver && (
                    <p className="text-xs text-slate-500">
                      🧑 {selected.driver.firstName} {selected.driver.lastName}
                    </p>
                  )}
                  {selected.cargoWeight && (
                    <p className="text-xs text-slate-500">📦 {selected.cargoWeight} t</p>
                  )}
                  <button
                    onClick={() => router.push(`/dashboard/orders/${selected.id}`)}
                    className="mt-1 w-full rounded-md bg-primary text-primary-foreground text-xs font-semibold py-1.5 hover:bg-primary/90 transition-colors"
                  >
                    Skatīt Detaļas →
                  </button>
                </div>
              </InfoWindowF>
            );
          })()}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Statuss
        </p>
        <div className="space-y-1">
          {(['EN_ROUTE_PICKUP', 'EN_ROUTE_DELIVERY', 'AT_PICKUP', 'AT_DELIVERY'] as const).map(
            (s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_PIN[s] }}
                />
                <span className="text-[10px] text-slate-600">{STATUS_LV[s]}</span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Job count badge + live indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {Object.keys(liveLocations).length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-full border border-emerald-200 px-3 py-1 shadow-sm flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-xs font-semibold text-emerald-700">
              {Object.keys(liveLocations).length} live
            </p>
          </div>
        )}
        <div className="bg-white/90 backdrop-blur-sm rounded-full border border-slate-200 px-3 py-1 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">{mappable.length} darbi kartē</p>
        </div>
      </div>
    </div>
  );
}
