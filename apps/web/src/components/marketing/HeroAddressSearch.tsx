'use client';

/**
 * HeroAddressSearch
 *
 * Address autocomplete bar for the marketing hero.
 * On address selection → navigates to /order with address pre-filled as URL params
 * so downstream wizards can skip the address step.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ArrowRight, Loader2 } from 'lucide-react';
import {
  AddressAutocomplete,
  loadGoogleMapsScript,
  type PlaceAddress,
} from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

export function HeroAddressSearch() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<PlaceAddress | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = getGoogleMapsPublicKey();
    if (!key) return;
    loadGoogleMapsScript(key, () => setMapsReady(true));
  }, []);

  function handleSelect(place: PlaceAddress) {
    setSelected(place);
    const full = place.city ? `${place.address}, ${place.city}` : place.address;
    setAddress(full);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected && !address.trim()) return;
    setLoading(true);
    const params = new URLSearchParams();
    const displayAddress = selected
      ? selected.city
        ? `${selected.address}, ${selected.city}`
        : selected.address
      : address.trim();
    params.set('address', displayAddress);
    if (selected?.lat) params.set('lat', String(selected.lat));
    if (selected?.lng) params.set('lng', String(selected.lng));
    if (selected?.city) params.set('city', selected.city);
    router.push(`/order?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        {mapsReady ? (
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={handleSelect}
            placeholder="Ievadiet piegādes adresi..."
            className="h-14 text-base rounded-2xl border-border/60 bg-background shadow-sm"
          />
        ) : (
          <div className="relative flex items-center">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none z-10" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ievadiet piegādes adresi..."
              className="w-full pl-11 pr-4 h-14 text-base rounded-2xl border border-border/60 bg-background shadow-sm outline-none focus:ring-2 focus:ring-foreground/20 font-medium"
            />
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={loading || !address.trim()}
        className="h-14 px-6 rounded-2xl bg-foreground text-background font-bold text-base flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0 whitespace-nowrap"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <>
            Skatīt piedāvājumus
            <ArrowRight className="size-5" />
          </>
        )}
      </button>
    </form>
  );
}
