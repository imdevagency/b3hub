'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import Image from 'next/image';
import {
  createRentalOrder,
  checkRentalListingRadius,
  getRentalListingAvailability,
  getRentalPriceEstimate,
} from '@/lib/api/rentals';
import type { RentalListing, AddOnDef, InsuranceDef, PriceEstimateResult } from '@/lib/api/rentals';
import type { ServiceDef } from '@/lib/equipment-services';
import { WebWizardAuthGate, type GuestContactInfo } from '@/components/order/WebWizardAuthGate';
import { AddressAutocomplete, type PlaceAddress } from '@/components/ui/AddressAutocomplete';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  Truck,
  FileText,
  Info,
  AlertTriangle,
  CheckCircle2,
  Fuel,
  Clock,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  listing: RentalListing;
  serviceConfig?: ServiceDef;
  /** When true this is a generic category page — no real listing in DB, skip backend calls */
  isVirtual?: boolean;
}

type BookingStep = 1 | 2 | 3;

type SelectedAddOns = Record<string, number>; // addOnId → qty

// ── Helpers ───────────────────────────────────────────────────────────────────

function policyLabel(value: string | null | undefined, map: Record<string, string>) {
  if (!value) return null;
  return map[value] ?? value;
}

const FUEL_LABELS: Record<string, string> = {
  FULL_TO_FULL: 'Pilns-uz-pilnu',
  INCLUDED: 'Degviela iekļauta',
  CHARGED_ON_RETURN: 'Maksā pēc atgriešanas',
};

const CANCEL_LABELS: Record<string, string> = {
  FREE_UNTIL_48H: 'Bezmaksas līdz 48h pirms',
  FREE_UNTIL_24H: 'Bezmaksas līdz 24h pirms',
  NON_REFUNDABLE: 'Neatmaksājama',
};

const DEPOSIT_LABELS: Record<string, string> = {
  ONLINE_BEFORE: 'Maksājams online',
  ON_DELIVERY: 'Maksājams piegādē',
  NONE: 'Nav depozīta',
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  step,
  hasAddOns,
  hasInsurance,
}: {
  step: BookingStep;
  hasAddOns: boolean;
  hasInsurance: boolean;
}) {
  const allSteps: { n: BookingStep; label: string }[] = [
    { n: 1, label: 'Select date' },
    ...(hasAddOns ? [{ n: 2 as BookingStep, label: 'Accessories' }] : []),
    ...(hasInsurance ? [{ n: 3 as BookingStep, label: 'Insurance' }] : []),
  ];
  const steps = allSteps;
  return (
    <div className="flex items-center gap-2 text-[13px] font-semibold">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div
            className={cn(
              'flex items-center gap-2 transition-colors',
              step >= s.n ? 'text-foreground' : 'text-muted-foreground/50',
            )}
          >
            <span
              className={cn(
                'w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] border',
                step >= s.n
                  ? 'border-foreground text-foreground font-bold'
                  : 'border-muted-foreground/40 text-muted-foreground/50',
              )}
            >
              {s.n}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Price row ─────────────────────────────────────────────────────────────────

function PriceRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex justify-between text-sm', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ── Price preview sub-component ───────────────────────────────────────────────

function PricePreview({
  estimate,
  listing,
  hireDays,
  loading,
  step,
  full = false,
}: {
  estimate: PriceEstimateResult | null;
  listing: RentalListing;
  hireDays: number;
  loading: boolean;
  step: BookingStep;
  full?: boolean;
}) {
  const fallbackTotal = listing.pricePerDay * hireDays;

  // Render a clean section matching Storent mock
  const renderRow = (label: string, value: string, bold = false) => (
    <div
      className={cn(
        'flex justify-between py-3 border-t border-border text-sm',
        bold && 'border-t-2 border-border/80',
      )}
    >
      <span className={cn('text-foreground', bold && 'font-bold')}>{label}</span>
      <span className={cn(bold ? 'font-bold' : 'font-semibold')}>{value}</span>
    </div>
  );

  return (
    <div className={cn('mt-6', loading && 'opacity-50 pointer-events-none')}>
      {renderRow('Price per day for your rent days', `€${listing.pricePerDay.toFixed(2)}`)}
      {estimate ? (
        <>
          {estimate.addOnLines.map((line) =>
            renderRow(`+ ${line.name}`, `€${line.lineTotal.toFixed(2)}`),
          )}
          {estimate.insurance &&
            renderRow(`+ ${estimate.insurance.name}`, `€${estimate.insurance.total.toFixed(2)}`)}
          {estimate.deliveryFee > 0 && renderRow('Delivery', `€${estimate.deliveryFee.toFixed(2)}`)}

          {renderRow('Total price (excl VAT)', `€${estimate.priceExclVat.toFixed(2)}`, true)}
          {(full || step === 3) &&
            renderRow(
              `Total with VAT (${estimate.vatRate}%)`,
              `€${estimate.priceTotalInclVat.toFixed(2)}`,
              true,
            )}
        </>
      ) : (
        renderRow('Total price (excl VAT)', `€${fallbackTotal.toFixed(2)}`, true)
      )}
    </div>
  );
}

// ── Insurance option sub-component ───────────────────────────────────────────

function InsuranceOption({
  selected,
  onSelect,
  name,
  description,
  priceLabel,
  extras,
  danger,
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  description: string;
  priceLabel: string;
  extras?: string[];
  danger?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
        selected
          ? danger
            ? 'border-destructive/60 bg-destructive/5'
            : 'border-primary bg-primary/5'
          : 'border-border bg-background hover:bg-muted/30',
      )}
    >
      <div
        className={cn(
          'mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
          selected
            ? danger
              ? 'border-destructive bg-destructive'
              : 'border-primary bg-primary'
            : 'border-muted-foreground',
        )}
      >
        {selected && <div className="size-1.5 rounded-full bg-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <span className={cn('text-sm font-semibold', danger && selected && 'text-destructive')}>
            {name}
          </span>
          <span
            className={cn(
              'text-sm font-bold shrink-0',
              selected ? (danger ? 'text-destructive' : 'text-primary') : 'text-foreground',
            )}
          >
            {priceLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {extras && extras.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {extras.map((e) => (
              <span
                key={e}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ListingDetailClient({ listing, isVirtual = false }: Props) {
  const router = useRouter();
  const { user, token } = useAuth();

  // ── Booking state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<BookingStep>(1);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [hireDays, setHireDays] = useState(listing.minHireDays || 1);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [addressError, setAddressError] = useState('');
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);

  // Step 2 — add-ons (stable refs — avoids fetchEstimate useCallback churn)
  const addOns = useMemo<AddOnDef[]>(
    () => (Array.isArray(listing.addOns) ? (listing.addOns as AddOnDef[]) : []),
    [listing.addOns],
  );
  const insuranceOptions = useMemo<InsuranceDef[]>(
    () =>
      Array.isArray(listing.insuranceOptions) ? (listing.insuranceOptions as InsuranceDef[]) : [],
    [listing.insuranceOptions],
  );
  const [selectedAddOns, setSelectedAddOns] = useState<SelectedAddOns>({});

  // Step 3 — insurance
  const defaultInsurance =
    listing.insuranceRequired && insuranceOptions.length > 0
      ? (insuranceOptions.find((i) => i.pricePerDay > 0)?.id ?? null)
      : null;
  const [insurancePlanId, setInsurancePlanId] = useState<string | null>(defaultInsurance);

  // Live price estimate
  const [estimate, setEstimate] = useState<PriceEstimateResult | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);

  // Contact
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Auth gate
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Gallery
  const [activeImage, setActiveImage] = useState(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<'info' | 'availability' | 'documents'>('info');

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isVirtual) return;
    getRentalListingAvailability(listing.id)
      .then((res) =>
        setBlockedDates(res.blockedDates.map((d: string) => new Date(d + 'T00:00:00'))),
      )
      .catch(() => {});
  }, [listing.id, isVirtual]);

  useEffect(() => {
    if (user) {
      setContactName((p) => p || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim());
      setContactPhone((p) => p || (user.phone ?? ''));
      setContactEmail((p) => p || (user.email ?? ''));
    }
  }, [user]);

  // Sync hireDays → dateTo when dateFrom changes
  useEffect(() => {
    if (dateFrom) {
      setDateTo(addDays(dateFrom, hireDays - 1));
    }
  }, [dateFrom, hireDays]);

  // Fetch live price estimate whenever inputs change
  const fetchEstimate = useCallback(async () => {
    if (hireDays < 1) return;

    // Virtual listing — compute price locally, no API call
    if (isVirtual) {
      const addOnTotal = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .reduce((sum, [id]) => {
          const def = addOns.find((a) => a.id === id);
          return (
            sum + (def?.pricePerDay != null ? def.pricePerDay * hireDays : (def?.priceFlat ?? 0))
          );
        }, 0);
      const insTotal = insurancePlanId
        ? (insuranceOptions.find((i) => i.id === insurancePlanId)?.pricePerDay ?? 0) * hireDays
        : 0;
      const baseCost = listing.pricePerDay * hireDays;
      const priceExclVat = baseCost + addOnTotal + insTotal;
      const vatRate = listing.vatRate ?? 21;
      const vatAmount = (priceExclVat * vatRate) / 100;
      setEstimate({
        baseCost,
        addOnLines: Object.entries(selectedAddOns)
          .filter(([, qty]) => qty > 0)
          .map(([id]) => {
            const def = addOns.find((a) => a.id === id);
            return {
              id,
              name: def?.name ?? id,
              lineTotal:
                def?.pricePerDay != null ? def.pricePerDay * hireDays : (def?.priceFlat ?? 0),
              qty: selectedAddOns[id] ?? 1,
              pricePerDay: def?.pricePerDay,
              priceFlat: def?.priceFlat,
            };
          }),
        insurance: insurancePlanId
          ? {
              id: insurancePlanId,
              name: insuranceOptions.find((i) => i.id === insurancePlanId)?.name ?? '',
              total: insTotal,
              pricePerDay: insuranceOptions.find((i) => i.id === insurancePlanId)?.pricePerDay ?? 0,
            }
          : null,
        deliveryFee: 0,
        hireDays,
        addOnTotal: 0,
        depositAmount: 0,
        depositMethod: 'CARD',
        currency: 'EUR',
        priceExclVat: priceExclVat,
        vatRate,
        vatAmount,
        priceTotalInclVat: priceExclVat + vatAmount,
      });
      return;
    }

    setEstimateLoading(true);
    try {
      const result = await getRentalPriceEstimate(listing.id, {
        hireDays,
        selectedAddOnIds: Object.entries(selectedAddOns)
          .filter(([, qty]) => qty > 0)
          .map(([id]) => id),
        insurancePlanId: insurancePlanId ?? undefined,
        lat,
        lng,
      });
      setEstimate(result);
    } catch {
      setEstimate(null);
    } finally {
      setEstimateLoading(false);
    }
  }, [
    listing.id,
    listing.pricePerDay,
    listing.vatRate,
    isVirtual,
    hireDays,
    selectedAddOns,
    insurancePlanId,
    lat,
    lng,
    addOns,
    insuranceOptions,
  ]);

  useEffect(() => {
    fetchEstimate();
  }, [fetchEstimate]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAddressSelect = async (place: PlaceAddress) => {
    setAddress(place.address || '');
    setCity(place.city || '');
    setLat(place.lat);
    setLng(place.lng);
    setAddressError('');
    if (!isVirtual && place.lat && place.lng) {
      try {
        const check = await checkRentalListingRadius(listing.id, place.lat, place.lng);
        if (!check.withinRadius && check.maxRadiusKm) {
          setAddressError(
            `Piegāde pieejama ${check.maxRadiusKm} km rādiusā (jūsu — ${check.distanceKm} km). Sazinieties ar piegādātāju.`,
          );
        }
      } catch {
        /* ignore */
      }
    }
  };

  const toggleAddOn = (id: string, max: number) => {
    setSelectedAddOns((prev) => {
      const cur = prev[id] ?? 0;
      if (cur > 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: Math.min(1, max) };
    });
  };

  const canProceedStep1 =
    !!dateFrom && hireDays >= (listing.minHireDays || 1) && !!address && !addressError;
  const canBook =
    canProceedStep1 &&
    (insuranceOptions.length === 0 || !!insurancePlanId || !listing.insuranceRequired);

  const submitOrder = async (authToken?: string, customContact?: GuestContactInfo) => {
    if (!dateFrom) return;
    setIsSubmitting(true);
    try {
      const totalPrice = estimate?.priceTotalInclVat ?? listing.pricePerDay * hireDays;
      const selectedInsurance = insuranceOptions.find((i) => i.id === insurancePlanId);
      await createRentalOrder(
        {
          listingId: isVirtual ? undefined : listing.id,
          serviceType: listing.serviceType,
          address,
          city,
          lat,
          lng,
          hireDays,
          deliveryDate: format(dateFrom, 'yyyy-MM-dd'),
          quantity: 1,
          price: totalPrice,
          paymentMethod: 'CARD',
          contactName: customContact?.name || contactName,
          contactEmail: customContact?.email || contactEmail,
          contactPhone: customContact?.phone || contactPhone,
          selectedAddOns: Object.entries(selectedAddOns)
            .filter(([, qty]) => qty > 0)
            .map(([id, qty]) => {
              const def = addOns.find((a) => a.id === id);
              const lineTotal =
                def?.pricePerDay != null
                  ? def.pricePerDay * hireDays * qty
                  : (def?.priceFlat ?? 0) * qty;
              return {
                id,
                name: def?.name ?? id,
                pricePerDay: def?.pricePerDay,
                priceFlat: def?.priceFlat,
                qty,
                lineTotal,
              };
            }),
          insurancePlanId: insurancePlanId ?? undefined,
          insurancePlanName: selectedInsurance?.name,
          insurancePricePerDay: selectedInsurance?.pricePerDay,
          deliveryFee: estimate?.deliveryFee,
          depositAmount: listing.depositAmount ?? undefined,
        },
        authToken,
      );
      router.push('/order/success');
    } catch {
      setSubmitError('Radās kļūda veicot rezervāciju. Lūdzu mēģiniet vēlreiz.');
      setIsSubmitting(false);
    }
  };

  const onBookClick = () => {
    if (!token) {
      setShowAuthGate(true);
    } else {
      submitOrder(token);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const images = listing.imageUrls?.length > 0 ? listing.imageUrls : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
      {/* Breadcrumb & Back button */}
      <div className="mb-8 space-y-5">
        <nav className="text-[13px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <a href="/" className="hover:text-foreground transition-colors">
            Home
          </a>
          <ChevronRight className="size-3.5" />
          <a href="/order/equipment" className="hover:text-foreground transition-colors">
            Product catalog
          </a>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground font-semibold truncate max-w-50 sm:max-w-xs">
            {listing.name}
          </span>
        </nav>
        <Button
          variant="outline"
          className="rounded-full px-5 h-9 font-semibold text-sm border-border shadow-sm hover:bg-muted/50"
          asChild
        >
          <a href="/order/equipment">Go back to product listing</a>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-10 lg:gap-20">
        {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-10">
          {/* Header */}
          <div>
            <p className="text-sm font-bold text-[#e31f24] mb-2 tracking-wide">
              {listing.serviceType.replace('_', ' ')}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              {listing.name}
            </h1>
            {listing.subCategoryLabel && (
              <p className="text-[13px] font-bold tracking-widest text-muted-foreground uppercase mt-4">
                {listing.subCategoryLabel}
              </p>
            )}
            {listing.productCode && (
              <p className="text-sm font-medium text-muted-foreground mt-2">
                Product code: {listing.productCode}
              </p>
            )}
            {/* NO PROVIDER section anymore, to match the storent mockup specifically without altering too much */}
          </div>

          {/* Photo gallery */}
          {images.length > 0 ? (
            <div className="space-y-3">
              <div className="aspect-4/3 rounded-2xl overflow-hidden border border-border bg-muted relative">
                <Image
                  src={images[activeImage]}
                  alt={listing.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={cn(
                        'shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden bg-muted transition-all',
                        i === activeImage
                          ? 'border-primary'
                          : 'border-transparent opacity-60 hover:opacity-100',
                      )}
                    >
                      <Image
                        src={url}
                        alt=""
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-4/3 rounded-2xl bg-muted flex items-center justify-center border border-border">
              <Truck className="size-16 text-muted-foreground/20" />
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex border-b border-border mb-8 overflow-x-auto hide-scrollbar">
              {(
                [
                  { id: 'info', label: 'Product information' },
                  { id: 'availability', label: 'Product availability' },
                  { id: 'documents', label: 'Dokumenti un Rokasgrāmatas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-5 py-4 text-sm font-bold border-b-[3px] transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-[#e31f24] text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Product info tab */}
            {activeTab === 'info' && (
              <div className="space-y-8">
                {listing.description && (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {listing.description}
                  </p>
                )}

                {/* Specs table */}
                {listing.specs && Object.keys(listing.specs).length > 0 && (
                  <div>
                    <h3 className="text-base font-bold mb-4">Specifikācija</h3>
                    <div className="border border-border rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">
                          {Object.entries(listing.specs).map(([key, val]) => (
                            <tr key={key} className="even:bg-muted/30">
                              <th className="px-4 py-3 font-medium text-left w-1/2">{key}</th>
                              <td className="px-4 py-3 text-muted-foreground">{String(val)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Policies strip */}
                {(listing.fuelPolicy ||
                  listing.cancellationPolicy ||
                  listing.depositAmount ||
                  listing.lateReturnFeePerDay) && (
                  <div>
                    <h3 className="text-base font-bold mb-4">Politika</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {listing.fuelPolicy && (
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
                          <Fuel className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Degvielas politika
                            </p>
                            <p className="text-sm font-medium">
                              {policyLabel(listing.fuelPolicy, FUEL_LABELS)}
                            </p>
                          </div>
                        </div>
                      )}
                      {listing.cancellationPolicy && (
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
                          <XCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Atcelšana
                            </p>
                            <p className="text-sm font-medium">
                              {policyLabel(listing.cancellationPolicy, CANCEL_LABELS)}
                            </p>
                          </div>
                        </div>
                      )}
                      {listing.depositAmount && (
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
                          <ShieldCheck className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Depozīts
                            </p>
                            <p className="text-sm font-medium">
                              €{listing.depositAmount.toFixed(2)}{' '}
                              {listing.depositMethod && (
                                <span className="text-muted-foreground">
                                  ({policyLabel(listing.depositMethod, DEPOSIT_LABELS)})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                      {listing.lateReturnFeePerDay && (
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/30">
                          <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-0.5">
                              Vēlīna atgriešana
                            </p>
                            <p className="text-sm font-medium">
                              €{listing.lateReturnFeePerDay.toFixed(2)} / diena
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Required documents notice */}
                {listing.requiredDocuments &&
                  Object.values(listing.requiredDocuments).some(Boolean) && (
                    <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
                      <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-semibold text-amber-900 mb-1">Nepieciešamie dokumenti</p>
                        <ul className="text-amber-800 space-y-0.5 list-disc list-inside">
                          {listing.requiredDocuments.licenseType && (
                            <li>Operators ar {listing.requiredDocuments.licenseType} licenci</li>
                          )}
                          {listing.requiredDocuments.ownInsuranceRequired && (
                            <li>Savas atbildības apdrošināšana</li>
                          )}
                          {listing.requiredDocuments.siteInductionRequired && (
                            <li>Objekta instruktāžas apliecība</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* Availability tab */}
            {activeTab === 'availability' && (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Pelēkie datumi ir aizņemti vai nestrādājošie.
                </p>
                <div className="border border-border rounded-xl p-4 inline-block">
                  <Calendar
                    mode="single"
                    disabled={[...blockedDates, { before: new Date() }]}
                    classNames={{ months: 'space-y-0' }}
                  />
                </div>
              </div>
            )}

            {/* Documents tab */}
            {activeTab === 'documents' && (
              <div className="space-y-3">
                {!listing.documentUrls ||
                Object.values(listing.documentUrls as Record<string, unknown>).every((v) => !v) ? (
                  <p className="text-muted-foreground text-sm">Nav augšupielādētu dokumentu.</p>
                ) : (
                  <>
                    {(listing.documentUrls as { ce?: string }).ce && (
                      <a
                        href={(listing.documentUrls as { ce: string }).ce}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-border rounded-xl hover:bg-muted/40 transition-colors"
                      >
                        <FileText className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">CE deklarācija</span>
                      </a>
                    )}
                    {(listing.documentUrls as { inspection?: string }).inspection && (
                      <a
                        href={(listing.documentUrls as { inspection: string }).inspection}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-border rounded-xl hover:bg-muted/40 transition-colors"
                      >
                        <FileText className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">Tehniskā pārbaudes karte</span>
                      </a>
                    )}
                    {(listing.documentUrls as { manual?: string }).manual && (
                      <a
                        href={(listing.documentUrls as { manual: string }).manual}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 border border-border rounded-xl hover:bg-muted/40 transition-colors"
                      >
                        <FileText className="size-5 text-muted-foreground" />
                        <span className="text-sm font-medium">Lietošanas rokasgrāmata</span>
                      </a>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN — 3-step booking widget ────────────────── */}
        <div className="relative">
          <div className="sticky top-24 border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/5 bg-card">
            {/* Price header */}
            <div className="px-5 pt-5 pb-4 border-b border-border">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold">€{listing.pricePerDay.toFixed(2)}</span>
                <span className="text-muted-foreground text-sm">
                  / {listing.unitLabel || 'diena'}
                </span>
              </div>
            </div>

            {/* Step indicator */}
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <StepIndicator
                step={step}
                hasAddOns={addOns.length > 0}
                hasInsurance={insuranceOptions.length > 0}
              />
            </div>

            <div className="p-5 space-y-5">
              {/* ── STEP 1: Date + address ──────────────────────── */}
              {step === 1 && (
                <>
                  {/* Date FROM / TO */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Datums no
                      </label>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="date"
                          className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          value={dateFrom ? format(dateFrom, 'yyyy-MM-dd') : ''}
                          min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const d = e.target.value
                              ? new Date(e.target.value + 'T00:00:00')
                              : undefined;
                            setDateFrom(d);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Datums līdz
                      </label>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <input
                          readOnly
                          className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm bg-muted/30 text-muted-foreground cursor-not-allowed"
                          value={dateTo ? format(dateTo, 'dd.MM.yyyy') : '—'}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Day count slider */}
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Nomas dienas
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={listing.minHireDays || 1}
                          max={listing.maxHireDays || 30}
                          value={hireDays || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) setHireDays(Math.max(listing.minHireDays || 1, val));
                          }}
                          className="w-16 h-8 text-center text-sm font-bold p-0"
                        />
                        <span className="text-sm text-muted-foreground">dienas</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min={listing.minHireDays || 1}
                        max={listing.maxHireDays || 30}
                        value={hireDays}
                        onChange={(e) => setHireDays(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>{listing.minHireDays || 1}</span>
                        <span>{listing.maxHireDays || 30}</span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> Piegādes adrese
                    </label>
                    <AddressAutocomplete
                      value={address}
                      onChange={setAddress}
                      onSelect={handleAddressSelect}
                      placeholder="Ievadiet piegādes adresi"
                    />
                    {addressError && (
                      <p className="text-destructive text-xs flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="size-3.5 shrink-0" />
                        {addressError}
                      </p>
                    )}
                    {listing.freeDeliveryRadiusKm && !addressError && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="size-3 shrink-0" />
                        Bezmaksas piegāde {listing.freeDeliveryRadiusKm} km rādiusā
                      </p>
                    )}
                  </div>

                  <PricePreview
                    estimate={estimate}
                    listing={listing}
                    hireDays={hireDays}
                    loading={estimateLoading}
                    step={1}
                  />

                  <Button
                    className="w-full h-11 font-bold"
                    disabled={!canProceedStep1}
                    onClick={() => {
                      if (addOns.length > 0) setStep(2);
                      else if (insuranceOptions.length > 0) setStep(3);
                      else onBookClick();
                    }}
                  >
                    {addOns.length > 0 || insuranceOptions.length > 0 ? (
                      <>
                        Turpināt <ChevronRight className="size-4 ml-1" />
                      </>
                    ) : (
                      'Rezervēt'
                    )}
                  </Button>
                </>
              )}

              {/* ── STEP 2: Add-ons ──────────────────────────────── */}
              {step === 2 && (
                <>
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Papildu aprīkojums (pēc izvēles)
                    </p>
                    {addOns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nav pieejamu papildinājumu.</p>
                    ) : (
                      addOns.map((addOn) => {
                        const selected = (selectedAddOns[addOn.id] ?? 0) > 0;
                        const priceLabel =
                          addOn.pricePerDay != null
                            ? `+€${addOn.pricePerDay.toFixed(2)}/d.`
                            : addOn.priceFlat != null
                              ? `+€${addOn.priceFlat.toFixed(2)}`
                              : 'Iekļauts';
                        return (
                          <button
                            key={addOn.id}
                            onClick={() => toggleAddOn(addOn.id, addOn.maxQty)}
                            className={cn(
                              'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                              selected
                                ? 'border-primary bg-primary/5'
                                : 'border-border bg-background hover:bg-muted/30',
                            )}
                          >
                            <div
                              className={cn(
                                'mt-0.5 size-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                                selected ? 'bg-primary border-primary' : 'border-muted-foreground',
                              )}
                            >
                              {selected && (
                                <svg
                                  viewBox="0 0 12 12"
                                  className="size-2.5 text-primary-foreground fill-current"
                                >
                                  <path
                                    d="M1 6l3.5 3.5L11 2"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-sm font-semibold">{addOn.name}</span>
                                <span
                                  className={cn(
                                    'text-sm font-bold shrink-0',
                                    selected ? 'text-primary' : 'text-foreground',
                                  )}
                                >
                                  {priceLabel}
                                </span>
                              </div>
                              {addOn.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {addOn.description}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <PricePreview
                    estimate={estimate}
                    listing={listing}
                    hireDays={hireDays}
                    loading={estimateLoading}
                    step={2}
                  />

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)}>
                      <ChevronLeft className="size-4 mr-1" /> Atpakaļ
                    </Button>
                    <Button
                      className="flex-1 h-11 font-bold"
                      onClick={() => {
                        if (insuranceOptions.length > 0) setStep(3);
                        else onBookClick();
                      }}
                    >
                      {insuranceOptions.length > 0 ? (
                        <>
                          Turpināt <ChevronRight className="size-4 ml-1" />
                        </>
                      ) : (
                        'Rezervēt'
                      )}
                    </Button>
                  </div>
                </>
              )}

              {/* ── STEP 3: Insurance + book ──────────────────────── */}
              {step === 3 && (
                <>
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Apdrošināšana{' '}
                      {listing.insuranceRequired && (
                        <span className="text-destructive">(obligāta)</span>
                      )}
                    </p>

                    {!listing.insuranceRequired && (
                      <InsuranceOption
                        selected={insurancePlanId === null}
                        onSelect={() => setInsurancePlanId(null)}
                        name="Bez seguma"
                        description="Uzņemos pilnu atbildību par bojājumiem"
                        priceLabel="€0 / d."
                        danger
                      />
                    )}

                    {insuranceOptions.map((ins) => (
                      <InsuranceOption
                        key={ins.id}
                        selected={insurancePlanId === ins.id}
                        onSelect={() => setInsurancePlanId(ins.id)}
                        name={ins.name}
                        description={ins.description}
                        priceLabel={`+€${ins.pricePerDay.toFixed(2)} / d.`}
                        extras={
                          [
                            ins.excess != null && `Pašrisks: €${ins.excess}`,
                            ins.coversTheft && 'Zādzības segums',
                            ins.coversThirdParty && 'Trešo personu atbildība',
                          ].filter(Boolean) as string[]
                        }
                      />
                    ))}
                  </div>

                  {/* Deposit notice */}
                  {listing.depositAmount && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <Info className="size-3.5 shrink-0 mt-0.5" />
                      <span>
                        Drošības depozīts:{' '}
                        <strong className="text-foreground">
                          €{listing.depositAmount.toFixed(2)}
                        </strong>{' '}
                        {listing.depositMethod &&
                          `(${policyLabel(listing.depositMethod, DEPOSIT_LABELS)?.toLowerCase()})`}
                      </span>
                    </div>
                  )}

                  {/* Contact */}
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Kontaktinformācija
                    </p>
                    <Input
                      placeholder="Vārds Uzvārds"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="h-10 text-sm"
                    />
                    <Input
                      placeholder="Tālrunis"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="h-10 text-sm"
                    />
                    {!user && (
                      <Input
                        placeholder="E-pasts"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="h-10 text-sm"
                      />
                    )}
                  </div>

                  {/* Full price breakdown */}
                  <PricePreview
                    estimate={estimate}
                    listing={listing}
                    hireDays={hireDays}
                    loading={estimateLoading}
                    step={3}
                    full
                  />

                  {submitError && (
                    <p className="text-destructive text-xs flex items-center gap-1.5 font-medium bg-destructive/10 rounded-lg px-3 py-2">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {submitError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => setStep(addOns.length > 0 ? 2 : 1)}
                    >
                      <ChevronLeft className="size-4 mr-1" /> Atpakaļ
                    </Button>
                    <Button
                      className="flex-1 h-11 font-bold"
                      disabled={!canBook || isSubmitting}
                      onClick={onBookClick}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="size-4 mr-1.5 animate-spin" /> Apstrādā...
                        </>
                      ) : (
                        'Rezervēt'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <WebWizardAuthGate
        open={showAuthGate}
        onDismiss={() => setShowAuthGate(false)}
        prefilledName={contactName}
        prefilledPhone={contactPhone}
        onAuthenticated={(_usr, tok) => {
          setShowAuthGate(false);
          submitOrder(tok);
        }}
        onGuestContact={(info) => {
          setShowAuthGate(false);
          submitOrder(undefined, info);
        }}
      />
    </div>
  );
}
