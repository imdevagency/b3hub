/**
 * Step2Address — Order wizard step 2 (delivery address).
 * Uses AddressAutocomplete: search bar with Google Places suggestions.
 */
'use client';

import { useEffect, useState } from 'react';
import { Bookmark, ChevronDown, ChevronUp, Loader2, MapPin, Star } from 'lucide-react';
import { AddressAutocomplete, type PlaceAddress } from '@/components/ui/AddressAutocomplete';
import { getSavedAddresses, type SavedAddress } from '@/lib/api/saved-addresses';

interface Props {
  value: string;
  lat?: number;
  lng?: number;
  onAddressChange: (
    address: string,
    lat?: number,
    lng?: number,
    city?: string,
    postal?: string,
  ) => void;
  onNext: () => void;
  onBack: () => void;
  /** Override the step heading (defaults to skip-hire wording) */
  title?: string;
  /** Override the step subtitle */
  subtitle?: string;
  /** Override the "Next" button label */
  nextLabel?: string;
}

export function Step2Address({
  value,
  lat: _lat,
  lng: _lng,
  onAddressChange,
  onNext,
  onBack,
  title,
  subtitle,
  nextLabel,
}: Props) {
  const [input, setInput] = useState(value);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedLoading, setSavedLoading] = useState(true);

  useEffect(() => {
    getSavedAddresses()
      .then(setSavedAddresses)
      .catch(() => {})
      .finally(() => setSavedLoading(false));
  }, []);

  function handleSavedSelect(saved: SavedAddress) {
    const addr = `${saved.address}, ${saved.city}`;
    setInput(addr);
    onAddressChange(addr, saved.lat ?? undefined, saved.lng ?? undefined, saved.city);
    setSavedOpen(false);
  }

  function handleMapPickerSelect(place: PlaceAddress) {
    if (place.lat == null || place.lng == null) return;
    const addr = [place.address, place.city].filter(Boolean).join(', ');
    setInput(addr);
    onAddressChange(addr, place.lat, place.lng, place.city);
  }

  const isValid = !!(_lat && _lng);

  return (
    <div className="flex flex-col space-y-5 animate-in fade-in slide-in-from-bottom-2">
      <div>
        <h2 className="text-lg font-bold">{title ?? 'Kur piegādāt konteineru?'}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {subtitle ?? 'Ievadiet precīzu adresi vai izmantojiet GPS'}
        </p>
      </div>

      {/* Address input — shared custom component */}
      <div className="space-y-2">
        {/* Saved addresses quick-pick */}
        {(savedLoading || savedAddresses.length > 0) && (
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setSavedOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <Bookmark className="size-4 shrink-0" />
              <span className="flex-1 text-left">Saglabātās adreses</span>
              {savedLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : savedOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
            {savedOpen && !savedLoading && (
              <div className="border-t border-border divide-y divide-border">
                {savedAddresses.map((saved) => (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => handleSavedSelect(saved)}
                    disabled={!saved.lat}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{saved.label}</span>
                        {saved.isDefault && (
                          <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {saved.address}, {saved.city}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <AddressAutocomplete
          value={input}
          onChange={(v) => {
            setInput(v);
            onAddressChange(v);
          }}
          onSelect={handleMapPickerSelect}
          placeholder="Iela, mājas numurs, pilsēta..."
          className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none h-14 text-base font-medium"
        />
      </div>

      {/* Confirmed address pill */}
      {isValid && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-50 ring-1 ring-green-200">
          <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm font-medium text-green-800 truncate">{input}</p>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 rounded-full border-2 border-border/60 py-3.5 text-base font-bold text-foreground hover:bg-muted/50 transition-colors"
        >
          Atpakaļ
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-[2] rounded-full bg-foreground py-3.5 text-base font-bold text-background shadow-md hover:shadow-lg transition-all disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          {nextLabel ?? 'Rādīt piedāvājumus'}
        </button>
      </div>
    </div>
  );
}
