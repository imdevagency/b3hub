/**
 * useGeocode — Geocoding API helpers as a React hook.
 *
 * All requests are proxied through the B3Hub backend (/maps/*), keeping
 * Google API keys server-side and avoiding platform-restriction errors.
 *
 * Usage:
 *   const { forwardGeocode, reverseGeocode, loading } = useGeocode();
 *
 *   // get address string from coords
 *   const label = await reverseGeocode(lat, lng);
 *
 *   // get autocomplete suggestions
 *   const suggestions = await forwardGeocode('Brīvības iela');
 */
import { useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { API_URL } from '@/lib/api/common';

export interface GeocodeSuggestion {
  id: string; // Google place_id
  place_name: string;
  /** [longitude, latitude] — populated after resolvePlace(); starts as [0, 0] */
  center: [number, number];
}

interface GooglePrediction {
  place_id: string;
  description: string;
}

export interface AddressWithCity {
  address: string;
  city: string;
}

interface UseGeocodeResult {
  /** Autocomplete suggestions from the Places API — fast, works on partial input. */
  forwardGeocode: (query: string) => Promise<GeocodeSuggestion[]>;
  /** Fetch [lng, lat] for a place_id returned by forwardGeocode. */
  resolvePlace: (placeId: string) => Promise<[number, number] | null>;
  reverseGeocode: (lat: number, lng: number) => Promise<string>;
  /** Same as reverseGeocode but also extracts city from address components. */
  reverseGeocodeWithCity: (lat: number, lng: number) => Promise<AddressWithCity>;
  loading: boolean;
}

export function useGeocode(): UseGeocodeResult {
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const authHeaders = useCallback((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const mapPredictions = useCallback((predictions: GooglePrediction[]): GeocodeSuggestion[] => {
    return predictions.slice(0, 8).map((p) => ({
      id: p.place_id as string,
      place_name: p.description as string,
      center: [0, 0] as [number, number],
    }));
  }, []);

  const fetchAutocomplete = useCallback(
    async (query: string, _useCountryFilter: boolean): Promise<GooglePrediction[]> => {
      const url = `${API_URL}/maps/autocomplete?input=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return [];
      const json = await res.json() as { suggestions?: GooglePrediction[] };
      return json.suggestions ?? [];
    },
    [authHeaders],
  );

  const fetchAddressFallback = useCallback(async (_query: string): Promise<GeocodeSuggestion[]> => {
    // Backend autocomplete already fallbacks internally; returning empty here is safe.
    return [];
  }, []);

  const forwardGeocode = useCallback(async (query: string): Promise<GeocodeSuggestion[]> => {
    if (!query.trim()) return [];
    setLoading(true);
    try {
      // 1) Start with local country filter for relevance.
      const local = await fetchAutocomplete(query, true);
      if (local.length > 0) return mapPredictions(local);

      // 2) Fallback without country filter so users can find broader POIs/addresses.
      const global = await fetchAutocomplete(query, false);
      if (global.length > 0) return mapPredictions(global);

      // 3) Final fallback via Geocoding API for edge-case address formats.
      return await fetchAddressFallback(query);
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [fetchAutocomplete, mapPredictions, fetchAddressFallback]);

  /** Resolve a place_id → [lng, lat] using Place Details API via backend proxy. */
  const resolvePlace = useCallback(
    async (placeId: string): Promise<[number, number] | null> => {
      try {
        const url = `${API_URL}/maps/place-details?place_id=${encodeURIComponent(placeId)}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return null;
        const json = await res.json() as { location?: { lat: number; lng: number } };
        const loc = json.location;
        if (!loc) return null;
        return [loc.lng, loc.lat];
      } catch {
        return null;
      }
    },
    [authHeaders],
  );

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    setLoading(true);
    try {
      const url = `${API_URL}/maps/reverse-geocode?lat=${lat}&lng=${lng}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return '';
      const json = await res.json() as { address?: string };
      return json.address ?? '';
    } catch {
      return '';
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const reverseGeocodeWithCity = useCallback(
    async (lat: number, lng: number): Promise<AddressWithCity> => {
      setLoading(true);
      try {
        const url = `${API_URL}/maps/reverse-geocode?lat=${lat}&lng=${lng}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '' };
        const json = await res.json() as { address?: string };
        const address = json.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        // Extract city from the address string (first comma-separated part after street, if present)
        const parts = address.split(',').map((s) => s.trim());
        const city = parts.length >= 2 ? (parts[1] ?? '') : '';
        return { address, city };
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '' };
    },
    [authHeaders],
  );

  return { forwardGeocode, resolvePlace, reverseGeocode, reverseGeocodeWithCity, loading };
}
