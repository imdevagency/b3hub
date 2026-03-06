'use client';

import React, { useEffect, useRef } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  type MapRef,
} from 'react-map-gl/mapbox';
import type { LayerProps } from 'react-map-gl/mapbox';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ── Minimal job shape needed by this component ─────────────────────────────────
export interface JobRoutePoint {
  id: string;
  jobNumber: string;
  fromLat: number;
  fromLng: number;
  fromCity: string;
  fromAddress: string;
  toLat: number;
  toLng: number;
  toCity: string;
  payload: string;
  weightTonnes: number;
  priceTotal: number;
  currency: string;
  vehicleEmoji: string;
  distanceKm: number;
}

// ── GeoJSON builders ───────────────────────────────────────────────────────────

function buildRoutesGeoJSON(jobs: JobRoutePoint[], selectedId: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: jobs.map((j) => ({
      type: 'Feature' as const,
      properties: { id: j.id, selected: j.id === selectedId },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [j.fromLng, j.fromLat],
          [j.toLng, j.toLat],
        ],
      },
    })),
  };
}

// ── Layer styles ───────────────────────────────────────────────────────────────

const fadedLineLayer: LayerProps = {
  id: 'routes-faded',
  type: 'line',
  filter: ['!=', ['get', 'selected'], true],
  paint: {
    'line-color': '#6b7280',
    'line-width': 1.5,
    'line-dasharray': [3, 3],
    'line-opacity': 0.35,
  },
};

const selectedLineLayer: LayerProps = {
  id: 'routes-selected',
  type: 'line',
  filter: ['==', ['get', 'selected'], true],
  paint: {
    'line-color': '#3b82f6',
    'line-width': 3,
    'line-opacity': 1,
  },
};

// ── Pin sub-components ─────────────────────────────────────────────────────────

function PickupPin({ selected }: { selected: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-md transition-transform ${
        selected
          ? 'scale-125 border-blue-400 bg-blue-500'
          : 'border-gray-300 bg-gray-500 hover:scale-110'
      }`}
      title="Iekraušana"
    >
      <div className="h-1.5 w-1.5 rounded-full bg-white" />
    </div>
  );
}

function DeliveryPin({ selected }: { selected: boolean }) {
  return (
    <div
      className={`relative flex h-6 w-5 cursor-pointer flex-col items-center transition-transform ${
        selected ? 'scale-125' : 'hover:scale-110'
      }`}
      title="Izkraušana"
    >
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-sm shadow-md border-2 ${
          selected ? 'border-blue-400 bg-blue-500' : 'border-red-400 bg-red-500'
        }`}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-white" />
      </div>
      {/* tail */}
      <div className={`h-1.25 w-0.5 ${selected ? 'bg-blue-500' : 'bg-red-500'}`} />
    </div>
  );
}

// ── Lat/Lng bounds helper ──────────────────────────────────────────────────────

function getBounds(jobs: JobRoutePoint[]): [[number, number], [number, number]] | null {
  if (jobs.length === 0) return null;
  const lngs = jobs.flatMap((j) => [j.fromLng, j.toLng]);
  const lats = jobs.flatMap((j) => [j.fromLat, j.toLat]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  jobs: JobRoutePoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function TransportJobsMap({ jobs, selectedId, onSelect }: Props) {
  const mapRef = useRef<MapRef>(null);

  // Fly to selected route midpoint when selection changes
  useEffect(() => {
    if (!selectedId) return;
    const job = jobs.find((j) => j.id === selectedId);
    if (!job) return;
    const midLng = (job.fromLng + job.toLng) / 2;
    const midLat = (job.fromLat + job.toLat) / 2;
    mapRef.current?.flyTo({ center: [midLng, midLat], zoom: 9, duration: 700 });
  }, [selectedId, jobs]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-zinc-900 text-zinc-400">
        <div className="text-center space-y-1">
          <p className="font-semibold text-sm">Karte nav pieejama</p>
          <p className="text-xs opacity-60">Mapbox token nav iestatīts.</p>
        </div>
      </div>
    );
  }

  const routesData = buildRoutesGeoJSON(jobs, selectedId);
  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;

  // Default center: Latvia (Riga)
  const bounds = getBounds(jobs);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={
        bounds
          ? {
              bounds: bounds as [[number, number], [number, number]],
              fitBoundsOptions: { padding: 60, maxZoom: 11 },
            }
          : { longitude: 24.105, latitude: 56.95, zoom: 7 }
      }
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      onClick={() => onSelect(null)}
    >
      <NavigationControl position="top-right" />

      {/* ── Route lines ─────────────────────────────────────────── */}
      <Source id="routes" type="geojson" data={routesData}>
        <Layer {...fadedLineLayer} />
        <Layer {...selectedLineLayer} />
      </Source>

      {/* ── Pickup + Delivery pins per job ───────────────────────── */}
      {jobs.map((job) => {
        const isSelected = job.id === selectedId;
        return (
          <React.Fragment key={job.id}>
            {/* FROM / Pickup */}
            <Marker
              longitude={job.fromLng}
              latitude={job.fromLat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect(job.id);
              }}
            >
              <PickupPin selected={isSelected} />
            </Marker>

            {/* TO / Delivery */}
            <Marker
              longitude={job.toLng}
              latitude={job.toLat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelect(job.id);
              }}
            >
              <DeliveryPin selected={isSelected} />
            </Marker>
          </React.Fragment>
        );
      })}

      {/* ── Popup for selected job ───────────────────────────────── */}
      {selectedJob && (
        <Popup
          longitude={(selectedJob.fromLng + selectedJob.toLng) / 2}
          latitude={(selectedJob.fromLat + selectedJob.toLat) / 2}
          anchor="bottom"
          offset={12}
          closeButton={false}
          closeOnClick={false}
          style={{ zIndex: 10 }}
        >
          <div className="min-w-40 space-y-1.5 p-1" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <span className="text-lg leading-none">{selectedJob.vehicleEmoji}</span>
              <span className="text-xs font-mono text-gray-500">#{selectedJob.jobNumber}</span>
            </div>
            <p className="text-xs font-semibold text-gray-900">
              {selectedJob.fromCity} → {selectedJob.toCity}
            </p>
            <p className="text-xs text-gray-500">
              {selectedJob.weightTonnes} t · {selectedJob.payload}
            </p>
            <p className="text-sm font-bold text-blue-600">
              {selectedJob.priceTotal.toFixed(2)} {selectedJob.currency}
            </p>
            <p className="text-xs text-gray-400">{selectedJob.distanceKm} km</p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
