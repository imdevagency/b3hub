/**
 * AddressAutocomplete UI component.
 * Text input wired to the Google Places AutocompleteSuggestion API for custom address search UI.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Search } from 'lucide-react';

/// <reference types="@types/google.maps" />

// Extend Window to declare the custom Maps init callback property
declare global {
  interface Window {
    __googleMapsPlacesInit?: () => void;
  }
}

// ── Script loader (singleton — loads the script once) ────────────────────────

let scriptState: 'idle' | 'loading' | 'ready' = 'idle';
const pendingCallbacks: Array<() => void> = [];

export function loadGoogleMapsScript(apiKey: string, onReady: () => void) {
  // Already fully loaded (window.google.maps exists from any loader)
  if (typeof window !== 'undefined' && window.google?.maps) {
    scriptState = 'ready';
    onReady();
    return;
  }

  if (scriptState === 'ready') {
    onReady();
    return;
  }

  pendingCallbacks.push(onReady);

  if (scriptState === 'loading') return;

  // Another loader (e.g. @react-google-maps/api) may have already injected the script tag.
  // Avoid duplicate injection — just wait for it to complete.
  const existing =
    typeof document !== 'undefined'
      ? document.querySelector<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]')
      : null;

  if (existing) {
    scriptState = 'loading';
    // Poll until window.google.maps becomes available
    const poll = window.setInterval(() => {
      if (window.google?.maps) {
        window.clearInterval(poll);
        scriptState = 'ready';
        pendingCallbacks.forEach((cb) => cb());
        pendingCallbacks.length = 0;
      }
    }, 50);
    return;
  }

  scriptState = 'loading';

  window.__googleMapsPlacesInit = () => {
    scriptState = 'ready';
    pendingCallbacks.forEach((cb) => cb());
    pendingCallbacks.length = 0;
  };

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=lv&loading=async&callback=__googleMapsPlacesInit`;
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
  const [predictions, setPredictions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Google Maps session token
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  useEffect(() => {
    const apiKey = getGoogleMapsPublicKey();
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey, () => {
      const google = window.google;
      if (!google) return;

      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    });
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideInput = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideInput && !insideDropdown) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recalculate dropdown position whenever it opens or window resizes/scrolls
  useEffect(() => {
    function updatePosition() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  // Debounced fetch
  useEffect(() => {
    if (!value || value.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPredictions([]);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const g = window.google;
        if (!g?.maps?.places?.AutocompleteSuggestion) return;

        const { suggestions } =
          await g.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            includedRegionCodes: ['lv'],
            types: ['address'],
            sessionToken: sessionToken.current,
          });

        setLoading(false);
        setPredictions(suggestions);
        if (
          suggestions.length > 0 &&
          (document.activeElement?.id === id || document.activeElement?.closest('#' + id))
        ) {
          setOpen(true);
        }
      } catch {
        setLoading(false);
        setPredictions([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value, id]);

  const handleSelect = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    setOpen(false);
    const pp = suggestion.placePrediction!;
    onChange(pp.text.text);

    try {
      const place = pp.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'formattedAddress', 'location'] });

      let route = '';
      let streetNumber = '';
      let city = '';
      let postal = '';

      const comps = place.addressComponents || [];
      for (const component of comps) {
        const type = component.types[0];
        if (type === 'route') route = component.longText ?? '';
        else if (type === 'street_number') streetNumber = component.longText ?? '';
        else if (type === 'locality') city = component.longText ?? '';
        else if (type === 'postal_code') postal = component.longText ?? '';
      }

      const address = route
        ? `${route}${streetNumber ? ' ' + streetNumber : ''}`
        : (place.formattedAddress ?? '');

      const lat = place.location?.lat();
      const lng = place.location?.lng();

      onChange(address);
      onSelect({ address, city, postal, lat, lng });
    } catch {
      // fallback: use the description as-is
      onSelect({ address: pp.text.text, city: '', postal: '' });
    }

    // Reset session token after a selection
    sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
  };

  return (
    <div className="relative w-full group" ref={containerRef}>
      <div className="relative flex items-center">
        <Search className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none z-10 shrink-0" />
        <Input
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
          className={`pl-14 sm:pl-16 pr-10 bg-transparent ${className ?? ''}`}
          autoComplete="new-password"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {isOpen &&
        predictions.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-background rounded-2xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <ul className="max-h-72 overflow-y-auto w-full divide-y divide-border/40 flex flex-col scrollbar-thin">
              {predictions.map((s) => {
                const pp = s.placePrediction!;
                const mainText = pp.mainText?.text || pp.text.text;
                const secondaryText = pp.secondaryText?.text || '';
                return (
                  <li key={pp.placeId}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3.5 hover:bg-muted/40 active:bg-muted transition-colors flex items-center gap-3.5 group/item focus:outline-none focus:bg-muted/60"
                      onClick={() => handleSelect(s)}
                    >
                      <div className="shrink-0 flex items-center justify-center bg-muted rounded-full h-10 w-10 group-hover/item:bg-foreground group-hover/item:text-background transition-colors text-muted-foreground">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[15px] font-bold text-foreground truncate pr-2">
                          {mainText}
                        </span>
                        {secondaryText && (
                          <span className="text-[13px] font-medium text-muted-foreground truncate pr-2">
                            {secondaryText}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
