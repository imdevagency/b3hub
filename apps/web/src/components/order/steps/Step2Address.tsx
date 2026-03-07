'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin, X } from 'lucide-react';

// ── Latvian city suggestions for fallback autocomplete ─────────────────────────

const LV_CITIES = [
  'Rīga',
  'Daugavpils',
  'Liepāja',
  'Jelgava',
  'Jūrmala',
  'Ventspils',
  'Rēzekne',
  'Valmiera',
  'Jēkabpils',
  'Ogre',
  'Tukums',
  'Bauska',
  'Kuldīga',
  'Sigulda',
  'Cēsis',
  'Saldus',
  'Talsi',
  'Dobele',
  'Ādaži',
  'Mārupe',
  'Stopiņi',
  'Ķekava',
  'Olaine',
  'Salaspils',
  'Ropažu novads',
  'Babīte',
  'Carnikava',
];

interface Suggestion {
  label: string;
  sublabel?: string;
}

interface Props {
  value: string;
  onAddressChange: (address: string, lat?: number, lng?: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Address({ value, onAddressChange, onNext, onBack }: Props) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const googleInputRef = useRef<HTMLInputElement>(null);

  // ── Google Places Autocomplete (if API key is available) ────────────────────
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!googleKey) return;
    // Load Google Maps script once
    if (document.getElementById('gmap-script')) {
      initAutocomplete();
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmap-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&libraries=places&language=lv`;
    script.async = true;
    script.onload = initAutocomplete;
    document.head.appendChild(script);
  }, [googleKey]);

  function initAutocomplete() {
    if (!googleInputRef.current || !(window as any).google) return;
    const ac = new (window as any).google.maps.places.Autocomplete(googleInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'lv' },
      fields: ['formatted_address', 'geometry'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place?.formatted_address) {
        const addr = place.formatted_address;
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        setInput(addr);
        onAddressChange(addr, lat, lng);
      }
    });
    autocompleteRef.current = ac;
  }

  // ── Fallback local suggestions ───────────────────────────────────────────────
  function handleInputChange(val: string) {
    setInput(val);
    if (googleKey) {
      // Google Places handles it via the ref
      onAddressChange(val);
      return;
    }
    onAddressChange(val);
    if (val.length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = val.toLowerCase();
    const matches = LV_CITIES.filter((c) => c.toLowerCase().includes(lower))
      .slice(0, 6)
      .map((c) => ({ label: c, sublabel: 'Latvija' }));
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }

  function pickSuggestion(s: Suggestion) {
    const addr = `${s.label}, Latvija`;
    setInput(addr);
    onAddressChange(addr);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  // ── GPS geolocation ──────────────────────────────────────────────────────────
  async function handleGPS() {
    if (!navigator.geolocation) {
      setGpsError('Jūsu pārlūkprogramma neatbalsta atrašanās vietu.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          // Reverse geocode via Google if key available, else use coordinates
          if (googleKey) {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleKey}&language=lv`,
            );
            const data = await res.json();
            const addr =
              data.results?.[0]?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setInput(addr);
            onAddressChange(addr, lat, lng);
          } else {
            const addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            setInput(addr);
            onAddressChange(addr, lat, lng);
          }
        } catch {
          const addr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setInput(addr);
          onAddressChange(addr, lat, lng);
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? 'Piekļuve atrašanās vietai liegta. Ļaujiet pārlūkam piekļūt GPS.'
            : 'Neizdevās noteikt atrašanās vietu.',
        );
        setGpsLoading(false);
      },
      { timeout: 10000 },
    );
  }

  const isValid = input.trim().length >= 4;

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900">Kur piegādāt konteineru?</h2>
        <p className="text-gray-500 text-sm">Ievadiet precīzu adresi vai izmantojiet GPS</p>
      </div>

      {/* Address input */}
      <div className="space-y-3">
        <div className="relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none z-10" />

          {/* Google Places input (hidden when no key) */}
          {googleKey ? (
            <input
              ref={googleInputRef}
              type="text"
              defaultValue={value}
              placeholder="Iela, mājas nr., pilsēta"
              className="w-full rounded-2xl border-2 border-gray-200 py-4 pl-12 pr-10 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
              onChange={(e) => setInput(e.target.value)}
            />
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={input}
                placeholder="Iela, mājas nr., pilsēta vai pasta indekss"
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-full rounded-2xl border-2 border-gray-200 py-4 pl-12 pr-10 text-base text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-50"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && (
                <div className="absolute top-full mt-1 left-0 right-0 rounded-2xl border bg-white shadow-xl z-30 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={() => pickSuggestion(s)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-red-50 transition-colors text-left border-b last:border-0"
                    >
                      <MapPin className="size-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{s.label}</p>
                        {s.sublabel && <p className="text-xs text-gray-500">{s.sublabel}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {input && (
            <button
              onClick={() => {
                setInput('');
                onAddressChange('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 z-10"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* GPS button */}
        <button
          onClick={handleGPS}
          disabled={gpsLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-gray-300 py-3.5 text-sm font-semibold text-gray-600 transition-all hover:border-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {gpsLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          {gpsLoading ? 'Nosaka atrašanās vietu...' : 'Izmantot manu atrašanās vietu'}
        </button>

        {gpsError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {gpsError}
          </p>
        )}
      </div>

      {/* Map preview placeholder (shown when address is set) */}
      {isValid && (
        <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 h-32 flex items-center justify-center gap-3 text-gray-500 text-sm">
          <MapPin className="size-5 text-red-500" />
          <span className="font-medium text-gray-700 truncate max-w-[80%]">{input}</span>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-2xl border-2 border-gray-200 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Atpakaļ
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-[2] rounded-2xl bg-red-600 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          Rādīt piedāvājumus
        </button>
      </div>
    </div>
  );
}
