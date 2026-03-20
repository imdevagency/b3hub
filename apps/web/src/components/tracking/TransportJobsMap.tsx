/**
 * TransportJobsMap component.
 * Overview map showing all active transport jobs with pickup/delivery markers.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

const GOOGLE_KEY = getGoogleMapsPublicKey();

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
  const mapRef = useRef<google.maps.Map | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: 'b3hub-google-maps',
    googleMapsApiKey: GOOGLE_KEY,
  });

  // Fly to selected route midpoint when selection changes
  useEffect(() => {
    if (!selectedId) return;
    const job = jobs.find((j) => j.id === selectedId);
    if (!job) return;
    const midLng = (job.fromLng + job.toLng) / 2;
    const midLat = (job.fromLat + job.toLat) / 2;
    mapRef.current?.panTo({ lat: midLat, lng: midLng });
    mapRef.current?.setZoom(9);
  }, [selectedId, jobs]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || jobs.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    jobs.forEach((job) => {
      bounds.extend({ lat: job.fromLat, lng: job.fromLng });
      bounds.extend({ lat: job.toLat, lng: job.toLng });
    });
    mapRef.current.fitBounds(bounds, 60);
  }, [isLoaded, jobs]);

  if (!GOOGLE_KEY) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-zinc-900 text-zinc-400">
        <div className="text-center space-y-1">
          <p className="font-semibold text-sm">Karte nav pieejama</p>
          <p className="text-xs opacity-60">Google Maps atslēga nav iestatīta.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-zinc-900 text-zinc-400">
        <p className="text-sm">Karte tiek ielādēta...</p>
      </div>
    );
  }

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;

  const bounds = getBounds(jobs);

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={
        bounds
          ? {
              lat: (bounds[0][1] + bounds[1][1]) / 2,
              lng: (bounds[0][0] + bounds[1][0]) / 2,
            }
          : { lat: 56.95, lng: 24.105 }
      }
      zoom={7}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      onUnmount={() => {
        mapRef.current = null;
      }}
      onClick={() => onSelect(null)}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {jobs.map((job) => {
        const isSelected = job.id === selectedId;
        return (
          <PolylineF
            key={`line-${job.id}`}
            path={[
              { lat: job.fromLat, lng: job.fromLng },
              { lat: job.toLat, lng: job.toLng },
            ]}
            options={{
              geodesic: true,
              strokeColor: isSelected ? '#3b82f6' : '#6b7280',
              strokeOpacity: isSelected ? 1 : 0.35,
              strokeWeight: isSelected ? 3 : 1.5,
            }}
          />
        );
      })}

      {/* ── Pickup + Delivery pins per job ───────────────────────── */}
      {jobs.map((job) => {
        const isSelected = job.id === selectedId;
        return (
          <React.Fragment key={job.id}>
            {/* FROM / Pickup */}
            <MarkerF
              position={{ lat: job.fromLat, lng: job.fromLng }}
              onClick={(e) => {
                e.domEvent?.stopPropagation();
                onSelect(job.id);
              }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: isSelected ? '#3b82f6' : '#6b7280',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 6,
              }}
            />

            {/* TO / Delivery */}
            <MarkerF
              position={{ lat: job.toLat, lng: job.toLng }}
              onClick={(e) => {
                e.domEvent?.stopPropagation();
                onSelect(job.id);
              }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: isSelected ? '#3b82f6' : '#ef4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 7,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* ── Popup for selected job ───────────────────────────────── */}
      {selectedJob && (
        <InfoWindowF
          position={{
            lat: (selectedJob.fromLat + selectedJob.toLat) / 2,
            lng: (selectedJob.fromLng + selectedJob.toLng) / 2,
          }}
          onCloseClick={() => onSelect(null)}
          options={{ disableAutoPan: true }}
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
        </InfoWindowF>
      )}
    </GoogleMap>
  );
}
