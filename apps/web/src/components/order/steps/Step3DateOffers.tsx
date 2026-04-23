/**
 * Step3DateOffers — Order wizard step 3 (date & carrier offers).
 * Shows available carrier quotes for the chosen date range;
 * user selects a preferred offer before checkout.
 */
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Loader2, Package, Star, Truck, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { getSkipHireQuotes, mapSkipSize, type SkipHireQuote } from '@/lib/api';
import { Calendar } from '@/components/ui/calendar';

// ── Offer type ────────────────────────────────────────────────────────────────

export interface Offer {
  id: string;
  carrier: string;
  logo: string;
  rating: number | null;
  hirePeriodDays: number;
  price: number;
  currency: string;
  badge?: string;
  deliveryNote: string;
  available: boolean;
}

function mapQuotesToOffers(quotes: SkipHireQuote[], hirePeriodDays: number): Offer[] {
  const offers: Offer[] = quotes.map((q) => ({
    id: q.carrierId,
    carrier: q.carrierName,
    logo: q.carrierLogo?.startsWith('http')
      ? q.carrierLogo
      : q.carrierName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
    rating: q.carrierRating,
    hirePeriodDays,
    price: q.price,
    currency: q.currency,
    badge: undefined as string | undefined,
    deliveryNote: 'Piegāde izvēlētajā datumā',
    available: true,
  }));
  if (offers.length > 0) offers[0].badge = 'LĒTĀKAIS';
  const topRated = [...offers]
    .filter((o) => o.rating !== null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  if (topRated && !topRated.badge) topRated.badge = 'VISLABĀK VĒRTĒTS';
  return offers;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function fmtShort(d: Date) {
  return d.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });
}

function fmtFull(d: Date) {
  return d.toLocaleDateString('lv-LV', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

const QUICK_PERIODS = [7, 14, 21, 28];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  size: string;
  location: string;
  deliveryDate: string;
  hirePeriodDays: number;
  selectedOffer: string;
  deliveryWindow?: 'ANY' | 'AM' | 'PM';
  onDeliveryWindowChange?: (w: 'ANY' | 'AM' | 'PM') => void;
  onDeliveryDateChange: (d: string) => void;
  onHirePeriodChange: (days: number) => void;
  onOfferSelect: (id: string, offers: Offer[]) => void;
  onNext: () => void;
  onBack: () => void;
  compact?: boolean;
}

export function Step3DateOffers({
  size,
  location,
  deliveryDate,
  hirePeriodDays,
  selectedOffer,
  deliveryWindow = 'ANY',
  onDeliveryWindowChange,
  onDeliveryDateChange,
  onHirePeriodChange,
  onOfferSelect,
  onNext,
  onBack,
  compact,
}: Props) {
  // Derive local DateRange from props
  const [range, setRange] = useState<DateRange | undefined>(() => {
    if (!deliveryDate) return undefined;
    const from = fromISO(deliveryDate);
    const to = new Date(from);
    to.setDate(to.getDate() + hirePeriodDays);
    return { from, to };
  });

  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    if (!deliveryDate || !size || !location) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingOffers(true);

    setOffersLoaded(false);

    setFetchError('');
    let cancelled = false;
    getSkipHireQuotes(mapSkipSize(size), location, deliveryDate)
      .then((quotes) => {
        if (cancelled) return;
        setOffers(mapQuotesToOffers(quotes, hirePeriodDays));
        setOffersLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchError('Neizdevās ielādēt piedāvājumus. Pārbaudiet savienojumu.');
        setOffersLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingOffers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryDate, size, location]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRangeSelect(r: DateRange | undefined) {
    setRange(r);
    if (r?.from) {
      const isoFrom = toISO(r.from);
      if (isoFrom !== deliveryDate) onDeliveryDateChange(isoFrom);
      if (r.to) {
        const days = Math.max(1, diffDays(r.from, r.to));
        if (days !== hirePeriodDays) onHirePeriodChange(days);
      }
    } else {
      onDeliveryDateChange('');
    }
  }

  function applyQuickPeriod(days: number) {
    const from = range?.from ?? todayPlus(1);
    const to = new Date(from);
    to.setDate(to.getDate() + days);
    handleRangeSelect({ from, to });
  }

  const canProceed = !!deliveryDate && !!selectedOffer && !!range?.to;
  const pickupDate = range?.to;
  const activePeriod = range?.from && range?.to ? diffDays(range.from, range.to) : hirePeriodDays;
  const tomorrow = todayPlus(1);

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900">Izvēlieties datumus un piedāvājumu</h2>
        <p className="text-gray-500 text-sm">
          Atzīmējiet piegādes un savākšanas datumu, tad izvēlieties pārvadātāju
        </p>
      </div>

      {/* Main grid: calendar | offers | summary */}
      <div
        className={cn(
          'grid gap-6 items-start',
          compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[auto_1fr_260px]',
        )}
      >
        {/* ── LEFT: Calendar ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Nomas periods
            </p>
            <div className="mb-4 grid grid-cols-4 gap-1.5">
              {QUICK_PERIODS.map((d) => {
                const active = activePeriod === d;
                return (
                  <button
                    key={d}
                    onClick={() => applyQuickPeriod(d)}
                    className={cn(
                      'rounded-lg border-2 py-1.5 text-sm font-semibold transition-all',
                      active
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400',
                    )}
                  >
                    {d}d
                  </button>
                );
              })}
            </div>

            <div className="mb-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs">
              <span className="text-gray-500">No</span>
              <span
                className={cn('font-semibold', range?.from ? 'text-gray-900' : 'text-gray-400')}
              >
                {range?.from ? fmtShort(range.from) : '—'}
              </span>
              <span className="text-gray-300">→</span>
              <span className={cn('font-semibold', range?.to ? 'text-gray-900' : 'text-gray-400')}>
                {range?.to ? fmtShort(range.to) : '—'}
              </span>
              <span className="text-gray-500">Līdz</span>
            </div>

            <Calendar
              mode="range"
              selected={range}
              onSelect={handleRangeSelect}
              disabled={{ before: tomorrow }}
              defaultMonth={tomorrow}
              numberOfMonths={1}
              classNames={{
                range_start: 'rounded-l-md bg-gray-200',
                range_end: 'rounded-r-md bg-gray-200',
                range_middle: 'rounded-none bg-gray-100',
              }}
            />
          </div>
        </div>

        {/* ── MIDDLE: Offers ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-700">
              {deliveryDate ? 'Izvēlieties piedāvājumu' : 'Izvēlieties piegādes datumu'}
            </p>
            {loadingOffers && <Loader2 className="size-3.5 animate-spin text-gray-500" />}
          </div>

          {!deliveryDate && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <Truck className="size-7 text-gray-300" />
              </div>
              Atzīmējiet sākuma datumu kalendārā, lai redzētu piedāvājumus
            </div>
          )}

          {deliveryDate && loadingOffers && (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-gray-500">
              <Loader2 className="size-8 animate-spin text-gray-800" />
              <p>Meklē pieejamos pārvadātājus...</p>
            </div>
          )}

          {deliveryDate && offersLoaded && offers.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Truck className="size-8 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-700">
                {fetchError || 'Nav pieejamu piedāvājumu'}
              </p>
              <p className="text-sm text-gray-500 max-w-xs">
                {fetchError
                  ? 'Mēģiniet vēlreiz vai izvēlēties citu datumu.'
                  : 'Izvēlētajam datumam nav brīvu pārvadātāju. Mēģiniet citu datumu.'}
              </p>
              <button
                onClick={() => {
                  setRange(undefined);
                  onDeliveryDateChange('');
                }}
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <X className="size-3.5" />
                Mainīt datumu
              </button>
            </div>
          )}

          {deliveryDate && offersLoaded && offers.length > 0 && (
            <div className="space-y-3">
              {offers.map((offer) => {
                const sel = selectedOffer === offer.id;
                return (
                  <button
                    key={offer.id}
                    onClick={() => onOfferSelect(offer.id, offers)}
                    className={cn(
                      'w-full text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md relative',
                      sel
                        ? 'border-black ring-1 ring-black bg-gray-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300',
                    )}
                  >
                    {offer.badge && (
                      <span className="absolute -top-3 left-4 rounded-full bg-black px-2.5 py-0.5 text-xs font-bold text-white">
                        {offer.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 shrink-0 overflow-hidden">
                        {offer.logo.startsWith('http') ? (
                          <Image
                            src={offer.logo}
                            alt=""
                            width={44}
                            height={44}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">{offer.logo}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{offer.carrier}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="size-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-semibold text-gray-700">
                            {offer.rating !== null ? offer.rating : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Package className="size-3" />
                          {offer.hirePeriodDays} dienu noma · {offer.deliveryNote}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={cn('text-xl font-bold', sel ? 'text-black' : 'text-gray-900')}
                        >
                          €{offer.price}
                        </p>
                        <p className="text-xs text-gray-500">iekļ. PVN</p>
                        {sel && <CheckCircle2 className="size-5 text-black mt-1 ml-auto" />}
                      </div>
                    </div>
                  </button>
                );
              })}
              <p className="text-xs text-center text-gray-400 pt-1">
                Cenas iekļauj piegādi, savākšanu un utilizāciju
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Summary ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-4 lg:sticky lg:top-6">
          <p className="text-sm font-bold text-gray-800">Kopsavilkums</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Konteiners</span>
              <span className="font-semibold">{size || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Piegāde</span>
              <span className="font-semibold text-right">
                {range?.from ? fmtFull(range.from) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Savākšana</span>
              <span className="font-semibold text-right">
                {pickupDate ? fmtFull(pickupDate) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Periods</span>
              <span className="font-semibold">
                {range?.from && range?.to ? `${activePeriod} dienas` : '—'}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            {selectedOffer && offers.length > 0 ? (
              (() => {
                const o = offers.find((x) => x.id === selectedOffer);
                return o ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Pārvadātājs</span>
                      <span className="font-semibold truncate max-w-32.5 text-right">
                        {o.carrier}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-gray-500">Kopā</span>
                      <span className="text-2xl font-bold text-black">€{o.price}</span>
                    </div>
                    <p className="text-xs text-gray-400 text-right">iekļ. PVN</p>
                  </div>
                ) : null;
              })()
            ) : (
              <p className="text-xs text-gray-400 text-center">Izvēlieties piedāvājumu</p>
            )}
          </div>
        </div>
      </div>

      {/* Time window */}
      {onDeliveryWindowChange && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Vēlamais piegādes laiks
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['ANY', 'Jebkurā'],
                ['AM', 'Rīts 8–13'],
                ['PM', 'Diena 13–18'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => onDeliveryWindowChange(val)}
                className={cn(
                  'rounded-xl border-2 py-2.5 text-sm font-semibold transition-all',
                  deliveryWindow === val
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400',
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-2xl border-2 border-gray-200 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Atpakaļ
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-2 rounded-2xl bg-black py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-gray-800 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          Turpināt
        </button>
      </div>
    </div>
  );
}
