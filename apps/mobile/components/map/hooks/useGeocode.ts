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

const GOOGLE_KEY = 'AIzaSyBNIZk1VBorD3kU02BNjz_2m4Dlek_gsx8';
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

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
  /** Same as reverseGeocode but also extracts city from address components. */
  reverseGeocodeWithCity: (lat: number, lng: number) => Promise<AddressWithCity>;
  loading: boolean;
}

export function useGeocode(): UseGeocodeResult {
  const [loading, setLoading] = useState(false);

  const forwardGeocode = useCallback(async (query: string): Promise<GeocodeSuggestion[]> => {
    if (!query.trim()) return [];
    setLoading(true);
    try {
      const url =
        `${GEOCODE_BASE}?address=${encodeURIComponent(query)}` +
        `&language=lv&region=lv&components=country:LV|country:LT|country:EE` +
        `&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (json.results ?? []).slice(0, 5).map((r: any) => ({
        id: r.place_id as string,
        place_name: r.formatted_address as string,
        center: [r.geometry.location.lng, r.geometry.location.lat] as [number, number],
      }));
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const components: any[] = result.address_components ?? [];
          const cityComp = components.find(
            (c: { types: string[] }) =>
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

  return { forwardGeocode, reverseGeocode, reverseGeocodeWithCity, loading };
}
