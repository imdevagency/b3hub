/**
 * AddressAutocomplete UI component.
 * Uses the backend /maps/autocomplete + /maps/place-details proxy.
 * No client-side Google Maps SDK needed — works for anonymous users too.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Search } from 'lucide-react';
import { API_URL } from '@/lib/api/common';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlaceAddress {
  address: string;
  city: string;
  postal: string;
  lat?: number;
  lng?: number;
}

interface Suggestion {
  place_id: string;
  description: string;
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

// ── Parse description into address parts ─────────────────────────────────────
// Google Places descriptions for Baltic market:
//   "Iela 1, Rajons, Rīga, Latvija"  → address: "Iela 1", city: "Rīga"
//   "Iela, Rajons, Rīga"             → address: "Iela",   city: "Rīga"
//   "Rīga, Latvija"                  → address: "Rīga",   city: "Rīga"
const COUNTRY_SUFFIXES = ['latvija', 'lietuva', 'igaunija', 'latvia', 'lithuania', 'estonia'];
function parseDescription(description: string): { address: string; city: string; postal: string } {
  const parts = description.split(',').map((p) => p.trim());
  const lastIsCountry = COUNTRY_SUFFIXES.some((c) =>
    parts[parts.length - 1].toLowerCase().includes(c),
  );
  // The city is the second-to-last part when a country suffix is present,
  // or the last part otherwise.
  const cityIdx = lastIsCountry ? parts.length - 2 : parts.length - 1;
  return {
    address: parts[0] ?? description,
    city: cityIdx >= 0 ? (parts[cityIdx] ?? '') : '',
    postal: '',
  };
}

function splitDescription(description: string): { main: string; secondary: string } {
  const idx = description.indexOf(',');
  if (idx === -1) return { main: description, secondary: '' };
  return { main: description.slice(0, idx), secondary: description.slice(idx + 1).trim() };
}

// Keep exported so existing callers (SkipHireWizard, TransportWizard etc.)
// can still load the Maps JS SDK for their embedded google.maps.Map instances.
const LOADING_CALLBACKS: (() => void)[] = [];
let sdkState: 'idle' | 'loading' | 'ready' = 'idle';

export function loadGoogleMapsScript(apiKey: string, onReady: () => void) {
  if (typeof window === 'undefined') return;
  if (sdkState === 'ready') {
    onReady();
    return;
  }
  LOADING_CALLBACKS.push(onReady);
  if (sdkState === 'loading') return;
  sdkState = 'loading';
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=lv`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    sdkState = 'ready';
    LOADING_CALLBACKS.forEach((cb) => cb());
    LOADING_CALLBACKS.length = 0;
  };
  script.onerror = () => {
    sdkState = 'idle';
    LOADING_CALLBACKS.length = 0;
  };
  document.head.appendChild(script);
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Prevents the debounce from re-fetching / re-opening the dropdown after
  // the user selects a suggestion (value changes programmatically, not via typing).
  const userIsTypingRef = useRef(false);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recalculate dropdown position
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

  // Debounced fetch via backend proxy — only runs when the user is actually typing.
  useEffect(() => {
    if (!userIsTypingRef.current) {
      // value changed programmatically (e.g. after a suggestion was selected)
      return;
    }
    if (!value || value.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/maps/autocomplete?input=${encodeURIComponent(value)}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const results = data.suggestions ?? [];
        setSuggestions(results);
        setLoading(false);
        if (results.length > 0) setOpen(true);
      } catch {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const handleSelect = async (s: Suggestion) => {
    // Mark as NOT typing so subsequent value changes don't re-trigger debounce.
    userIsTypingRef.current = false;
    setOpen(false);
    setLoading(false);
    setSuggestions([]);

    const parsed = parseDescription(s.description);
    // Show the full suggestion description immediately so the user sees
    // something meaningful while the place-details fetch is in flight.
    onChange(s.description);

    try {
      const res = await fetch(
        `${API_URL}/maps/place-details?place_id=${encodeURIComponent(s.place_id)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { location?: { lat: number; lng: number } };
        onSelect({ ...parsed, lat: data.location?.lat, lng: data.location?.lng });
        return;
      }
    } catch {
      // fall through to description-only result
    }

    onSelect(parsed);
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
            userIsTypingRef.current = true;
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
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
        suggestions.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-background rounded-2xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <ul className="max-h-72 overflow-y-auto w-full divide-y divide-border/40 flex flex-col scrollbar-thin">
              {suggestions.map((s) => {
                const { main, secondary } = splitDescription(s.description);
                return (
                  <li key={s.place_id}>
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
                          {main}
                        </span>
                        {secondary && (
                          <span className="text-[13px] font-medium text-muted-foreground truncate pr-2">
                            {secondary}
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
