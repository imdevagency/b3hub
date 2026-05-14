'use client';

/**
 * EquipmentMatchWizard
 *
 * Rental equipment order wizard — reverse marketplace pattern.
 * Steps: details (address + dates) → match (offers) → contact → confirmed
 *
 * Mirrors MaterialOrderWizard layout, patterns, and component choices.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { lv } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useAuth } from '@/lib/auth-context';

import { WizardShell } from '@/components/order/WizardShell';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { Container } from '@/components/marketing/layout/Container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';

import {
  getRentalListings,
  getRentalListingAvailability,
  checkRentalListingRadius,
  getRentalPriceEstimate,
  createRentalOrder,
  type RentalServiceType,
  type RentalListing,
  type PriceEstimateResult,
} from '@/lib/api/rentals';
import { EQUIPMENT_SERVICES } from '@/lib/equipment-services';

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  Star,
  Truck,
  User as UserIcon,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type WizardStep = 'address' | 'dates' | 'match' | 'contact' | 'confirmed';

const STEP_INDEX: Record<WizardStep, number> = {
  address: 1,
  dates: 2,
  match: 3,
  contact: 4,
  confirmed: 5,
};

interface MatchedOffer {
  listing: RentalListing;
  estimate: PriceEstimateResult;
  distanceKm: number;
}

interface Props {
  initialServiceType: RentalServiceType;
  mode?: 'public' | 'dashboard';
}

// ── Offer card ─────────────────────────────────────────────────────────────────

function OfferCard({
  offer,
  isCheapest,
  hireDays,
  submitting,
  onSelect,
}: {
  offer: MatchedOffer;
  isCheapest: boolean;
  hireDays: number;
  submitting: boolean;
  onSelect: () => void;
}) {
  const imageUrl = offer.listing.imageUrls?.[0];
  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden hover:border-foreground/20 transition-colors">
      {imageUrl && (
        <div className="p-2 pb-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={offer.listing.name}
            className="h-20 w-full object-cover rounded-xl border border-border/40"
          />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-[15px] text-foreground truncate">
                {offer.listing.provider?.name ?? offer.listing.name}
              </p>
              {isCheapest && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
                  <Star className="size-3" /> Labākais
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{offer.listing.name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-foreground">
              €{offer.estimate.priceExclVat.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">bez PVN</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Truck className="size-3.5" />
            <span>{offer.distanceKm.toFixed(0)} km</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="size-3.5" />
            <span>{hireDays} d.</span>
          </div>
          <div className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            <span>
              €{offer.listing.pricePerDay.toFixed(2)}/{offer.listing.unitLabel}/d.
            </span>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <Button
          onClick={onSelect}
          disabled={submitting}
          className="w-full rounded-xl h-11 font-bold bg-[#203728] text-white hover:bg-[#203728]/90"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              Izvēlēties šo piedāvājumu <ArrowRight className="size-4 ml-1.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EquipmentMatchWizard({ initialServiceType, mode = 'public' }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const serviceDef = EQUIPMENT_SERVICES.find((s) => s.type === initialServiceType);
  const catalogHref = mode === 'dashboard' ? '/dashboard/order/equipment' : '/order/equipment';

  // ── Wizard state ──────────────────────────────────────────────────────────

  const [step, setStep] = useState<WizardStep>('address');

  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [city, setCity] = useState('');

  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const [offers, setOffers] = useState<MatchedOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<MatchedOffer | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNotes, setContactNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');

  // Insurance selection (contact step)
  const [selectedInsurancePlanId, setSelectedInsurancePlanId] = useState<string | null>(null);

  // Add-on quantities (contact step) — keyed by addOn.id
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});

  const hireDays =
    dateRange?.from && dateRange?.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : 0;

  // ── Google Map ────────────────────────────────────────────────────────────

  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = getGoogleMapsPublicKey();
    if (!apiKey) return;
    loadGoogleMapsScript(apiKey, () => {
      const google = window.google;
      if (!google || !mapDivRef.current || mapInstanceRef.current) return;
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: 56.9496, lng: 24.1052 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d9e8' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
      mapInstanceRef.current = map;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            map.setZoom(14);
          },
          () => {},
          { timeout: 8000 },
        );
      }
    });
  }, []);

  const updateMapPin = useCallback((newLat: number, newLng: number) => {
    const google = window.google;
    if (!google || !mapInstanceRef.current) return;
    const position = { lat: newLat, lng: newLng };
    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      markerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
    }
    mapInstanceRef.current.panTo(position);
    mapInstanceRef.current.setZoom(16);
  }, []);

  function handleAddressChange(addr: string, newLat?: number, newLng?: number, newCity?: string) {
    setAddress(addr);
    setLat(newLat);
    setLng(newLng);
    setCity(newCity ?? '');
    if (newLat && newLng) updateMapPin(newLat, newLng);
  }

  // ── Matchmaking ───────────────────────────────────────────────────────────

  async function goToOffers() {
    if (!dateRange?.from || !dateRange?.to || !lat || !lng) return;
    setOffersError('');
    setOffersLoading(true);
    setStep('match');

    try {
      const listings = await getRentalListings(initialServiceType);
      const matched: MatchedOffer[] = [];

      for (const listing of listings) {
        if (!listing.isActive) continue;
        // Skip listings that don't accommodate the requested hire period
        if (hireDays < listing.minHireDays) continue;
        if (listing.maxHireDays && hireDays > listing.maxHireDays) continue;
        try {
          const radiusCheck = await checkRentalListingRadius(listing.id, lat, lng);
          if (!radiusCheck.withinRadius) continue;

          const avail = await getRentalListingAvailability(listing.id);
          const blockedTimes = avail.blockedDates.map((d: string) => new Date(d).getTime());
          let blocked = false;
          for (let d = new Date(dateRange.from); d <= dateRange.to; d = addDays(d, 1)) {
            if (blockedTimes.includes(d.getTime())) {
              blocked = true;
              break;
            }
          }
          if (blocked) continue;

          const estimate = await getRentalPriceEstimate(listing.id, {
            hireDays,
            selectedAddOnIds: [],
            lat,
            lng,
          });

          matched.push({ listing, estimate, distanceKm: radiusCheck.distanceKm ?? 0 });
        } catch {
          // skip individual listing errors silently
        }
      }

      matched.sort((a, b) => a.estimate.priceExclVat - b.estimate.priceExclVat);
      setOffers(matched);
    } catch {
      setOffersError('Neizdevās ielādēt piedāvājumus. Mēģiniet vēlreiz.');
    } finally {
      setOffersLoading(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!dateRange?.from || !dateRange?.to || !lat || !lng || !selectedOffer) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const hireDaysCount = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
      const selectedPlan = selectedInsurancePlanId
        ? (selectedOffer.listing.insuranceOptions ?? []).find(
            (p) => p.id === selectedInsurancePlanId,
          )
        : undefined;
      const payload: Parameters<typeof createRentalOrder>[0] = {
        listingId: selectedOffer.listing.id,
        serviceType: initialServiceType,
        address,
        city,
        lat,
        lng,
        hireDays: hireDaysCount,
        deliveryDate: dateRange.from.toISOString(),
        quantity: 1,
        price: selectedOffer.estimate.priceTotalInclVat,
        contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        notes: contactNotes || undefined,
        insurancePlanId: selectedPlan?.id,
        insurancePlanName: selectedPlan?.name,
        insurancePricePerDay: selectedPlan?.pricePerDay,
        selectedAddOns: Object.entries(selectedAddOns)
          .filter(([, qty]) => qty > 0)
          .flatMap(([id, qty]) => {
            const addon = (selectedOffer.listing.addOns ?? []).find((a) => a.id === id);
            if (!addon) return [];
            const lineTotal =
              addon.pricePerDay != null
                ? addon.pricePerDay * qty * hireDaysCount
                : (addon.priceFlat ?? 0) * qty;
            return [
              {
                id,
                name: addon.name,
                pricePerDay: addon.pricePerDay,
                priceFlat: addon.priceFlat,
                qty,
                lineTotal,
              },
            ];
          }),
      };

      const result = await createRentalOrder(payload);
      setOrderNumber((result as { orderNumber?: string }).orderNumber ?? '');
      setStep('confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Neizdevās izveidot rezervāciju.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Wizard content ────────────────────────────────────────────────────────

  const wizardContent = (
    <WizardShell
      className="w-full h-auto"
      step={STEP_INDEX[step]}
      totalSteps={5}
      title={
        step === 'confirmed' ? 'Rezervācija apstiprināta' : (serviceDef?.label ?? 'Tehnikas noma')
      }
      onBack={
        step === 'dates'
          ? () => setStep('address')
          : step === 'match'
            ? () => setStep('dates')
            : step === 'contact'
              ? () => setStep('match')
              : undefined
      }
      onClose={step !== 'confirmed' ? () => router.push(catalogHref) : undefined}
    >
      {/* Order summary pill — shown from step 2 onward */}
      {step !== 'address' &&
        step !== 'dates' &&
        step !== 'confirmed' &&
        dateRange?.from &&
        dateRange?.to && (
          <div className="mb-6 rounded-2xl bg-gray-100 p-4">
            <div className="flex items-center gap-3">
              {serviceDef && (
                <serviceDef.Icon className="size-5 text-gray-700 shrink-0" strokeWidth={1.5} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold truncate text-black">
                  {serviceDef?.label ?? 'Tehnikas noma'}
                </p>
                <p className="text-sm font-medium text-gray-500 truncate">
                  {format(dateRange.from, 'd. MMM', { locale: lv })} –{' '}
                  {format(dateRange.to, 'd. MMM', { locale: lv })} · {hireDays} d.
                </p>
              </div>
              {offers.length > 0 && step === 'match' && (
                <span className="font-bold text-lg text-primary shrink-0">
                  no €{offers[0].estimate.priceExclVat.toFixed(2)}
                </span>
              )}
              {selectedOffer && step === 'contact' && (
                <span className="font-bold text-lg text-primary shrink-0">
                  €{selectedOffer.estimate.priceExclVat.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

      {/* ── Step 1: Address ───────────────────────────────────── */}
      {step === 'address' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
          <Step2Address
            value={address}
            lat={lat}
            lng={lng}
            onAddressChange={handleAddressChange}
            title="Kur nepieciešama tehnika?"
            subtitle="Ievadiet precīzu adresi vai būvlaukuma nosaukumu"
            nextDisabled={!lat || !lng}
            nextLabel="Tālāk"
            onNext={() => setStep('dates')}
          />
        </div>
      )}

      {/* ── Step 2: Dates ─────────────────────────────────────── */}
      {step === 'dates' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 pb-6">
          <div>
            <h2 className="text-[22px] font-bold text-foreground">Nomas periods</h2>
            <p className="text-[15px] text-muted-foreground mt-1.5">
              Izvēlieties datumus, kuros nepieciešama tehnika
            </p>
          </div>

          <div className="border border-border/60 bg-background rounded-2xl flex justify-center p-2 sm:p-4 overflow-hidden">
            <div className="overflow-x-auto max-w-full pb-2">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                disabled={(date) => date < new Date()}
                className="pointer-events-auto"
              />
            </div>
          </div>

          {dateRange?.from && dateRange?.to && (
            <p className="text-sm font-medium text-center text-foreground bg-muted/50 rounded-xl py-3 border border-border/50">
              {format(dateRange.from, 'd. MMM', { locale: lv })} –{' '}
              {format(dateRange.to, 'd. MMM', { locale: lv })} · {hireDays} diena
              {hireDays === 1 ? '' : 's'}
            </p>
          )}

          <Button
            className="w-full rounded-2xl h-12 text-[15px] font-bold bg-[#203728] text-white hover:bg-[#203728]/90 mt-2"
            disabled={!dateRange?.from || !dateRange?.to || hireDays < 1}
            onClick={goToOffers}
          >
            <Search className="size-4 mr-1.5" />
            Meklēt piedāvājumus
          </Button>
        </div>
      )}

      {/* ── Step 2: Offers ────────────────────────────────────── */}
      {step === 'match' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          {offersLoading ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Meklējam pieejamo tehniku...
              </p>
            </div>
          ) : offersError ? (
            <div className="py-10 text-center space-y-4">
              <p className="text-sm text-destructive font-medium">{offersError}</p>
              <Button variant="outline" onClick={() => setStep('dates')}>
                Atgriezties atpakaļ
              </Button>
            </div>
          ) : offers.length === 0 ? (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-bold text-foreground">Nav pieejamu piedāvājumu</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Šajā rajonā vai norādītajos datumos tehnika nav pieejama. Mēģiniet mainīt datumus
                  vai adresi.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-2xl h-11"
                onClick={() => setStep('dates')}
              >
                Mainīt datumus / adresi
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-bold text-foreground">
                  {offers.length} piedāvājum{offers.length === 1 ? 's' : 'i'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sakārtoti pēc cenas — lētākais pirmais
                </p>
              </div>
              {offers.map((offer, idx) => (
                <OfferCard
                  key={offer.listing.id}
                  offer={offer}
                  hireDays={hireDays}
                  isCheapest={idx === 0}
                  submitting={submitting}
                  onSelect={() => {
                    setSelectedOffer(offer);
                    setSelectedInsurancePlanId(null);
                    setSelectedAddOns({});
                    setStep('contact');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Contact ───────────────────────────────────── */}
      {step === 'contact' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          {selectedOffer && (
            <div className="rounded-2xl bg-muted/40 border border-border/50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Izvēlētā tehnika
                </p>
                <p className="text-sm font-bold text-foreground truncate mt-0.5">
                  {selectedOffer.listing.name}
                </p>
              </div>
              <p className="text-lg font-bold text-foreground shrink-0">
                €{selectedOffer.estimate.priceExclVat.toFixed(2)}
              </p>
            </div>
          )}
          {/* ── Insurance selection ─────────────────────────── */}
          {selectedOffer && (selectedOffer.listing.insuranceOptions ?? []).length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-foreground" />
                <h3 className="text-sm font-bold">Apdrošināšana</h3>
                {selectedOffer.listing.insuranceRequired && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                    Obligāta
                  </span>
                )}
              </div>

              {selectedOffer.listing.requiredDocuments?.ownInsuranceRequired && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  Šis piegādātājs pieprasa, lai Jums būtu spēkā esoša civiltiesiskās atbildības
                  apdrošināšana. Izvēlieties plānu vai norādiet, ka Jums ir sava polise.
                </div>
              )}

              <div className="space-y-2">
                {!selectedOffer.listing.insuranceRequired && (
                  <button
                    onClick={() => setSelectedInsurancePlanId(null)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedInsurancePlanId === null
                        ? 'border-foreground bg-foreground/5'
                        : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">Bez apdrošināšanas</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Man ir sava uzņēmuma apdrošināšana vai es uzņemos risku pats
                      </p>
                    </div>
                    <div
                      className={`size-4 rounded-full border-2 shrink-0 ${
                        selectedInsurancePlanId === null
                          ? 'border-foreground bg-foreground'
                          : 'border-muted-foreground'
                      }`}
                    />
                  </button>
                )}

                {(selectedOffer.listing.insuranceOptions ?? []).map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedInsurancePlanId(plan.id)}
                    className={`w-full flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selectedInsurancePlanId === plan.id
                        ? 'border-foreground bg-foreground/5'
                        : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{plan.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {plan.excess != null && (
                          <span className="text-[11px] bg-muted/60 rounded-md px-2 py-0.5">
                            Pašrisks: €{plan.excess}
                          </span>
                        )}
                        {plan.coversTheft && (
                          <span className="text-[11px] bg-muted/60 rounded-md px-2 py-0.5">
                            Zādzību segums
                          </span>
                        )}
                        {plan.coversThirdParty && (
                          <span className="text-[11px] bg-muted/60 rounded-md px-2 py-0.5">
                            3. puses atbildība
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <p className="text-sm font-bold">+€{plan.pricePerDay.toFixed(2)}/d.</p>
                      <div
                        className={`size-4 rounded-full border-2 ${
                          selectedInsurancePlanId === plan.id
                            ? 'border-foreground bg-foreground'
                            : 'border-muted-foreground'
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>

              {selectedOffer.listing.insuranceRequired && !selectedInsurancePlanId && (
                <p className="text-xs text-orange-700 font-medium">
                  Apdrošināšanas plāna izvēle ir obligāta šai iekārtai.
                </p>
              )}
            </div>
          )}

          {/* ── Add-ons selection ─────────────────────────── */}
          {selectedOffer && (selectedOffer.listing.addOns ?? []).length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold">Papildinājumi (neobligāti)</h3>
              <div className="space-y-2">
                {(selectedOffer.listing.addOns ?? []).map((addon) => {
                  const qty = selectedAddOns[addon.id] ?? 0;
                  const price =
                    addon.pricePerDay != null
                      ? `+€${addon.pricePerDay.toFixed(2)}/d.`
                      : addon.priceFlat != null
                        ? `+€${addon.priceFlat.toFixed(2)}`
                        : '';
                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        qty > 0 ? 'border-foreground bg-foreground/5' : 'border-border'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{addon.name}</p>
                        {addon.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {addon.description}
                          </p>
                        )}
                        {price && <p className="text-xs font-bold mt-1">{price}</p>}
                      </div>
                      {addon.maxQty <= 1 ? (
                        <button
                          onClick={() =>
                            setSelectedAddOns((prev) => ({
                              ...prev,
                              [addon.id]: prev[addon.id] ? 0 : 1,
                            }))
                          }
                          className={`size-5 rounded border-2 flex items-center justify-center transition-colors ${
                            qty > 0 ? 'border-foreground bg-foreground' : 'border-muted-foreground'
                          }`}
                        >
                          {qty > 0 && (
                            <span className="text-background text-[10px] font-bold">✓</span>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSelectedAddOns((prev) => ({
                                ...prev,
                                [addon.id]: Math.max(0, (prev[addon.id] ?? 0) - 1),
                              }))
                            }
                            disabled={qty <= 0}
                            className="size-6 rounded border text-sm font-bold disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{qty}</span>
                          <button
                            onClick={() =>
                              setSelectedAddOns((prev) => ({
                                ...prev,
                                [addon.id]: Math.min(addon.maxQty, (prev[addon.id] ?? 0) + 1),
                              }))
                            }
                            disabled={qty >= addon.maxQty}
                            className="size-6 rounded border text-sm font-bold disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Policy disclosure ──────────────────────────── */}
          {selectedOffer &&
            (() => {
              const l = selectedOffer.listing;
              const hasPolicies =
                l.cancellationPolicy ||
                l.fuelPolicy ||
                l.depositAmount ||
                l.lateReturnFeePerDay ||
                l.requiredDocuments?.licenseType;
              if (!hasPolicies) return null;
              const CANCEL_LABELS: Record<string, string> = {
                FREE_UNTIL_48H: 'Bezmaksas atcelšana līdz 48h pirms piegādes',
                FREE_UNTIL_24H: 'Bezmaksas atcelšana līdz 24h pirms piegādes',
                NON_REFUNDABLE: 'Neatmaksājama rezervācija',
              };
              const FUEL_LABELS: Record<string, string> = {
                FULL_TO_FULL: 'Pilns-uz-pilnu',
                INCLUDED: 'Degviela iekļauta cenā',
                CHARGED_ON_RETURN: 'Degviela tiek aprēķināta pēc atgriešanas',
              };
              return (
                <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-1.5 text-xs text-muted-foreground">
                  <p className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Noteikumi
                  </p>
                  {l.cancellationPolicy && (
                    <p>Atcelšana: {CANCEL_LABELS[l.cancellationPolicy] ?? l.cancellationPolicy}</p>
                  )}
                  {l.fuelPolicy && <p>Degviela: {FUEL_LABELS[l.fuelPolicy] ?? l.fuelPolicy}</p>}
                  {l.depositAmount && l.depositAmount > 0 && (
                    <p>
                      Depozīts: €{l.depositAmount.toFixed(2)}
                      {l.depositMethod === 'ONLINE_BEFORE'
                        ? ' (maksājams pirms piegādes)'
                        : l.depositMethod === 'ON_DELIVERY'
                          ? ' (maksājams piegādes brīdī)'
                          : ''}
                    </p>
                  )}
                  {l.lateReturnFeePerDay && l.lateReturnFeePerDay > 0 && (
                    <p>Kavēšanās maksa: €{l.lateReturnFeePerDay.toFixed(2)}/d.</p>
                  )}
                  {l.requiredDocuments?.licenseType && (
                    <p>Nepieciešamā atļauja: {l.requiredDocuments.licenseType}</p>
                  )}
                </div>
              );
            })()}

          <div>
            <h2 className="text-lg font-bold">Kontaktinformācija</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Piegādes dienā piegādātājs sazināsies ar norādīto personu
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <UserIcon className="size-3.5" /> Vārds, uzvārds
              </label>
              <Input
                type="text"
                placeholder="Jānis Bērziņš"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Phone className="size-3.5" /> Tālrunis
              </label>
              <Input
                type="tel"
                placeholder="+371 20 000 000"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="rounded-xl"
              />
            </div>
            {mode === 'public' && (
              <div>
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Mail className="size-3.5" /> E-pasts{' '}
                  <span className="text-muted-foreground font-normal">(neobligāti)</span>
                </label>
                <Input
                  type="email"
                  placeholder="jusu@epasts.lv"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  autoComplete="email"
                  className="rounded-xl"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-foreground mb-1.5 block">
                Papildus piezīmes{' '}
                <span className="text-muted-foreground font-normal">(neobligāti)</span>
              </label>
              <textarea
                placeholder="Piekļuves kodi, instrukcijas piegādātājam..."
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10"
              />
            </div>
          </div>
          {!contactPhone.trim() && (
            <p className="text-sm text-destructive font-medium">
              Tālrunis ir obligāts — piegādātājam jāsazinās ar jums piegādes dienā.
            </p>
          )}
          {submitError && <p className="text-sm text-destructive font-medium">{submitError}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setStep('match')}
              className="flex-1 rounded-xl border py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Atpakaļ
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                !contactPhone.trim() ||
                submitting ||
                (selectedOffer?.listing.insuranceRequired === true && !selectedInsurancePlanId)
              }
              className="flex-2 rounded-xl bg-[#203728] py-3 px-6 text-sm font-bold text-white hover:bg-[#203728]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin inline" />
              ) : (
                'Apstiprināt rezervāciju'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Confirmed ─────────────────────────────────── */}
      {step === 'confirmed' && (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
          <div className="flex size-20 items-center justify-center rounded-full bg-foreground">
            <CheckCircle2 className="size-9 text-background" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">Rezervācija veikta!</p>
            {orderNumber && (
              <p className="text-base text-muted-foreground font-medium mt-1">
                Nr. <span className="font-bold text-foreground">{orderNumber}</span>
              </p>
            )}
          </div>
          <div className="w-full rounded-2xl bg-muted/40 divide-y divide-border/50 text-[15px]">
            {selectedOffer && (
              <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
                {serviceDef && (
                  <serviceDef.Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                )}
                <span className="truncate">{selectedOffer.listing.name}</span>
              </div>
            )}
            <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-foreground" />
              <span className="truncate">{address}</span>
            </div>
            {dateRange?.from && dateRange?.to && (
              <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
                <CalendarDays className="size-4 shrink-0 text-foreground" />
                <span>
                  {format(dateRange.from, 'd. MMM', { locale: lv })} –{' '}
                  {format(dateRange.to, 'd. MMM yyyy', { locale: lv })}
                </span>
              </div>
            )}
          </div>
          <div className="w-full space-y-3">
            <Button
              onClick={() => router.push('/dashboard/orders')}
              className="w-full rounded-2xl h-12 font-bold bg-[#203728] text-white hover:bg-[#203728]/90"
            >
              <ReceiptText className="size-4 mr-1.5" /> Skatīt rezervācijas
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(catalogHref)}
              className="w-full rounded-2xl h-12 font-semibold"
            >
              Turpināt
            </Button>
          </div>
        </div>
      )}
    </WizardShell>
  );

  // ── Layout ────────────────────────────────────────────────────────────────

  if (mode === 'public') {
    return (
      <Container className="pt-32 pb-24 flex max-lg:flex-col items-start gap-10 lg:gap-20">
        {/* Left: wizard */}
        <div className="flex flex-col w-full lg:w-110 xl:w-120 shrink-0 bg-background rounded-2xl shadow-xl border border-border/40 overflow-hidden">
          {wizardContent}
        </div>
        {/* Right: map / info panel */}
        <div className="hidden lg:flex flex-1 items-center justify-center p-10 h-150 sticky top-28 rounded-3xl overflow-hidden ring-1 ring-border/40 shadow-xl bg-muted/10 relative">
          {/* Map layer */}
          <div
            className={`absolute inset-0 bg-[#e5e3df] transition-opacity duration-300 ${step === 'address' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <div ref={mapDivRef} className="absolute inset-0" />
            {address && (
              <div className="absolute top-6 left-6 z-10">
                <div className="bg-background/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-border/50 text-sm font-bold text-foreground flex items-center gap-2">
                  <MapPin className="size-4" />
                  <span className="truncate max-w-50">{address}</span>
                </div>
              </div>
            )}
          </div>

          {/* Info layer */}
          {step !== 'address' && (
            <div className="absolute inset-0 bg-white p-12 flex flex-col justify-center animate-in fade-in duration-300">
              <div className="w-full max-w-lg mx-auto">
                {serviceDef && (
                  <div className="flex items-center gap-5 mb-10">
                    <serviceDef.Icon className="size-10 text-foreground" strokeWidth={1.5} />
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                      {serviceDef.label}
                    </h2>
                  </div>
                )}
                <div className="border-t border-border/50 divide-y divide-border/50">
                  <div className="py-5 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-muted-foreground">Adrese</span>
                    <span className="text-sm font-medium text-foreground text-right truncate max-w-60">
                      {address}
                    </span>
                  </div>
                  {dateRange?.from && dateRange?.to && (
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Periods</span>
                      <span className="text-sm font-medium text-foreground">
                        {format(dateRange.from, 'd. MMM', { locale: lv })} –{' '}
                        {format(dateRange.to, 'd. MMM yyyy', { locale: lv })}
                      </span>
                    </div>
                  )}
                  {hireDays > 0 && (
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Nomas ilgums
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {hireDays} diena{hireDays === 1 ? '' : 's'}
                      </span>
                    </div>
                  )}
                  {offers.length > 0 && (
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Pieejami piedāvājumi
                      </span>
                      <span className="text-sm font-bold text-foreground">{offers.length}</span>
                    </div>
                  )}
                  {selectedOffer && (
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Izvēlētā cena
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        €{selectedOffer.estimate.priceExclVat.toFixed(2)} bez PVN
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    );
  }

  // Dashboard mode
  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="bg-background rounded-2xl shadow-xl border border-border/40 overflow-hidden">
        {wizardContent}
      </div>
    </div>
  );
}
