'use client';

import { useEffect, useRef } from 'react';

// ── Script loader (singleton — loads the script once) ────────────────────────

let scriptState: 'idle' | 'loading' | 'ready' = 'idle';
const pendingCallbacks: Array<() => void> = [];

function loadGoogleMapsScript(apiKey: string, onReady: () => void) {
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
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep stable refs for callbacks so the effect doesn't re-run on every render
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  // eslint-disable-next-line react-hooks/refs
  onChangeRef.current = onChange;
  // eslint-disable-next-line react-hooks/refs
  onSelectRef.current = onSelect;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!apiKey || !inputRef.current) return;

    loadGoogleMapsScript(apiKey, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google || !inputRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: ['lv', 'lt', 'ee'] },
        fields: ['address_components', 'formatted_address'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        let route = '';
        let streetNumber = '';
        let city = '';
        let postal = '';

        for (const component of place.address_components as Array<{
          long_name: string;
          types: string[];
        }>) {
          const type = component.types[0];
          if (type === 'route') route = component.long_name;
          else if (type === 'street_number') streetNumber = component.long_name;
          else if (type === 'locality') city = component.long_name;
          else if (type === 'postal_code') postal = component.long_name;
        }

        const address = route
          ? `${route}${streetNumber ? ' ' + streetNumber : ''}`
          : (place.formatted_address ?? '');

        onChangeRef.current(address);
        onSelectRef.current({ address, city, postal });
      });
    });
    // intentionally run once on mount
  }, []);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="off"
    />
  );
}
