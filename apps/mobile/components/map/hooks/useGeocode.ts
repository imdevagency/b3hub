/**
 * useGeocode — Mapbox Geocoding API helpers as a React hook.
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

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
const BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export interface GeocodeSuggestion {
  id: string;
  place_name: string;
  /** [longitude, latitude] */
  center: [number, number];
}

export interface AddressWithCity {
  address: string;
  city: string;
}

interface UseGeocodeResult {
  forwardGeocode: (query: string) => Promise<GeocodeSuggestion[]>;
  reverseGeocode: (lat: number, lng: number) => Promise<string>;
  /** Same as reverseGeocode but also extracts city from Mapbox context. */
  reverseGeocodeWithCity: (lat: number, lng: number) => Promise<AddressWithCity>;
  loading: boolean;
}

export function useGeocode(): UseGeocodeResult {
  const [loading, setLoading] = useState(false);

  const forwardGeocode = useCallback(async (query: string): Promise<GeocodeSuggestion[]> => {
    if (!query.trim() || !TOKEN) return [];
    setLoading(true);
    try {
      const url =
        `${BASE}/${encodeURIComponent(query)}.json` +
        `?country=lv,lt,ee&language=lv&limit=5&access_token=${TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      return (json.features ?? []) as GeocodeSuggestion[];
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    if (!TOKEN) return '';
    setLoading(true);
    try {
      const url =
        `${BASE}/${lng},${lat}.json` +
        `?types=address,place&language=lv&access_token=${TOKEN}`;
      const res = await fetch(url);
      const json = await res.json();
      return (json.features?.[0]?.place_name as string | undefined) ?? '';
    } catch {
      return '';
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reverseGeocodeWithCity = useCallback(
    async (lat: number, lng: number): Promise<AddressWithCity> => {
      if (!TOKEN) return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '' };
      setLoading(true);
      try {
        const url =
          `${BASE}/${lng},${lat}.json` +
          `?types=address,place&language=lv&access_token=${TOKEN}`;
        const res = await fetch(url);
        const json = await res.json();
        const feature = json.features?.[0];
        if (feature) {
          const cityCtx = (feature.context ?? []).find(
            (c: { id: string; text: string }) => c.id.startsWith('place'),
          );
          return { address: feature.place_name as string, city: (cityCtx?.text as string) ?? '' };
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '' };
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { forwardGeocode, reverseGeocode, reverseGeocodeWithCity, loading };
}
