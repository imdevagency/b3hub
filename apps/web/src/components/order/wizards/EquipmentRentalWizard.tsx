/**
 * EquipmentRentalWizard
 *
 * 4-step wizard for equipment rental (excavators, dumpers, compactors, etc.)
 * and site support services (scaffolding, temp fencing, generators, etc.).
 *
 * Used by both the public marketing site (/order/equipment) and the
 * authenticated dashboard (/dashboard/order/equipment).
 *
 * Flow: equipment type + quantity → address → hire period → contact + confirm
 *
 *  mode="public"    → contact from guest → auth gate fires on submit
 *  mode="dashboard" → contact pre-filled from user profile → submits directly
 */
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays, addDays, format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WizardShell } from '@/components/order/WizardShell';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { WebWizardAuthGate, type GuestContactInfo } from '@/components/order/WebWizardAuthGate';
import { Container } from '@/components/marketing/layout/Container';
import { Calendar } from '@/components/ui/calendar';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  createRentalOrder,
  getRentalListingAvailability,
  checkRentalListingRadius,
  type RentalServiceType,
} from '@/lib/api/rentals';
import type { User } from '@/lib/api';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Minus,
  MapPin,
  Phone,
  Plus,
  User as UserIcon,
} from 'lucide-react';
import type { ServiceDef } from '@/lib/equipment-services';
import { useEquipmentServices } from '@/lib/use-equipment-services';

// ── Step types (mirrors MaterialOrderWizard pattern) ─────────────────────────

// Airbnb flow: pick dates first → delivery address → review & book
type WizardStep = 'period' | 'where' | 'contact' | 'confirmed';
const STEP_INDEX: Record<WizardStep, number> = {
  period: 0,
  where: 1,
  contact: 2,
  confirmed: 2,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
  initialServiceType?: RentalServiceType;
  /** When set, locks to a specific provider listing (Wolt pattern). */
  listingId?: string;
  /** Real listing data — overrides static catalog price/label when booking a specific provider listing. */
  listingData?: {
    name: string;
    pricePerDay: number;
    unitLabel?: string;
    description?: string;
    providerName?: string;
    coverageCities?: string[];
  };
}

export function EquipmentRentalWizard({ mode, initialServiceType, listingId, listingData }: Props) {
  const { user, token } = useAuth();
  const router = useRouter();
  const equipmentServices = useEquipmentServices();

  const initialService = initialServiceType
    ? equipmentServices.find((s) => s.type === initialServiceType) || null
    : null;

  // Airbnb pattern: open with date picker, price visible throughout
  const [step, setStep] = useState<WizardStep>('period');
  const [orderNumber, setOrderNumber] = useState('');

  // specs
  const [selectedService, setSelectedService] = useState<ServiceDef | null>(initialService);
  const [quantity, setQuantity] = useState(1);
  const [specNotes, setSpecNotes] = useState('');

  // where
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  // period
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');

  // contact
  const [contactName, setContactName] = useState(
    mode === 'dashboard' && user
      ? `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim()
      : '',
  );
  const [contactPhone, setContactPhone] = useState(
    mode === 'dashboard' ? ((user as any)?.phone ?? '') : '',
  );
  const [contactEmail, setContactEmail] = useState(mode === 'dashboard' ? (user?.email ?? '') : '');
  const [driverNotes, setDriverNotes] = useState('');

  // auth gate
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [pendingAction, setPendingAction] = useState<((tok: string) => Promise<void>) | null>(null);

  // submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // availability: blocked dates + radius
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [addressOutOfRange, setAddressOutOfRange] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;
    getRentalListingAvailability(listingId)
      .then((res) => {
        setBlockedDates(res.blockedDates.map((d) => new Date(d + 'T00:00:00')));
      })
      .catch(() => {});
  }, [listingId]);

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
          {
            featureType: 'road.arterial',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#757575' }],
          },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d9e8' }] },
          {
            featureType: 'water',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#9e9e9e' }],
          },
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

  // ── Derived ────────────────────────────────────────────────────────────────
  const hireDays =
    dateRange?.from && dateRange?.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : 0;

  // When a real provider listing is booked, use its actual price/label/name.
  // Fall back to the static catalog entry for generic (type-only) orders.
  const effectivePrice = listingData?.pricePerDay ?? selectedService?.priceFrom ?? 0;
  const effectiveUnit = listingData?.unitLabel ?? selectedService?.unitLabel ?? 'vienība';
  const effectiveName = listingData?.name ?? selectedService?.label ?? '';
  const effectiveDescription = listingData?.description ?? selectedService?.description ?? '';

  const estimatedPrice = quantity * hireDays * effectivePrice;

  const catalogHref = mode === 'dashboard' ? '/dashboard/order/equipment' : '/order/equipment';

  // ── Submit ──────────────────────────────────────────────────
  const doSubmit = useCallback(
    async (authToken: string) => {
      if (!selectedService || !dateRange?.from) return;
      setSubmitting(true);
      setSubmitError('');
      try {
        const noteParts = [specNotes, driverNotes].filter(Boolean);
        const result = await createRentalOrder(
          {
            listingId: listingId || undefined,
            serviceType: selectedService.type,
            address,
            city,
            lat,
            lng,
            hireDays,
            deliveryDate: format(dateRange.from, 'yyyy-MM-dd'),
            deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
            quantity,
            price: estimatedPrice,
            paymentMethod: 'CARD',
            contactName: contactName.trim() || undefined,
            contactEmail: contactEmail.trim() || undefined,
            contactPhone: contactPhone.trim() || undefined,
            notes: noteParts.join('\n') || undefined,
          },
          authToken || undefined,
        );
        setOrderNumber(result.orderNumber);
        setStep('confirmed');
      } catch {
        setSubmitError('Neizdevās nosūtīt pieteikumu. Lūdzu, mēģiniet vēlreiz.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedService,
      address,
      city,
      lat,
      lng,
      hireDays,
      dateRange,
      deliveryWindow,
      quantity,
      estimatedPrice,
      contactName,
      contactEmail,
      contactPhone,
      specNotes,
      driverNotes,
    ],
  );

  function requireAuth(action: (tok: string) => Promise<void>) {
    if (token) {
      action(token);
    } else if (mode === 'public') {
      setPendingAction(() => action);
      setShowAuthGate(true);
    } else {
      setPendingAction(() => action);
      setShowAuthGate(true);
    }
  }

  const wizardTitle =
    step === 'confirmed' ? 'Rezervācija apstiprināta' : (selectedService?.label ?? 'Tehnikas noma');

  const backSteps: Partial<Record<WizardStep, WizardStep>> = {
    where: 'period',
    contact: 'where',
  };

  const wizardContent = (
    <WizardShell
      step={STEP_INDEX[step] + 1}
      totalSteps={3}
      title={wizardTitle}
      onBack={
        step !== 'confirmed'
          ? () => {
              const prev = backSteps[step];
              if (prev) setStep(prev);
              else router.push(catalogHref);
            }
          : undefined
      }
      onClose={step !== 'confirmed' ? () => router.push(catalogHref) : undefined}
    >
      {/* ── Airbnb-style sticky price pill (steps 2 & 3) ────── */}
      {(step === 'where' || step === 'contact') && selectedService && (
        <div className="mb-5 rounded-2xl bg-[#203728]/8 border border-[#203728]/15 px-4 py-3">
          <div className="flex items-center gap-3">
            <selectedService.Icon className="size-5 text-[#203728] shrink-0" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold truncate text-foreground">{effectiveName}</p>
              <p className="text-xs font-medium text-muted-foreground truncate">
                {quantity} {effectiveUnit}
                {hireDays > 0 ? ` · ${hireDays} ${hireDays === 1 ? 'diena' : 'dienas'}` : ''}
              </p>
            </div>
            {hireDays > 0 && (
              <span className="font-extrabold text-lg text-[#203728] shrink-0">
                €{estimatedPrice.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Step 1: period + quantity (Airbnb: dates first, price updates live) ── */}
      {step === 'period' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          {/* Product identity card — always visible in step 1 */}
          {selectedService && (
            <div className="rounded-2xl bg-[#203728]/8 border border-[#203728]/15 px-4 py-3 flex items-center gap-3">
              <div
                className={`flex items-center justify-center size-10 rounded-xl border shrink-0 ${selectedService.color ?? 'bg-muted border-border text-muted-foreground'}`}
              >
                <selectedService.Icon className="size-5" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-foreground truncate">{effectiveName}</p>
                <p className="text-xs text-muted-foreground truncate">{effectiveDescription}</p>
              </div>
              <span className="text-sm font-bold text-[#203728] shrink-0">
                €{effectivePrice} / {effectiveUnit}
              </span>
            </div>
          )}

          <div>
            <p className="text-xl font-bold text-foreground">Izvēlieties datumus</p>
            <p className="text-sm text-muted-foreground mt-1">Norādiet nomas periodu</p>
          </div>

          {/* Quick period chips */}
          {selectedService && (
            <div className="flex flex-wrap gap-2">
              {selectedService.hirePeriodOptions.map((opt) => {
                const isActive = hireDays === opt.days;
                return (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => {
                      const from = addDays(new Date(), 1);
                      setDateRange({ from, to: addDays(from, opt.days - 1) });
                    }}
                    className={`rounded-xl px-4 py-2 text-[13px] font-bold transition-all ${
                      isActive
                        ? 'bg-[#203728] text-white shadow-sm'
                        : 'bg-muted/50 text-muted-foreground border border-border/50 hover:bg-muted/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Date range calendar */}
          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              disabled={[{ before: addDays(new Date(), 1) }, ...blockedDates]}
              modifiers={blockedDates.length > 0 ? { booked: blockedDates } : undefined}
              modifiersClassNames={
                blockedDates.length > 0
                  ? { booked: 'opacity-40 line-through text-destructive' }
                  : undefined
              }
              className="p-3"
            />
          </div>

          {/* Live price card — appears once dates are selected (Airbnb pattern) */}
          {dateRange?.from && dateRange?.to && selectedService && (
            <div className="rounded-2xl border border-[#203728]/20 bg-[#203728]/5 px-4 py-4 space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                <span>
                  €{effectivePrice} × {quantity} {effectiveUnit} × {hireDays}{' '}
                  {hireDays === 1 ? 'diena' : 'dienas'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold text-foreground">Kopā (orientējoši)</span>
                <span className="text-2xl font-extrabold text-[#203728]">
                  €{estimatedPrice.toFixed(0)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Galīgo cenu apstiprinās operators</p>
            </div>
          )}

          {/* Quantity stepper (compact, below calendar) */}
          {selectedService && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Daudzums</p>
              <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-muted/20 px-5 py-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex items-center justify-center size-10 rounded-xl border border-border/60 bg-background shadow-sm hover:bg-muted/80 transition-colors disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {quantity}
                  </span>
                  <span className="ml-2 text-sm font-semibold text-muted-foreground">
                    {effectiveUnit}
                  </span>
                </div>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex items-center justify-center size-10 rounded-xl border border-border/60 bg-background shadow-sm hover:bg-muted/80 transition-colors"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Delivery window */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Piegādes laiks</p>
            <div className="flex gap-2">
              {(
                [
                  { value: 'ANY', label: 'Jebkurā' },
                  { value: 'AM', label: 'Rīts (8–12)' },
                  { value: 'PM', label: 'Pēcpusd. (12–17)' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryWindow(value)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    deliveryWindow === value
                      ? 'bg-foreground text-background'
                      : 'bg-background text-muted-foreground border border-border/50 hover:bg-muted/60'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Spec notes */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Tehniskās prasības{' '}
              <span className="text-muted-foreground font-normal">(neobligāti)</span>
            </label>
            <Textarea
              value={specNotes}
              onChange={(e) => setSpecNotes(e.target.value)}
              placeholder="piem. nepieciešams operators, jauda, pielikumi..."
              rows={2}
              className="rounded-2xl border-0 bg-muted/40 text-[15px] font-medium focus-visible:ring-foreground/10 resize-none"
            />
          </div>

          <Button
            onClick={() => setStep('where')}
            disabled={!dateRange?.from || !dateRange?.to}
            className="w-full rounded-2xl h-12 text-[15px] font-bold bg-[#203728] text-white hover:bg-[#203728]/90"
          >
            Tālāk — piegādes adrese <ArrowRight className="size-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Step 2: where (delivery address) ───────────────────── */}
      {step === 'where' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
          <Step2Address
            value={address}
            lat={lat}
            lng={lng}
            onAddressChange={async (a, newLat, newLng, c) => {
              setAddress(a);
              setCity(c ?? '');
              setLat(newLat);
              setLng(newLng);
              setAddressOutOfRange(null);
              if (newLat && newLng) {
                updateMapPin(newLat, newLng);
                if (listingId) {
                  try {
                    const check = await checkRentalListingRadius(listingId, newLat, newLng);
                    if (!check.withinRadius && check.maxRadiusKm) {
                      setAddressOutOfRange(
                        `Šis operators nepiegādā uz šo adresi. Piegādes rādiuss: ${check.maxRadiusKm} km (jūs: ${check.distanceKm} km).`,
                      );
                    }
                  } catch {
                    // non-blocking — don't block the wizard
                  }
                }
              }
            }}
            title="Kur piegādāt iekārtu?"
            subtitle="Ievadiet precīzu būvlaukuma adresi vai izmantojiet GPS"
            nextLabel="Tālāk — apskats un rezervācija"
            onNext={() => setStep('contact')}
            onBack={() => setStep('period')}
            nextDisabled={!!addressOutOfRange}
            nextError={addressOutOfRange ?? undefined}
          />
        </div>
      )}

      {/* ── Step 3: review & book (Airbnb "Review your trip" page) ─ */}
      {step === 'contact' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <h2 className="text-xl font-bold">Apskats un rezervācija</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pārbaudiet informāciju un apstipriniet pasūtījumu
            </p>
          </div>

          {/* Airbnb-style price breakdown card */}
          {selectedService && hireDays > 0 && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 overflow-hidden">
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    €{effectivePrice} × {quantity} {effectiveUnit} × {hireDays} d.
                  </span>
                  <span className="font-semibold text-foreground">
                    €{estimatedPrice.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Piegāde un pacelšana</span>
                  <span className="font-semibold text-foreground">Iekļauta</span>
                </div>
                {address && (
                  <div className="flex items-start justify-between text-sm gap-4">
                    <span className="text-muted-foreground shrink-0">Adrese</span>
                    <span className="font-semibold text-foreground text-right truncate max-w-44">
                      {address}
                    </span>
                  </div>
                )}
                {dateRange?.from && dateRange?.to && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Periods</span>
                    <span className="font-semibold text-foreground">
                      {dateRange.from.toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      {' – '}
                      {dateRange.to.toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}
                <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">Kopā</span>
                  <span className="text-xl font-extrabold text-[#203728]">
                    ~€{estimatedPrice.toFixed(0)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Galīgo cenu apstiprinās operators pēc pieteikuma saņemšanas
                </p>
              </div>
            </div>
          )}

          {/* Contact details */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Kontaktinformācija</h3>
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
              <div>
                <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <Mail className="size-3.5" /> E-pasts
                  {mode === 'public' ? (
                    <span className="text-muted-foreground font-normal">(neobligāti)</span>
                  ) : null}
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
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">
                  Piekļuves instrukcijas{' '}
                  <span className="text-muted-foreground font-normal">(neobligāti)</span>
                </label>
                <Textarea
                  placeholder="Vārti, piekļuves kodi, instrukcijas šoferim..."
                  value={driverNotes}
                  onChange={(e) => setDriverNotes(e.target.value)}
                  rows={2}
                  className="rounded-xl resize-none"
                />
              </div>
            </div>
          </div>

          {!contactPhone.trim() && (
            <p className="text-sm text-destructive font-medium">
              Tālrunis ir obligāts — operators sazināsies piegādes dienā.
            </p>
          )}

          {submitError && <p className="text-sm text-destructive font-medium">{submitError}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setStep('where')}
              className="flex-1 rounded-xl border py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Atpakaļ
            </button>
            <button
              onClick={() => requireAuth(doSubmit)}
              disabled={!contactPhone.trim() || submitting}
              className="flex-2 rounded-2xl bg-[#203728] py-3 px-6 text-sm font-bold text-white hover:bg-[#203728]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="size-4 animate-spin mx-auto" /> : 'Rezervēt tagad'}
            </button>
          </div>

          {mode === 'public' && (
            <p className="text-xs text-center text-muted-foreground">Rezervēt var bez konta</p>
          )}
        </div>
      )}

      {/* ── Confirmed ────────────────────────────────────────── */}
      {step === 'confirmed' && (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
          <div className="flex size-20 items-center justify-center rounded-full bg-foreground">
            <CheckCircle2 className="size-9 text-background" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">Rezervācija apstiprināta!</p>
            <p className="text-base text-muted-foreground font-medium mt-1">
              Nr. <span className="font-bold text-foreground">{orderNumber}</span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Operators sazināsies ar jums, lai apstiprinātu piegādi un galīgo cenu.
          </p>
          <div className="w-full space-y-3 pt-2">
            {token && (
              <Button
                onClick={() => router.push('/dashboard/orders')}
                className="w-full rounded-2xl h-12 font-bold bg-[#203728] text-white hover:bg-[#203728]/90"
              >
                Skatīt pasūtījumus
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push(catalogHref)}
              className="w-full rounded-2xl h-12 font-semibold"
            >
              Atgriezties katalogā
            </Button>
          </div>
        </div>
      )}
    </WizardShell>
  );

  if (mode === 'public') {
    return (
      <>
        <Container className="pt-32 pb-24 flex max-lg:flex-col items-start gap-10 lg:gap-20">
          <div className="flex flex-col w-full lg:w-110 xl:w-120 shrink-0 bg-background rounded-2xl shadow-xl border border-border/40 overflow-hidden">
            {wizardContent}
          </div>
          {/* Right: map panel / equipment details */}
          <div className="hidden lg:flex flex-1 items-center justify-center p-10 h-150 sticky top-28 rounded-3xl overflow-hidden ring-1 ring-border/40 shadow-xl bg-muted/10">
            {/* Equipment info card shown on step 1 (period) */}
            {step === 'period' && selectedService && (
              <div className="absolute inset-0 bg-white p-12 flex flex-col justify-center animate-in fade-in duration-300">
                <div className="w-full max-w-lg mx-auto">
                  <div className="flex items-center gap-5 mb-10">
                    <selectedService.Icon className="size-10 text-foreground" strokeWidth={1.5} />
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        {effectiveName}
                      </h2>
                      {listingData?.providerName && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {listingData.providerName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border/50 divide-y divide-border/50">
                    <div className="py-5 flex shrink-0 items-start justify-between gap-4">
                      <span className="text-sm font-medium text-muted-foreground w-1/3">
                        Apraksts
                      </span>
                      <span className="text-sm font-medium text-foreground text-right">
                        {effectiveDescription}
                      </span>
                    </div>
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Vienība</span>
                      <span className="text-sm font-medium text-foreground capitalize">
                        1 {effectiveUnit}
                      </span>
                    </div>
                    {listingData?.coverageCities && listingData.coverageCities.length > 0 && (
                      <div className="py-5 flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Piegādes zona
                        </span>
                        <span className="text-sm font-medium text-foreground text-right">
                          {listingData.coverageCities.slice(0, 4).join(', ')}
                          {listingData.coverageCities.length > 4 ? ' u.c.' : ''}
                        </span>
                      </div>
                    )}
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        {listingData ? 'Cena' : 'Cena (no)'}
                      </span>
                      <div className="text-right">
                        <span className="text-xl font-bold text-foreground">€{effectivePrice}</span>
                        <span className="text-sm font-medium text-muted-foreground ml-1">/d.</span>
                      </div>
                    </div>
                    {hireDays > 0 && (
                      <div className="py-5 flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Izvēlēts periods
                        </span>
                        <span className="text-sm font-bold text-[#203728]">
                          {hireDays} {hireDays === 1 ? 'diena' : 'dienas'} · ~€
                          {estimatedPrice.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Map shown from step 2 onwards */}
            <div
              className={`absolute inset-0 bg-[#e5e3df] transition-opacity duration-300 ${step === 'period' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <div ref={mapDivRef} className="absolute inset-0" />
              {address && (
                <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                  <div className="bg-background/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-border/50 text-sm font-bold text-foreground flex items-center gap-2">
                    <MapPin className="size-4" />
                    <span className="truncate max-w-50">{address}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Container>
        <WebWizardAuthGate
          open={showAuthGate}
          onDismiss={() => setShowAuthGate(false)}
          onAuthenticated={(_user, tok) => {
            setShowAuthGate(false);
            if (pendingAction) pendingAction(tok);
          }}
          onGuestContact={(info: GuestContactInfo) => {
            setShowAuthGate(false);
            setContactName(info.name ?? '');
            setContactPhone(info.phone ?? '');
            if (info.email) setContactEmail(info.email);
            doSubmit('');
          }}
        />
      </>
    );
  }

  // Dashboard mode: no outer container, wizard fills its parent
  return (
    <>
      <div className="-m-6 xl:-m-8 flex min-h-[calc(100svh-4rem)]">
        <div className="w-full lg:w-125 xl:w-135 border-r border-border/40 bg-background flex flex-col">
          {wizardContent}
        </div>
        <div className="hidden lg:flex flex-1 relative overflow-hidden bg-muted/10">
          {/* Equipment info card shown on step 1 (period) */}
          {step === 'period' && selectedService && (
            <div className="absolute inset-0 bg-white p-12 flex flex-col justify-center animate-in fade-in duration-300">
              <div className="w-full max-w-lg mx-auto">
                <div className="flex items-center gap-5 mb-10">
                  <selectedService.Icon className="size-10 text-foreground" strokeWidth={1.5} />
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                      {effectiveName}
                    </h2>
                    {listingData?.providerName && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {listingData.providerName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="border-t border-border/50 divide-y divide-border/50">
                  <div className="py-5 flex shrink-0 items-start justify-between gap-4">
                    <span className="text-sm font-medium text-muted-foreground w-1/3">
                      Apraksts
                    </span>
                    <span className="text-sm font-medium text-foreground text-right">
                      {effectiveDescription}
                    </span>
                  </div>
                  <div className="py-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Vienība</span>
                    <span className="text-sm font-medium text-foreground capitalize">
                      1 {effectiveUnit}
                    </span>
                  </div>
                  {listingData?.coverageCities && listingData.coverageCities.length > 0 && (
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Piegādes zona
                      </span>
                      <span className="text-sm font-medium text-foreground text-right">
                        {listingData.coverageCities.slice(0, 4).join(', ')}
                        {listingData.coverageCities.length > 4 ? ' u.c.' : ''}
                      </span>
                    </div>
                  )}
                  <div className="py-5 flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {listingData ? 'Cena' : 'Cena (no)'}
                    </span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-foreground">€{effectivePrice}</span>
                      <span className="text-sm font-medium text-muted-foreground ml-1">/d.</span>
                    </div>
                  </div>
                  {hireDays > 0 && (
                    <div className="py-5 flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Izvēlēts periods
                      </span>
                      <span className="text-sm font-bold text-[#203728]">
                        {hireDays} {hireDays === 1 ? 'diena' : 'dienas'} · ~€
                        {estimatedPrice.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* Map layer (visible from step 2 onwards) */}
          <div
            className={`absolute inset-0 bg-[#e5e3df] transition-opacity duration-300 ${step === 'period' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
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
        </div>
      </div>
      <WebWizardAuthGate
        open={showAuthGate}
        onDismiss={() => setShowAuthGate(false)}
        onAuthenticated={(_user, tok) => {
          setShowAuthGate(false);
          if (pendingAction) pendingAction(tok);
        }}
        onGuestContact={(info: GuestContactInfo) => {
          setShowAuthGate(false);
          setContactName(info.name ?? '');
          setContactPhone(info.phone ?? '');
          if (info.email) setContactEmail(info.email);
          doSubmit('');
        }}
      />
    </>
  );
}
