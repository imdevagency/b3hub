/**
 * maps.ts — Google Maps utilities for B3Hub
 *
 * Wraps:
 *  • Routes API v2  — real road polylines + distance/duration for each leg
 *  • Route Optimization API — multi-stop delivery ordering
 *  • Polyline codec  — decodes Google's compact encoded-polyline format
 *
 * All calls are fire-and-forget safe: every async function has a graceful
 * fallback (straight-line or original order) so the map never hard-crashes.
 */

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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

// ── Polyline decoder ──────────────────────────────────────────────────────────
// Based on Google's specification: https://developers.google.com/maps/documentation/utilities/polylinealgorithm

export function decodePolyline(encoded: string): LatLng[] {
  const result: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let b: number;
    let raw = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      raw |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    lat += raw & 1 ? ~(raw >> 1) : raw >> 1;

    shift = 0;
    raw = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      raw |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    lng += raw & 1 ? ~(raw >> 1) : raw >> 1;
    result.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return result;
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

// ── Routes API v2 ─────────────────────────────────────────────────────────────

/**
 * Fetch a real driving route between two points using the Google Routes API v2.
 * Returns decoded polyline coords + distance/duration metadata.
 *
 * Falls back to a straight two-point line on any error so the map always
 * renders something.
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

  if (!MAPS_KEY) return fallback;

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': MAPS_KEY,
        'X-Goog-FieldMask':
          'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
        },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        units: 'METRIC',
      }),
    });

    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      routes?: Array<{
        polyline?: { encodedPolyline?: string };
        distanceMeters?: number;
        duration?: string; // e.g. "4253s"
      }>;
    };

    const route = data?.routes?.[0];
    if (!route?.polyline?.encodedPolyline) return fallback;

    const coords = decodePolyline(route.polyline.encodedPolyline);
    const distanceKm = route.distanceMeters ? route.distanceMeters / 1000 : 0;
    const durationSec = route.duration
      ? parseInt(route.duration.replace('s', ''), 10)
      : 0;

    return {
      coords,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationLabel: formatDuration(durationSec),
      durationSec,
    };
  } catch {
    return fallback;
  }
}

// ── Route Optimization API ────────────────────────────────────────────────────

/**
 * Given an ordered list of stops, ask the Route Optimization API to reorder
 * them for minimum travel time.
 *
 * Useful when a driver has accepted multiple jobs in one day: pass all
 * pickup+delivery pairs, get back the optimal visit order.
 *
 * Falls back to the original order on any error.
 */
export async function optimizeRoute(stops: Stop[]): Promise<OptimizedRoute> {
  const fallback: OptimizedRoute = {
    orderedStops: stops,
    visitOrder: stops.map((_, i) => i),
    totalDistanceKm: 0,
  };

  if (!MAPS_KEY || stops.length < 2) return fallback;

  try {
    // Route Optimization API uses a different base URL
    const res = await fetch(
      `https://routeoptimization.googleapis.com/v1/projects/-:optimizeTours?key=${MAPS_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: {
            shipments: stops.map((stop, i) => ({
              pickups: [
                {
                  arrivalLocation: { latitude: stop.lat, longitude: stop.lng },
                  label: stop.label ?? `stop-${i}`,
                },
              ],
            })),
            vehicles: [
              {
                startLocation: { latitude: stops[0].lat, longitude: stops[0].lng },
                endLocation: { latitude: stops[stops.length - 1].lat, longitude: stops[stops.length - 1].lng },
                costPerKilometer: 1,
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      routes?: Array<{
        visits?: Array<{ shipmentIndex?: number }>;
        metrics?: { totalDistance?: { meters?: number } };
      }>;
    };

    const route = data?.routes?.[0];
    if (!route?.visits?.length) return fallback;

    const visitOrder = route.visits.map((v) => v.shipmentIndex ?? 0);
    const orderedStops = visitOrder.map((i) => stops[i]);
    const totalDistanceKm = route.metrics?.totalDistance?.meters
      ? Math.round((route.metrics.totalDistance.meters / 1000) * 10) / 10
      : 0;

    return { orderedStops, visitOrder, totalDistanceKm };
  } catch {
    return fallback;
  }
}
