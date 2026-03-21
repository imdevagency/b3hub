/**
 * AddressAutocomplete UI component.
 * Text input wired to the Google Places AutocompleteService API for custom address search UI.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { MapPin, Loader2 } from 'lucide-react';

// ── Script loader (singleton — loads the script once) ────────────────────────

let scriptState: 'idle' | 'loading' | 'ready' = 'idle';
const pendingCallbacks: Array<() => void> = [];

export function loadGoogleMapsScript(apiKey: string, onReady: () => void) {
  if (scriptState === 'ready') {
    onReady();
    return;
  }
  pendingCallbacks.push(onReady);
  if (scriptState === 'loading') return;
  scriptState = 'loading';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__googleMapsPlacesInit = () => {
    scriptState = 'ready';
    pendingCallbacks.forEach((cb) => cb());
    pendingCallbacks.length = 0;
  };

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=lv&callback=__googleMapsPlacesInit`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlaceAddress {
  address: string; // street + number
  city: string;
  postal: string;
  lat?: number;
  lng?: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: PlaceAddress) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  className,
  id,
}: Props) {
  const [isOpen, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [predictions, setPredictions] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Google Maps services
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteService = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placesService = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionToken = useRef<any>(null);

  useEffect(() => {
    const apiKey = getGoogleMapsPublicKey();
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google) return;

      autocompleteService.current = new google.maps.places.AutocompleteService();
      placesService.current = new google.maps.places.PlacesService(document.createElement('div'));
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    });
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (!value || value.length < 2) {
      setPredictions([]);
      return;
    }
    
    if (!autocompleteService.current) return;

    setLoading(true);
    const timeoutId = setTimeout(() => {
      autocompleteService.current.getPlacePredictions({
        input: value,
        componentRestrictions: { country: ['lv', 'lt', 'ee'] },
        types: ['address'],
        sessionToken: sessionToken.current,
      }, (results: any, status: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        setLoading(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
          if (document.activeElement?.id === id || document.activeElement?.closest('#' + id)) {
            setOpen(true);
          }
        } else {
          setPredictions([]);
        }
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, id]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelect = (prediction: any) => {
    setOpen(false);
    onChange(prediction.description);
    
    if (!placesService.current) return;

    placesService.current.getDetails({
      placeId: prediction.place_id,
      fields: ['address_components', 'formatted_address', 'geometry'],
      sessionToken: sessionToken.current,
    }, (place: any, status: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place) return;

      let route = '';
      let streetNumber = '';
      let city = '';
      let postal = '';

      const comps = place.address_components || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const component of comps as any[]) {
        const type = component.types[0];
        if (type === 'route') route = component.long_name;
        else if (type === 'street_number') streetNumber = component.long_name;
        else if (type === 'locality') city = component.long_name;
        else if (type === 'postal_code') postal = component.long_name;
      }

      const address = route
        ? `${route}${streetNumber ? ' ' + streetNumber : ''}`
        : (place.formatted_address ?? '');

      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();

      onChange(address);
      onSelect({ address, city, postal, lat, lng });

      // Reset session token after a selection
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="new-password"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {isOpen && predictions.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-64 overflow-y-auto w-full divide-y divide-gray-50 flex flex-col scrollbar-thin">
            {predictions.map((p) => {
              const mainText = p.structured_formatting?.main_text || p.description;
              const secondaryText = p.structured_formatting?.secondary_text || '';
              return (
                <li key={p.place_id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50/80 active:bg-gray-100 transition-colors flex items-start gap-3 group focus:outline-none focus:bg-gray-50"
                    onClick={() => handleSelect(p)}
                  >
                    <div className="mt-0.5 min-w-8 shrink-0 flex items-center justify-center bg-gray-100/50 rounded-full h-8 w-8 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-gray-400">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14px] font-medium text-gray-900 truncate pr-2">
                        {mainText}
                      </span>
                      {secondaryText && (
                        <span className="text-[13px] text-gray-500 truncate pr-2">
                          {secondaryText}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
