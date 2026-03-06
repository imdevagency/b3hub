'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// ── Google encoded-polyline decoder ───────────────────────────────────────────
// Returns [lng, lat] pairs (GeoJSON order)
function decodePolyline(encoded: string): [number, number][] {
  const result: [number, number][] = [];
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

    result.push([lng / 1e5, lat / 1e5]); // [lng, lat] for GeoJSON
  }
  return result;
}

// ── Google Routes API v2 ───────────────────────────────────────────────────────
async function fetchRoutePolyline(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<[number, number][] | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    const data = await res.json();
    const encoded = data?.routes?.[0]?.polyline?.encodedPolyline;
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
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string;
  truckPos: { lat: number; lng: number } | null;
  isLive: boolean;
}

// ── Pin components ────────────────────────────────────────────────────────────

function PickupPin({ label }: { label: string }) {
  return (
    <div
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        backgroundColor: '#22c55e',
        border: '2px solid #fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          transform: 'rotate(45deg)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        P
      </span>
    </div>
  );
}

function DeliveryPin({ label }: { label: string }) {
  return (
    <div
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        backgroundColor: '#ef4444',
        border: '2px solid #fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          transform: 'rotate(45deg)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        D
      </span>
    </div>
  );
}

function TruckPin({ isLive }: { isLive: boolean }) {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        backgroundColor: isLive ? '#3b82f6' : '#94a3b8',
        border: '3px solid #fff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        position: 'relative',
      }}
    >
      🚚
      {isLive && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            border: '2px solid #fff',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrackingMap({
  pickupLat,
  pickupLng,
  pickupAddress,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
  truckPos,
  isLive,
}: TrackingMapProps) {
  const mapRef = useRef<MapRef>(null);
  const prevTruckPos = useRef<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [truckBearing, setTruckBearing] = useState(0);
  const routeFetched = useRef(false);

  // Initial lat/lng: prefer pickup, fall back to Riga city center
  const initialLng = pickupLng ?? 24.1052;
  const initialLat = pickupLat ?? 56.9496;

  // Fetch route from Google once we have both endpoints
  useEffect(() => {
    if (routeFetched.current || !pickupLat || !pickupLng || !deliveryLat || !deliveryLng) return;
    routeFetched.current = true;

    fetchRoutePolyline(pickupLat, pickupLng, deliveryLat, deliveryLng).then((coords) => {
      if (coords) setRouteCoords(coords);
    });
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  // Fit map to route once it's loaded
  const handleRouteReady = useCallback(() => {
    if (!routeCoords || !mapRef.current) return;
    const lngs = routeCoords.map((c) => c[0]);
    const lats = routeCoords.map((c) => c[1]);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, duration: 1200, maxZoom: 14 },
    );
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
      map?.easeTo({
        center: [truckPos.lng, truckPos.lat],
        duration: 800,
        zoom: 14,
      });
    } else if (map) {
      // First truck fix — jump there
      map.flyTo({ center: [truckPos.lng, truckPos.lat], zoom: 14, duration: 1000 });
    }
    prevTruckPos.current = truckPos;
  }, [truckPos]);

  const routeGeoJSON = routeCoords
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: routeCoords },
      }
    : null;

  if (!MAPBOX_TOKEN) {
    return (
      <div
        style={{ height: 360 }}
        className="rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-sm"
      >
        Pievieno NEXT_PUBLIC_MAPBOX_TOKEN .env.local failā
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

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        initialViewState={{
          longitude: initialLng,
          latitude: initialLat,
          zoom: 10,
        }}
        style={{ width: '100%', height: 360 }}
        attributionControl={false}
      >
        {/* ── Route line (Google routing data, Mapbox rendering) ── */}
        {routeGeoJSON && (
          <Source id="route" type="geojson" data={routeGeoJSON}>
            {/* Shadow layer */}
            <Layer
              id="route-shadow"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#1e3a8a', 'line-width': 8, 'line-opacity': 0.2 }}
            />
            {/* Main route line */}
            <Layer
              id="route-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.9 }}
            />
          </Source>
        )}

        {/* ── Pickup pin (green) ── */}
        {pickupLat != null && pickupLng != null && (
          <Marker longitude={pickupLng} latitude={pickupLat} anchor="bottom">
            <PickupPin label={pickupAddress} />
          </Marker>
        )}

        {/* ── Delivery pin (red) ── */}
        {deliveryLat != null && deliveryLng != null && (
          <Marker longitude={deliveryLng} latitude={deliveryLat} anchor="bottom">
            <DeliveryPin label={deliveryAddress} />
          </Marker>
        )}

        {/* ── Live truck marker ── */}
        {truckPos && (
          <Marker
            longitude={truckPos.lng}
            latitude={truckPos.lat}
            anchor="center"
            rotation={truckBearing}
          >
            <TruckPin isLive={isLive} />
          </Marker>
        )}
      </Map>

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
