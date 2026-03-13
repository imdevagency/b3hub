/**
 * maps.ts — Google Maps utilities for B3Hub
 *
 * Wraps:
 *  • Directions API        — real road polylines + distance/duration
 *  • Directions API (optimized waypoints) — multi-stop delivery ordering
 *
 * All calls are fire-and-forget safe: every async function has a graceful
 * fallback (straight-line or original order) so the map never hard-crashes.
 */

const GOOGLE_KEY = 'AIzaSyBNIZk1VBorD3kU02BNjz_2m4Dlek_gsx8';
const DIRECTIONS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  /** Decoded polyline coordinates for the Polyline component */
  coords: LatLng[];
  /** Total road distance in km, rounded to 1 dp */
  distanceKm: number;
  /** Human-readable duration, e.g. "1 h 23 min" */
  durationLabel: string;
  /** Duration in seconds (raw) */
  durationSec: number;
}

export interface Stop {
  lat: number;
  lng: number;
  label?: string;
}

export interface OptimizedRoute {
  /** Stops reordered for minimum travel time */
  orderedStops: Stop[];
  /** Index mapping: orderedStops[i] = originalStops[visitOrder[i]] */
  visitOrder: number[];
  /** Total estimated distance in km */
  totalDistanceKm: number;
}

// ── Duration formatter ────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ── Google encoded polyline decoder ──────────────────────────────────────────

function decodePolyline(encoded: string): LatLng[] {
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

// ── Directions API ────────────────────────────────────────────────────────────

/**
 * Fetch a real driving route between two points using the Google Maps Directions API.
 * Returns decoded polyline coords + distance/duration metadata.
 *
 * Falls back to a straight two-point line on any error.
 */
export async function fetchRoute(origin: Stop, destination: Stop): Promise<RouteInfo> {
  const fallback: RouteInfo = {
    coords: [
      { latitude: origin.lat, longitude: origin.lng },
      { latitude: destination.lat, longitude: destination.lng },
    ],
    distanceKm: 0,
    durationLabel: '',
    durationSec: 0,
  };

  try {
    const url =
      `${DIRECTIONS_BASE}?origin=${origin.lat},${origin.lng}` +
      `&destination=${destination.lat},${destination.lng}` +
      `&mode=driving&language=lv&key=${GOOGLE_KEY}`;

    const res = await fetch(url);
    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      status?: string;
      routes?: Array<{
        overview_polyline?: { points?: string };
        legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
      }>;
    };

    if (data.status !== 'OK' || !data.routes?.[0]) return fallback;

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const encoded = route.overview_polyline?.points;
    if (!encoded) return fallback;

    const coords = decodePolyline(encoded);
    const distanceKm = leg?.distance?.value
      ? Math.round((leg.distance.value / 1000) * 10) / 10
      : 0;
    const durationSec = leg?.duration?.value ? Math.round(leg.duration.value) : 0;

    return {
      coords,
      distanceKm,
      durationLabel: formatDuration(durationSec),
      durationSec,
    };
  } catch {
    return fallback;
  }
}

// ── Directions API with optimized waypoints ───────────────────────────────────

/**
 * Given a list of stops, use the Google Maps Directions API to reorder the
 * intermediate stops for minimum travel time. Origin (first) and destination
 * (last) stay fixed.
 *
 * Falls back to the original order on any error.
 */
export async function optimizeRoute(stops: Stop[]): Promise<OptimizedRoute> {
  const fallback: OptimizedRoute = {
    orderedStops: stops,
    visitOrder: stops.map((_, i) => i),
    totalDistanceKm: 0,
  };

  if (stops.length < 2) return fallback;
  if (stops.length === 2) {
    const info = await fetchRoute(stops[0], stops[1]);
    return { orderedStops: stops, visitOrder: [0, 1], totalDistanceKm: info.distanceKm };
  }

  try {
    const origin = stops[0];
    const dest = stops[stops.length - 1];
    const intermediates = stops.slice(1, -1);
    const waypointStr = `optimize:true|${intermediates.map((s) => `${s.lat},${s.lng}`).join('|')}`;

    const url =
      `${DIRECTIONS_BASE}?origin=${origin.lat},${origin.lng}` +
      `&destination=${dest.lat},${dest.lng}` +
      `&waypoints=${encodeURIComponent(waypointStr)}` +
      `&mode=driving&key=${GOOGLE_KEY}`;

    const res = await fetch(url);
    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      status?: string;
      routes?: Array<{
        waypoint_order?: number[];
        legs?: Array<{ distance?: { value?: number } }>;
      }>;
    };

    if (data.status !== 'OK' || !data.routes?.[0]?.waypoint_order) return fallback;

    const waypointOrder = data.routes[0].waypoint_order; // indices into intermediates[]
    // Build final ordered stops: origin → reordered intermediates → destination
    const orderedStops: Stop[] = [
      origin,
      ...waypointOrder.map((i) => intermediates[i]),
      dest,
    ];
    // visitOrder[newPos] = originalIndex
    const visitOrder: number[] = [
      0,
      ...waypointOrder.map((i) => i + 1), // +1 because intermediate[i] is stops[i+1]
      stops.length - 1,
    ];

    const totalDistanceKm = data.routes[0].legs
      ? Math.round(
          (data.routes[0].legs.reduce((sum, l) => sum + (l.distance?.value ?? 0), 0) / 1000) * 10,
        ) / 10
      : 0;

    return { orderedStops, visitOrder, totalDistanceKm };
  } catch {
    return fallback;
  }
}
