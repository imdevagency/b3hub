/**
 * useGeocode — Google Maps Geocoding API helpers as a React hook.
 *
 * Centralises all geocoding logic so AddressPicker and any other screen
 * don't duplicate fetch code.
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
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

const GOOGLE_KEY = getGoogleMapsPublicKey();
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const AUTOCOMPLETE_BASE = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACE_DETAILS_BASE = 'https://maps.googleapis.com/maps/api/place/details/json';

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

interface GoogleGeocodeResult {
  place_id?: string;
  formatted_address?: string;
}

interface AddressComponent {
  types: string[];
  long_name: string;
  short_name: string;
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

  const mapPredictions = useCallback((predictions: GooglePrediction[]): GeocodeSuggestion[] => {
    return predictions.slice(0, 8).map((p) => ({
      id: p.place_id as string,
      place_name: p.description as string,
      center: [0, 0] as [number, number],
    }));
  }, []);

  const fetchAutocomplete = useCallback(
    async (query: string, useCountryFilter: boolean): Promise<GooglePrediction[]> => {
      const url =
        `${AUTOCOMPLETE_BASE}?input=${encodeURIComponent(query)}` +
        `&language=lv&region=lv&location=56.9496,24.1052&radius=120000` +
        `${useCountryFilter ? '&components=country:lv|country:lt|country:ee' : ''}` +
        `&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === 'OK') return (json.predictions ?? []) as GooglePrediction[];
      return [];
    },
    [],
  );

  const fetchAddressFallback = useCallback(async (query: string): Promise<GeocodeSuggestion[]> => {
    const url =
      `${GEOCODE_BASE}?address=${encodeURIComponent(query)}` +
      `&language=lv&region=lv&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK') return [];
    return ((json.results ?? []) as GoogleGeocodeResult[])
      .slice(0, 5)
      .filter((r) => !!r.place_id && !!r.formatted_address)
      .map((r) => ({
        id: r.place_id as string,
        place_name: r.formatted_address as string,
        center: [0, 0] as [number, number],
      }));
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

  /** Resolve a place_id → [lng, lat] using Place Details API. */
  const resolvePlace = useCallback(
    async (placeId: string): Promise<[number, number] | null> => {
      try {
        const url =
          `${PLACE_DETAILS_BASE}?place_id=${encodeURIComponent(placeId)}` +
          `&fields=geometry&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        const loc = json.result?.geometry?.location;
        if (!loc) return null;
        return [loc.lng as number, loc.lat as number];
      } catch {
        return null;
      }
    },
    [],
  );

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    setLoading(true);
    try {
      const url = `${GEOCODE_BASE}?latlng=${lat},${lng}&language=lv&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      return (json.results?.[0]?.formatted_address as string | undefined) ?? '';
    } catch {
      return '';
    } finally {
      setLoading(false);
    }
  }, []);

  const reverseGeocodeWithCity = useCallback(
    async (lat: number, lng: number): Promise<AddressWithCity> => {
      setLoading(true);
      try {
        const url = `${GEOCODE_BASE}?latlng=${lat},${lng}&language=lv&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        const result = json.results?.[0];
        if (result) {
          const address = result.formatted_address as string;
          const components: AddressComponent[] = result.address_components ?? [];
          const cityComp = components.find(
            (c) =>
              c.types.includes('locality') || c.types.includes('administrative_area_level_2'),
          );
          return { address, city: (cityComp?.long_name as string) ?? '' };
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '' };
    },
    [],
  );

  return { forwardGeocode, resolvePlace, reverseGeocode, reverseGeocodeWithCity, loading };
}
