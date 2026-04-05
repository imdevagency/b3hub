/**
 * AddressMapPicker
 *
 * Drop-in address field with:
 *  - Google Places Autocomplete search bar
 *  - Interactive Google Map preview below
 *  - Draggable marker — drag to refine exact location, reverse-geocodes on drag-end
 *  - GPS "Use my location" button
 *
 * Usage:
 *   <AddressMapPicker
 *     value={address}
 *     lat={lat}
 *     lng={lng}
 *     onChange={(address) => setAddress(address)}
 *     onSelect={({ address, city, lat, lng }) => { ... }}
 *     placeholder="Ielas nosaukums, mājas nr., pilsēta"
 *   />
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { AddressAutocomplete, type PlaceAddress } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { Navigation, Loader2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PickedAddress = {
  address: string;
  city: string;
  postal: string;
  lat: number;
  lng: number;
};

interface Props {
  value: string;
  lat?: number | null;
  lng?: number | null;
  onChange: (value: string) => void;
  onSelect: (result: PickedAddress) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GOOGLE_KEY = getGoogleMapsPublicKey();
const LIBRARIES: ('places' | 'geometry')[] = ['places'];
const RIGA: google.maps.LatLngLiteral = { lat: 56.9496, lng: 24.1052 };
const MAP_CONTAINER = { width: '100%', height: '220px' };
const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: 'cooperative',
  clickableIcons: false,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AddressMapPicker({
  value,
  lat,
  lng,
  onChange,
  onSelect,
  placeholder,
  required,
  id,
  className,
}: Props) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_KEY,
    libraries: LIBRARIES,
    language: 'lv',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [reversing, setReversing] = useState(false);
  const [locating, setLocating] = useState(false);

  const pinPos: google.maps.LatLngLiteral | null =
    lat != null && lng != null ? { lat, lng } : null;

  // Initialise geocoder once Maps API is loaded
  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  }, [isLoaded]);

  // Pan map when pin changes externally (e.g. after autocomplete select)
  useEffect(() => {
    if (mapRef.current && pinPos) {
      mapRef.current.panTo(pinPos);
      mapRef.current.setZoom(15);
    }
  }, [pinPos?.lat, pinPos?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // ── Autocomplete handler ───────────────────────────────────────────────────

  const handleSelect = useCallback(
    (place: PlaceAddress) => {
      if (place.lat == null || place.lng == null) return;
      onSelect({ address: place.address, city: place.city, postal: place.postal ?? '', lat: place.lat, lng: place.lng });
    },
    [onSelect],
  );

  // ── Marker drag ────────────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !geocoderRef.current) return;
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setReversing(true);
      geocoderRef.current.geocode({ location: { lat: newLat, lng: newLng }, language: 'lv' }, (results, status) => {
        setReversing(false);
        if (status !== 'OK' || !results?.[0]) {
          onSelect({ address: value, city: '', postal: '', lat: newLat, lng: newLng });
          return;
        }
        const result = results[0];
        const comps = result.address_components ?? [];
        const route = comps.find((c) => c.types.includes('route'))?.long_name ?? '';
        const streetNo = comps.find((c) => c.types.includes('street_number'))?.long_name ?? '';
        const city = comps.find((c) => c.types.includes('locality'))?.long_name ?? '';
        const postal = comps.find((c) => c.types.includes('postal_code'))?.long_name ?? '';
        const address = route
          ? `${route}${streetNo ? ' ' + streetNo : ''}`
          : (result.formatted_address ?? '');
        onChange(address);
        onSelect({ address, city, postal, lat: newLat, lng: newLng });
      });
    },
    [value, onChange, onSelect],
  );

  // ── GPS button ─────────────────────────────────────────────────────────────

  const handleGPS = useCallback(async () => {
    if (!navigator.geolocation || !geocoderRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        geocoderRef.current!.geocode({ location: { lat: newLat, lng: newLng }, language: 'lv' }, (results, status) => {
          setLocating(false);
          if (status !== 'OK' || !results?.[0]) return;
          const result = results[0];
          const comps = result.address_components ?? [];
          const route = comps.find((c) => c.types.includes('route'))?.long_name ?? '';
          const streetNo = comps.find((c) => c.types.includes('street_number'))?.long_name ?? '';
          const city = comps.find((c) => c.types.includes('locality'))?.long_name ?? '';
          const postal = comps.find((c) => c.types.includes('postal_code'))?.long_name ?? '';
          const address = route
            ? `${route}${streetNo ? ' ' + streetNo : ''}`
            : (result.formatted_address ?? '');
          onChange(address);
          onSelect({ address, city, postal, lat: newLat, lng: newLng });
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [onChange, onSelect]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <AddressAutocomplete
        value={value}
        onChange={onChange}
        onSelect={handleSelect}
        placeholder={placeholder ?? 'Meklēt adresi...'}
        required={required}
        id={id}
        className={className}
      />

      {/* Map — only rendered once Maps API is ready */}
      {isLoaded && (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER}
            center={pinPos ?? RIGA}
            zoom={pinPos ? 15 : 11}
            options={MAP_OPTIONS}
            onLoad={onMapLoad}
          >
            {pinPos && (
              <MarkerF
                position={pinPos}
                draggable
                onDragEnd={handleDragEnd}
              />
            )}
          </GoogleMap>

          {/* Drag hint */}
          {pinPos && !reversing && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/70 px-3 py-1 text-[11px] font-medium text-white">
              Velc marķieri, lai precizētu vietu
            </div>
          )}

          {/* Reversing spinner overlay */}
          {reversing && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-gray-900/70 px-3 py-1 text-[11px] font-medium text-white">
              <Loader2 className="h-3 w-3 animate-spin" />
              Nosaka adresi...
            </div>
          )}

          {/* GPS button */}
          <button
            type="button"
            onClick={handleGPS}
            disabled={locating || !isLoaded}
            title="Izmantot manu atrašanās vietu"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-white shadow-md transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
