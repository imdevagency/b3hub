/**
 * FleetMap component.
 * Leaflet map showing all active carrier vehicle positions for the fleet manager.
 * When liveLocations is provided, active trucks are shown at their real GPS position
 * instead of the static pickup/delivery coords.
 */
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
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
  selectedJobId?: string | null;
  onJobSelect?: (jobId: string | null) => void;
}

export function FleetMap({ jobs, liveLocations = {}, selectedJobId, onJobSelect }: FleetMapProps) {
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

  // Auto-fit bounds or center on selected
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mappable.length === 0) return;

    if (selectedJobId) {
      const selectedJob = mappable.find((m) => m.job.id === selectedJobId);
      if (selectedJob) {
        mapRef.current.panTo(selectedJob.coord);
        mapRef.current.setZoom(14);
        return;
      }
    }

    // Fit all if nothing selected
    const bounds = new window.google.maps.LatLngBounds();
    mappable.forEach(({ coord }) => bounds.extend(coord));
    mapRef.current.fitBounds(bounds, 80);
  }, [isLoaded, mappable, selectedJobId]);

  if (!GOOGLE_KEY) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-full w-full">
        <p className="text-sm text-muted-foreground">
          Google Maps API atslēga nav konfigurēta (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>)
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-full w-full">
        <p className="text-sm text-muted-foreground">Karte tiek ielādēta...</p>
      </div>
    );
  }

  if (mappable.length === 0) {
    return (
      <div className="bg-slate-50 flex items-center justify-center h-full w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-200/50 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">Nav darbu ar koordinātām kartē</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden w-full h-full bg-slate-100">
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
        onClick={() => onJobSelect?.(null)}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {mappable.map(({ job, coord, isLive }) => {
          const isSelected = job.id === selectedJobId;
          return (
            <MarkerF
              key={job.id}
              position={coord}
              onClick={(e) => {
                e.domEvent?.stopPropagation();
                onJobSelect?.(job.id);
              }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: STATUS_PIN[job.status] ?? '#64748b',
                fillOpacity: 1,
                strokeColor: isSelected ? '#000000' : isLive ? '#ffffff' : '#94a3b8',
                strokeWeight: isSelected ? 4 : isLive ? 3 : 2,
                scale: isSelected ? 12 : isLive ? 10 : 8,
              }}
              title={`${job.jobNumber} · ${STATUS_LV[job.status] ?? job.status}${isLive ? ' · 🟢 Live' : ''}`}
            />
          );
        })}

        {selectedJobId &&
          mappable.find((m) => m.job.id === selectedJobId) &&
          (() => {
            const selected = mappable.find((m) => m.job.id === selectedJobId)!;
            return (
              <InfoWindowF
                position={selected.coord}
                onCloseClick={() => onJobSelect?.(null)}
                options={{ maxWidth: 240 }}
              >
                <div className="p-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_PIN[selected.job.status] ?? '#64748b' }}
                    />
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {selected.job.jobNumber || selected.job.id.slice(-6).toUpperCase()}
                    </p>
                    {selected.isLive && (
                      <span className="text-[9px] uppercase tracking-widest font-bold text-emerald-600 ml-auto bg-emerald-50 px-1 py-0.5 rounded">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-tight">
                    {STATUS_LV[selected.job.status]}
                  </p>
                  {selected.job.driver && (
                    <p className="text-xs font-medium text-slate-900 leading-tight pt-1 border-t border-slate-100">
                      {selected.job.driver.firstName} {selected.job.driver.lastName}
                    </p>
                  )}
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
