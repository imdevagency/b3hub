/**
 * maps.ts — Mapbox utilities for B3Hub
 *
 * Wraps:
 *  • Directions API v5        — real road polylines + distance/duration
 *  • Optimization API v1      — multi-stop delivery ordering (≤12 stops)
 *
 * All calls are fire-and-forget safe: every async function has a graceful
 * fallback (straight-line or original order) so the map never hard-crashes.
 */

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

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

// ── Directions API v5 ─────────────────────────────────────────────────────────

/**
 * Fetch a real driving route between two points using the Mapbox Directions API.
 * Returns decoded GeoJSON coords + distance/duration metadata.
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

  if (!MAPBOX_TOKEN) return fallback;

  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      routes?: Array<{
        geometry?: { coordinates?: number[][] };
        distance?: number;
        duration?: number;
      }>;
    };

    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return fallback;

    // Mapbox returns [longitude, latitude]; convert to {latitude, longitude}
    const coords: LatLng[] = route.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const distanceKm = route.distance ? Math.round((route.distance / 1000) * 10) / 10 : 0;
    const durationSec = route.duration ? Math.round(route.duration) : 0;

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

// ── Optimization API v1 ───────────────────────────────────────────────────────

/**
 * Given a list of stops, ask the Mapbox Optimization API to reorder them for
 * minimum travel time. Supports up to 12 waypoints.
 *
 * Falls back to the original order on any error.
 */
export async function optimizeRoute(stops: Stop[]): Promise<OptimizedRoute> {
  const fallback: OptimizedRoute = {
    orderedStops: stops,
    visitOrder: stops.map((_, i) => i),
    totalDistanceKm: 0,
  };

  if (!MAPBOX_TOKEN || stops.length < 2) return fallback;

  try {
    const coordStr = stops.map((s) => `${s.lng},${s.lat}`).join(';');
    const url =
      `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordStr}` +
      `?geometries=geojson&roundtrip=false&source=first&destination=last` +
      `&access_token=${MAPBOX_TOKEN}`;

    const res = await fetch(url);
    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      code?: string;
      waypoints?: Array<{ waypoint_index: number }>;
      trips?: Array<{ distance?: number }>;
    };

    if (data.code !== 'Ok' || !data.waypoints?.length) return fallback;

    // waypoints[i].waypoint_index = optimized visit position of input stop i
    const orderedStops = new Array<Stop>(stops.length);
    const visitOrder = new Array<number>(stops.length);
    for (let i = 0; i < stops.length; i++) {
      const pos = data.waypoints[i].waypoint_index;
      orderedStops[pos] = stops[i];
      visitOrder[pos] = i;
    }

    const totalDistanceKm = data.trips?.[0]?.distance
      ? Math.round((data.trips[0].distance / 1000) * 10) / 10
      : 0;

    return { orderedStops, visitOrder, totalDistanceKm };
  } catch {
    return fallback;
  }
}
