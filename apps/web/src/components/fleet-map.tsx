/**
 * FleetMap component.
 * Leaflet map showing all active carrier vehicle positions for the fleet manager.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import type { MapRef } from '@vis.gl/react-mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useRouter } from 'next/navigation';
import { type ApiTransportJob } from '@/lib/api';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

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
}

export function FleetMap({ jobs }: FleetMapProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<ApiTransportJob | null>(null);
  const mapRef = useRef<MapRef | null>(null);

  const mappable = useMemo(
    () =>
      jobs.map((j) => ({ job: j, coord: jobCoord(j) })).filter((x) => x.coord !== null) as {
        job: ApiTransportJob;
        coord: { lat: number; lng: number };
      }[],
    [jobs],
  );

  // Auto-fit bounds when jobs change
  useEffect(() => {
    if (!mapRef.current || mappable.length === 0) return;
    const map = mapRef.current.getMap();
    if (!map) return;

    try {
      // Dynamic import to avoid ssr issues
      import('mapbox-gl').then(({ LngLatBounds }) => {
        const bounds = new LngLatBounds();
        mappable.forEach(({ coord }) => bounds.extend([coord.lng, coord.lat]));
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: 800 });
        }
      });
    } catch {
      // ignore
    }
  }, [mappable]);

  if (!TOKEN) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center h-96">
        <p className="text-sm text-muted-foreground">
          Mapbox API atslēga nav konfigurēta (<code>NEXT_PUBLIC_MAPBOX_TOKEN</code>)
        </p>
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
    <div className="rounded-2xl overflow-hidden border border-slate-200" style={{ height: 520 }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 24.1, latitude: 56.95, zoom: 6 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        mapboxAccessToken={TOKEN}
        onClick={() => setSelected(null)}
      >
        {mappable.map(({ job, coord }) => (
          <Marker
            key={job.id}
            longitude={coord.lng}
            latitude={coord.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(job);
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: STATUS_PIN[job.status] ?? '#64748b',
                border: '2.5px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                transition: 'transform 0.15s',
              }}
              title={`${job.jobNumber} · ${STATUS_LV[job.status] ?? job.status}`}
            >
              🚛
            </div>
          </Marker>
        ))}

        {selected &&
          (() => {
            const coord = jobCoord(selected);
            if (!coord) return null;
            return (
              <Popup
                longitude={coord.lng}
                latitude={coord.lat}
                anchor="bottom"
                onClose={() => setSelected(null)}
                closeOnClick={false}
                maxWidth="240px"
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
              </Popup>
            );
          })()}
      </Map>

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

      {/* Job count badge */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full border border-slate-200 px-3 py-1 shadow-sm">
        <p className="text-xs font-semibold text-slate-700">{mappable.length} darbi kartē</p>
      </div>
    </div>
  );
}
