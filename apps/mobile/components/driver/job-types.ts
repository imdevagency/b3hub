/**
 * Shared types, constants and pure utilities for the driver jobs screen.
 * Kept separate so FilterSheet and JobMapView can import without circular deps.
 */
import type { ApiTransportJob } from '@/lib/api';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface TransportJob {
  id: string;
  jobNumber: string;
  vehicleType: string;
  payload: string;
  weightTonnes: number;
  fromCity: string;
  fromAddress: string;
  fromLat: number;
  fromLng: number;
  toCity: string;
  toAddress: string;
  toLat: number;
  toLng: number;
  distanceKm: number;
  date: string;
  time: string;
  priceTotal: number;
  pricePerTonne: number;
  buyerOfferedRate: number | null;
  currency: string;
  status: 'AVAILABLE';
}

export interface SearchFilter {
  fromLocation: string;
  fromRadius: number; // km, 0 = any
  /** Resolved lat/lng from geocoding — populated at apply time */
  fromLat?: number;
  fromLng?: number;
  toLocation: string;
  toRadius: number;
  /** Resolved lat/lng from geocoding — populated at apply time */
  toLat?: number;
  toLng?: number;
  /** Optional vehicle type filter — empty string means any */
  vehicleType?: string;
  /** Minimum total price filter (EUR), 0 = no minimum */
  priceMin?: number;
  /** Maximum total price filter (EUR), 0 = no maximum */
  priceMax?: number;
}

export interface SavedSearch extends SearchFilter {
  id: string;
  name: string;
}

// Return trip extends normal job with distance from the anchor (delivery destination)
export interface ReturnTripJob extends TransportJob {
  returnDistanceKm: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const RADIUS_OPTIONS = [25, 50, 100, 150, 200];
export const ASYNC_KEY = 'b3hub_saved_job_searches';

// ── Geo utilities ─────────────────────────────────────────────────────────────

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Major cities
  riga: { lat: 56.9496, lng: 24.1052 },
  jurmala: { lat: 56.9677, lng: 23.7718 },
  jelgava: { lat: 56.649, lng: 23.7124 },
  liepaja: { lat: 56.5114, lng: 21.0107 },
  ventspils: { lat: 57.3914, lng: 21.5614 },
  daugavpils: { lat: 55.8749, lng: 26.5363 },
  rezekne: { lat: 56.5092, lng: 27.3308 },
  valmiera: { lat: 57.5405, lng: 25.4229 },
  jekabpils: { lat: 56.4967, lng: 25.877 },
  ogre: { lat: 56.8153, lng: 24.6037 },
  sigulda: { lat: 57.1534, lng: 24.86 },
  cesis: { lat: 57.3122, lng: 25.2728 },
  salaspils: { lat: 56.8617, lng: 24.3497 },
  olaine: { lat: 56.7875, lng: 23.9428 },
  tukums: { lat: 56.9671, lng: 23.1523 },
  kuldiga: { lat: 56.9683, lng: 21.9719 },
  saldus: { lat: 56.6657, lng: 22.4893 },
  talsi: { lat: 57.2442, lng: 22.5897 },
  dobele: { lat: 56.6273, lng: 23.2741 },
  bauska: { lat: 56.4086, lng: 24.1941 },
  aizkraukle: { lat: 56.5996, lng: 25.0075 },
  madona: { lat: 56.8552, lng: 26.2266 },
  gulbene: { lat: 57.1745, lng: 26.7491 },
  balvi: { lat: 57.1319, lng: 27.2659 },
  aluksne: { lat: 57.4216, lng: 27.0449 },
  preili: { lat: 56.2944, lng: 26.7237 },
  ludza: { lat: 56.5454, lng: 27.7189 },
  kraslava: { lat: 55.8951, lng: 27.1652 },
  livani: { lat: 56.3553, lng: 26.1712 },
  varaklani: { lat: 56.6089, lng: 26.7509 },
  limbazi: { lat: 57.5105, lng: 24.7124 },
  smiltene: { lat: 57.4228, lng: 25.9007 },
  strencu: { lat: 57.6228, lng: 25.7929 },
  rujiena: { lat: 57.8951, lng: 25.3336 },
  skrunda: { lat: 56.6708, lng: 22.0087 },
  kandava: { lat: 57.0343, lng: 22.7803 },
  pavilosta: { lat: 56.8893, lng: 21.1947 },
  plavinas: { lat: 56.619, lng: 25.7196 },
  vecpiebalga: { lat: 57.0594, lng: 25.8163 },
  cesvaine: { lat: 56.9713, lng: 26.3086 },
  vilakavilakas: { lat: 57.1847, lng: 27.6748 },
  zilupe: { lat: 56.3903, lng: 28.1128 },
  subate: { lat: 56.0214, lng: 25.9013 },
  ilukste: { lat: 56.0136, lng: 26.2992 },
  aizpute: { lat: 56.7217, lng: 21.5995 },
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function cityCoords(input: string): { lat: number; lng: number } | null {
  const key = input
    .toLowerCase()
    .trim()
    .replace(/[āa]/g, 'a')
    .replace(/[ēe]/g, 'e')
    .replace(/[īi]/g, 'i')
    .replace(/[ūu]/g, 'u')
    .replace(/[ģg]/g, 'g')
    .replace(/[ķk]/g, 'k')
    .replace(/[ļl]/g, 'l')
    .replace(/[ņn]/g, 'n')
    .replace(/[šs]/g, 's')
    .replace(/[žz]/g, 'z');
  return (
    CITY_COORDS[key] ??
    Object.entries(CITY_COORDS).find(([k]) => k.includes(key) || key.includes(k))?.[1] ??
    null
  );
}

// ── Data mappers ──────────────────────────────────────────────────────────────

export function mapJob(j: ApiTransportJob): TransportJob {
  const d = new Date(j.pickupDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    vehicleType: j.requiredVehicleType ?? '',
    payload: j.cargoType,
    weightTonnes: j.cargoWeight ?? 0,
    fromCity: j.pickupCity,
    fromAddress: j.pickupAddress,
    fromLat: j.pickupLat ?? 0,
    fromLng: j.pickupLng ?? 0,
    toCity: j.deliveryCity,
    toAddress: j.deliveryAddress,
    toLat: j.deliveryLat ?? 0,
    toLng: j.deliveryLng ?? 0,
    distanceKm: j.distanceKm ?? 0,
    date: `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    priceTotal: j.rate,
    pricePerTonne: j.pricePerTonne ?? 0,
    buyerOfferedRate: j.buyerOfferedRate ?? null,
    currency: j.currency,
    status: 'AVAILABLE',
  };
}

// ── Filter and nearest-job logic ──────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[āa]/g, 'a')
    .replace(/[ēe]/g, 'e')
    .replace(/[īi]/g, 'i')
    .replace(/[ūu]/g, 'u')
    .replace(/[ģg]/g, 'g')
    .replace(/[ķk]/g, 'k')
    .replace(/[ļl]/g, 'l')
    .replace(/[ņn]/g, 'n')
    .replace(/[šs]/g, 's')
    .replace(/[žz]/g, 'z');
}

export function filterJobs(jobs: TransportJob[], filter: SearchFilter | null): TransportJob[] {
  if (!filter) return jobs;
  const { fromLocation, fromRadius, fromLat, fromLng, toLocation, toRadius, toLat, toLng, vehicleType, priceMin, priceMax } = filter;
  return jobs.filter((job) => {
    if (fromLocation.trim()) {
      // Prefer geocoded coords, fall back to hardcoded city table
      const resolvedLat = fromLat ?? cityCoords(fromLocation)?.lat;
      const resolvedLng = fromLng ?? cityCoords(fromLocation)?.lng;
      if (resolvedLat !== undefined && resolvedLng !== undefined && fromRadius > 0) {
        const dist = haversineKm(resolvedLat, resolvedLng, job.fromLat, job.fromLng);
        if (dist > fromRadius) return false;
      } else {
        // Fallback: substring match on city/address text
        const needle = normalise(fromLocation);
        const haystack = normalise(job.fromCity + ' ' + job.fromAddress);
        if (!haystack.includes(needle)) return false;
      }
    }
    if (toLocation.trim()) {
      const resolvedLat = toLat ?? cityCoords(toLocation)?.lat;
      const resolvedLng = toLng ?? cityCoords(toLocation)?.lng;
      if (resolvedLat !== undefined && resolvedLng !== undefined && toRadius > 0) {
        const dist = haversineKm(resolvedLat, resolvedLng, job.toLat, job.toLng);
        if (dist > toRadius) return false;
      } else {
        const needle = normalise(toLocation);
        const haystack = normalise(job.toCity + ' ' + job.toAddress);
        if (!haystack.includes(needle)) return false;
      }
    }
    if (vehicleType && vehicleType !== '') {
      if (job.vehicleType !== vehicleType) return false;
    }
    if (priceMin && priceMin > 0) {
      if (job.priceTotal < priceMin) return false;
    }
    if (priceMax && priceMax > 0) {
      if (job.priceTotal > priceMax) return false;
    }
    return true;
  });
}

export function nearbyJobs(
  lat: number,
  lng: number,
  allJobs: TransportJob[],
  excludeId: string,
  topN = 3,
): { job: TransportJob; gapKm: number }[] {
  return allJobs
    .filter((j) => j.id !== excludeId && j.fromLat && j.fromLng)
    .map((j) => ({ job: j, gapKm: Math.round(haversineKm(lat, lng, j.fromLat, j.fromLng)) }))
    .sort((a, b) => a.gapKm - b.gapKm)
    .slice(0, topN);
}
