/**
 * Geo utilities — Latvian city coordinates, haversine distance, geocoding.
 * Used by the jobs/page distance filter.
 */

import { API_URL } from '@/lib/api/common';

// ── Latvian city coordinate lookup ────────────────────────────────────────────

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  riga: { lat: 56.9496, lng: 24.1052 },
  jurmala: { lat: 56.9677, lng: 23.7718 },
  ogre: { lat: 56.8153, lng: 24.6037 },
  sigulda: { lat: 57.1534, lng: 24.86 },
  ventspils: { lat: 57.3914, lng: 21.5614 },
  jelgava: { lat: 56.649, lng: 23.7124 },
  liepaja: { lat: 56.5114, lng: 21.0107 },
  daugavpils: { lat: 55.8749, lng: 26.5363 },
  valmiera: { lat: 57.5405, lng: 25.4229 },
  rezekne: { lat: 56.509, lng: 27.3326 },
  jekabpils: { lat: 56.4985, lng: 25.8706 },
  jelsava: { lat: 56.649, lng: 23.7124 },
  tukums: { lat: 56.9671, lng: 23.156 },
  cesis: { lat: 57.3124, lng: 25.2773 },
  dobele: { lat: 56.6236, lng: 23.2781 },
  kuldiga: { lat: 56.969, lng: 21.9612 },
  bauska: { lat: 56.4086, lng: 24.1957 },
  limbazi: { lat: 57.511, lng: 24.7195 },
  salaspils: { lat: 56.8619, lng: 24.3498 },
  olaine: { lat: 56.7887, lng: 23.9404 },
  marupe: { lat: 56.8955, lng: 23.98 },
  adazi: { lat: 57.0745, lng: 24.3219 },
  saulkrasti: { lat: 57.2572, lng: 24.4134 },
  smiltene: { lat: 57.4228, lng: 25.896 },
  gulbene: { lat: 57.1756, lng: 26.7439 },
  madona: { lat: 56.857, lng: 26.2213 },
  preili: { lat: 56.2904, lng: 26.7225 },
  ludza: { lat: 56.548, lng: 27.7194 },
  balvi: { lat: 57.1305, lng: 27.2649 },
};

// ── Utilities ─────────────────────────────────────────────────────────────────

export function normalizeCity(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/ā/g, 'a')
    .replace(/ē/g, 'e')
    .replace(/ī/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/ģ/g, 'g')
    .replace(/ķ/g, 'k')
    .replace(/ļ/g, 'l')
    .replace(/ņ/g, 'n')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z');
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveCityCoords(
  input: string,
  geocodeCache: Record<string, { lat: number; lng: number }>,
): { lat: number; lng: number } | null {
  const key = normalizeCity(input);
  if (geocodeCache[key]) return geocodeCache[key];
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  return Object.entries(CITY_COORDS).find(([k]) => k.includes(key) || key.includes(k))?.[1] ?? null;
}

export async function geocodeCity(
  city: string,
  token: string | null,
): Promise<{ lat: number; lng: number } | null> {
  if (!city.trim()) return null;
  try {
    const url = `${API_URL}/maps/autocomplete?input=${encodeURIComponent(city + ', Latvia')}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      suggestions?: Array<{ place_id: string; description: string }>;
    };
    const first = data.suggestions?.[0];
    if (!first) return null;
    const detailsUrl = `${API_URL}/maps/place-details?place_id=${encodeURIComponent(first.place_id)}`;
    const detailsRes = await fetch(detailsUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!detailsRes.ok) return null;
    const details = (await detailsRes.json()) as { location?: { lat: number; lng: number } };
    return details.location ?? null;
  } catch {
    // silent
  }
  return null;
}

// ── Filter ────────────────────────────────────────────────────────────────────

export interface GeoSearchFilter {
  fromLocation: string;
  fromRadius: number;
  toLocation: string;
  toRadius: number;
}

export interface GeoFilterableJob {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

export function filterJobsByGeo<T extends GeoFilterableJob>(
  jobs: T[],
  filter: GeoSearchFilter | null,
  geocodeCache: Record<string, { lat: number; lng: number }>,
): T[] {
  if (!filter) return jobs;
  const { fromLocation, fromRadius, toLocation, toRadius } = filter;
  return jobs.filter((job) => {
    if (fromLocation.trim() && fromRadius > 0) {
      const c = resolveCityCoords(fromLocation, geocodeCache);
      if (c && haversineKm(c.lat, c.lng, job.fromLat, job.fromLng) > fromRadius) return false;
    }
    if (toLocation.trim() && toRadius > 0) {
      const c = resolveCityCoords(toLocation, geocodeCache);
      if (c && haversineKm(c.lat, c.lng, job.toLat, job.toLng) > toRadius) return false;
    }
    return true;
  });
}
