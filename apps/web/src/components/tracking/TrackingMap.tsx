/**
 * TrackingMap component.
 * Leaflet map showing the real-time location of a single transport job's driver.
 * Polls the API for GPS updates and animates the marker.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import { apiFetch } from '@/lib/api/common';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

const GOOGLE_KEY = getGoogleMapsPublicKey();

// ── Google encoded-polyline decoder ───────────────────────────────────────────
// Returns Google lat/lng pairs
function decodePolyline(encoded: string): google.maps.LatLngLiteral[] {
  const result: google.maps.LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result5 = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result5 |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = result5 & 1 ? ~(result5 >> 1) : result5 >> 1;
    lat += dLat;

    shift = 0;
    result5 = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result5 |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = result5 & 1 ? ~(result5 >> 1) : result5 >> 1;
    lng += dLng;

    result.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return result;
}

// ── Google Routes API v2 ───────────────────────────────────────────────────────
async function fetchRoutePolyline(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  token?: string,
): Promise<google.maps.LatLngLiteral[] | null> {
  if (!token) return null;
  try {
    const data = await apiFetch<{ encodedPolyline?: string }>('/maps/route-polyline', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        originLat,
        originLng,
        destLat,
        destLng,
      }),
    });
    const encoded = data?.encodedPolyline;
    return encoded ? decodePolyline(encoded) : null;
  } catch {
    return null;
  }
}

// ── Bearing between two GPS points (for truck rotation) ───────────────────────
function getBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackingMapProps {
  token?: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string;
  truckPos: { lat: number; lng: number } | null;
  isLive: boolean;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrackingMap({
  token,
  pickupLat,
  pickupLng,
  pickupAddress,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
  truckPos,
  isLive,
}: TrackingMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const prevTruckPos = useRef<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [truckBearing, setTruckBearing] = useState(0);
  const routeFetched = useRef(false);
  const { isLoaded } = useJsApiLoader({
    id: 'b3hub-google-maps',
    googleMapsApiKey: GOOGLE_KEY,
  });

  // Initial lat/lng: prefer pickup, fall back to Riga city center
  const initialLng = pickupLng ?? 24.1052;
  const initialLat = pickupLat ?? 56.9496;

  // Fetch route from Google once we have both endpoints
  useEffect(() => {
    if (routeFetched.current || !pickupLat || !pickupLng || !deliveryLat || !deliveryLng) return;
    routeFetched.current = true;

    fetchRoutePolyline(pickupLat, pickupLng, deliveryLat, deliveryLng, token).then((coords) => {
      if (coords) setRouteCoords(coords);
    });
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, token]);

  // Fit map to route once it's loaded
  const handleRouteReady = useCallback(() => {
    if (!routeCoords || !mapRef.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    routeCoords.forEach((coord) => bounds.extend(coord));
    mapRef.current.fitBounds(bounds, 80);
  }, [routeCoords]);

  useEffect(() => {
    if (routeCoords) handleRouteReady();
  }, [routeCoords, handleRouteReady]);

  // Smooth camera + bearing when truck GPS updates
  useEffect(() => {
    if (!truckPos) return;
    const map = mapRef.current;

    if (prevTruckPos.current) {
      const bearing = getBearing(prevTruckPos.current, truckPos);
      setTruckBearing(bearing);
      map?.panTo(truckPos);
      map?.setZoom(14);
    } else if (map) {
      // First truck fix — jump there
      map.panTo(truckPos);
      map.setZoom(14);
    }
    prevTruckPos.current = truckPos;
  }, [truckPos]);

  if (!GOOGLE_KEY) {
    return (
      <div
        style={{ height: 360 }}
        className="rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-sm"
      >
        Pievieno NEXT_PUBLIC_GOOGLE_MAPS_API_KEY .env.local failā
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{ height: 360 }}
        className="rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-sm"
      >
        Karte tiek ielādēta...
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.5); }
        }
      `}</style>

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: 360 }}
        center={{ lat: initialLat, lng: initialLng }}
        zoom={10}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {routeCoords && (
          <PolylineF
            path={routeCoords}
            options={{
              geodesic: true,
              strokeColor: '#3b82f6',
              strokeOpacity: 0.95,
              strokeWeight: 4,
            }}
          />
        )}

        {/* ── Pickup pin (green) ── */}
        {pickupLat != null && pickupLng != null && (
          <MarkerF
            position={{ lat: pickupLat, lng: pickupLng }}
            title={pickupAddress}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#22c55e',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 7,
            }}
          />
        )}

        {/* ── Delivery pin (red) ── */}
        {deliveryLat != null && deliveryLng != null && (
          <MarkerF
            position={{ lat: deliveryLat, lng: deliveryLng }}
            title={deliveryAddress}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 7,
            }}
          />
        )}

        {/* ── Live truck marker ── */}
        {truckPos && (
          <MarkerF
            position={truckPos}
            icon={{
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              fillColor: isLive ? '#3b82f6' : '#94a3b8',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 6,
              rotation: truckBearing,
            }}
          />
        )}
      </GoogleMap>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
          Iekraušana
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
          Piegāde
        </span>
        {truckPos && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            Transportlīdzeklis
          </span>
        )}
        {!routeCoords && pickupLat && deliveryLat && (
          <span className="text-slate-400 italic">Maršruts tiek ielādēts…</span>
        )}
        {isLive && (
          <span className="ml-auto flex items-center gap-1 text-green-600 font-semibold">
            <span
              className="inline-block w-2 h-2 rounded-full bg-green-500"
              style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
            />
            LIVE
          </span>
        )}
      </div>
    </div>
  );
}
