'use client';

/**
 * HeroAddressSearch
 *
 * Address autocomplete bar for the marketing hero.
 * On address selection → navigates to /register with address pre-filled as URL params
 * so the registration flow can capture delivery context.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { AddressAutocomplete, type PlaceAddress } from '@/components/ui/AddressAutocomplete';

export function HeroAddressSearch() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [selected, setSelected] = useState<PlaceAddress | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSelect(place: PlaceAddress) {
    setSelected(place);
    const full = place.city ? `${place.address}, ${place.city}` : place.address;
    setAddress(full);
  }

  function handleAddressChange(value: string) {
    // Clear the picked selection whenever the user edits the text manually
    setSelected(null);
    setAddress(value);
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
    router.push(`/register?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex flex-col sm:flex-row items-center gap-3 sm:gap-0 w-full max-w-2xl mx-auto sm:rounded-full bg-transparent sm:bg-background sm:border sm:border-[#E5E5E5] sm:shadow-sm sm:p-2"
    >
      <div className="relative w-full sm:flex-1 bg-background sm:bg-transparent border border-[#E5E5E5] sm:border-0 rounded-full sm:rounded-none shadow-sm sm:shadow-none overflow-hidden">
        <AddressAutocomplete
          value={address}
          onChange={handleAddressChange}
          onSelect={handleSelect}
          placeholder="Ievadiet piegādes adresi..."
          className="h-14 text-base sm:text-lg border-0 shadow-none outline-none focus-visible:ring-0 bg-transparent hover:bg-transparent font-light"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className={`w-full sm:w-auto h-14 px-8 sm:px-12 rounded-full font-medium text-base sm:text-lg flex items-center justify-center gap-2.5 transition-colors shrink-0 whitespace-nowrap ${
          selected
            ? 'bg-[#203728] text-white hover:bg-[#2d4f3a]'
            : 'bg-[#E0E0E0] text-white hover:bg-[#D4D4D4] opacity-50 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <>
            Tālāk
            <ArrowRight className="size-5" />
          </>
        )}
      </button>
    </form>
  );
}
