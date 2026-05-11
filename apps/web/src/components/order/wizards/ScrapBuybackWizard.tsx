/**
 * ScrapBuybackWizard
 *
 * Web wizard for the scrap metal buyback (iepirkšana) flow.
 * Material type is always METAL — buyers get paid per tonne.
 *
 * Flow:
 *   Step 1 — Material: fixed METAL badge + dual t/kg weight + photo toggle + transport mode
 *   Step 2 — Location: pickup address (or "your location" for self-delivery)
 *   Step 3 — Offers: recycling centers ranked by payout (requires auth)
 *   Step 4 — Contact + date → creates disposal order with buybackPricePerTonne
 *
 * Auth gate fires at step 2→3 (offer prices require account — aligns with mobile).
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { WizardShell } from '@/components/order/WizardShell';
import { WebWizardAuthGate } from '@/components/order/WebWizardAuthGate';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { Container } from '@/components/marketing/layout/Container';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { getBuybackQuote, type BuybackQuoteResult } from '@/lib/api/recycling-centers';
import { createDisposalOrder, type DisposalTruckType } from '@/lib/api/orders';
import type { User } from '@/lib/api';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Scale,
  Truck,
  User as UserIcon,
  Wrench,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAP_STYLES = [
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
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const DRAFT_KEY = 'b3hub_scrap_buyback_wizard_draft';
const DRAFT_TTL = 3 * 24 * 60 * 60 * 1000;

type WizardStep = 'material' | 'address' | 'offers' | 'contact' | 'sent';
type TransportMode = 'pickup' | 'self';

const STEP_INDEX: Record<WizardStep, number> = {
  material: 1,
  address: 2,
  offers: 3,
  contact: 4,
  sent: 4,
};

function deriveTruck(weightT: number): { truckType: string; truckCount: number } {
  if (weightT <= 7) return { truckType: 'TIPPER_SMALL', truckCount: 1 };
  if (weightT <= 15) return { truckType: 'TIPPER_LARGE', truckCount: 1 };
  return { truckType: 'ARTICULATED_TIPPER', truckCount: Math.max(1, Math.ceil(weightT / 20)) };
}

function tToKg(t: string): string {
  const n = parseFloat(t);
  return isNaN(n) ? '' : String(Math.round(n * 1000));
}

function kgToT(kg: string): string {
  const n = parseFloat(kg);
  if (isNaN(n)) return '';
  const t = n / 1000;
  return t % 1 === 0 ? String(t) : parseFloat(t.toFixed(3)).toString();
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
}

export function ScrapBuybackWizard({ mode }: Props) {
  const { token, user, setAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('material');

  // Step 1
  const [weightT, setWeightT] = useState('');
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [transport, setTransport] = useState<TransportMode>('pickup');

  // Step 2
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [notes, setNotes] = useState('');

  // Step 3
  const [offers, setOffers] = useState<BuybackQuoteResult[] | null>(null);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);

  // Step 4
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  const [refNumber, setRefNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Auth gate
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<((tok: string) => Promise<void>) | null>(null);

  // Pre-fill contact from user profile
  useEffect(() => {
    if (user && !contactPrefilled) {
      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      if (fullName || user.phone) {
        setContactName(fullName);
        setContactPhone(user.phone ?? '');
        setContactPrefilled(true);
      }
    }
  }, [user, contactPrefilled]);

  // Draft persistence
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        draftLoadedRef.current = true;
        return;
      }
      const d = JSON.parse(raw);
      if (Date.now() - (d.savedAt ?? 0) > DRAFT_TTL) {
        localStorage.removeItem(DRAFT_KEY);
        draftLoadedRef.current = true;
        return;
      }
      if (d.weightT) setWeightT(d.weightT);
      if (d.hasPhoto !== undefined) setHasPhoto(d.hasPhoto);
      if (d.transport) setTransport(d.transport);
      if (d.address) setAddress(d.address);
      if (d.city) setCity(d.city);
      if (d.lat) setLat(d.lat);
      if (d.lng) setLng(d.lng);
      if (d.notes) setNotes(d.notes);
      if (d.pickupDate) setPickupDate(d.pickupDate);
      if (d.step && d.step !== 'sent') setStep(d.step);
    } catch {
      /* ignore */
    } finally {
      draftLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || refNumber) {
      if (refNumber) localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        weightT,
        hasPhoto,
        transport,
        address,
        city,
        lat,
        lng,
        notes,
        pickupDate,
        step,
        savedAt: Date.now(),
      }),
    );
  }, [weightT, hasPhoto, transport, address, city, lat, lng, notes, pickupDate, step, refNumber]);

  // ── Map ───────────────────────────────────────────────────────────────────

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
        styles: MAP_STYLES,
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

  // ── Load offers ─────────────────────────────────────────────────────────

  const loadOffers = useCallback(
    async (tok: string) => {
      const wt = parseFloat(weightT);
      if (isNaN(wt) || wt <= 0) return;
      setOffersLoading(true);
      setOffersError('');
      setOffers(null);
      setSelectedCenterId(null);
      try {
        const res = await getBuybackQuote('METAL', wt * 1000, lat, lng);
        setOffers(res.data);
        if (res.data.length > 0) setSelectedCenterId(res.data[0].centerId);
      } catch {
        setOffersError('Neizdevās ielādēt piedāvājumus. Lūdzu, mēģiniet vēlreiz.');
      } finally {
        setOffersLoading(false);
      }
      void tok;
    },
    [weightT, lat, lng],
  );

  // ── Auth ─────────────────────────────────────────────────────────────────

  function handleAuthSuccess(authUser: User, authToken: string) {
    setAuth(authUser, authToken);
    setAuthGateOpen(false);
    if (pendingAction) {
      pendingAction(authToken);
      setPendingAction(null);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function submit(tok: string) {
    const wt = parseFloat(weightT) || 1;
    const { truckType, truckCount } = deriveTruck(wt);
    const selected = offers?.find((o) => o.centerId === selectedCenterId);

    const notesParts: string[] = [];
    if (notes) notesParts.push(notes);
    if (hasPhoto === true) notesParts.push('📷 Ir materiāla foto');
    if (hasPhoto === false) notesParts.push('Nav foto');
    if (transport === 'self')
      notesParts.push('Pircējs atvedīs pats — nav nepieciešams transports.');

    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createDisposalOrder(
        {
          pickupAddress: address,
          pickupCity: city || address.split(',').slice(-1)[0]?.trim() || 'Rīga',
          pickupLat: lat,
          pickupLng: lng,
          wasteType: 'METAL',
          truckType: truckType as DisposalTruckType,
          truckCount,
          estimatedWeight: wt,
          requestedDate: pickupDate,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notesParts.join('. ') || undefined,
          preferredRecyclingCenterId: selected?.centerId,
          buybackPricePerTonne: selected?.buybackPricePerTonne,
        },
        tok,
      );
      setRefNumber(result.jobNumber ?? result.orderNumber ?? '');
      setStep('sent');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const weightNum = parseFloat(weightT);
  const validWeight = !isNaN(weightNum) && weightNum > 0;

  const selectedOffer = offers?.find((o) => o.centerId === selectedCenterId) ?? null;
  const isSent = step === 'sent';

  function getOnBack(): (() => void) | undefined {
    if (isSent) return undefined;
    if (step === 'material')
      return mode === 'dashboard' ? () => router.push('/dashboard/order') : undefined;
    if (step === 'address') return () => setStep('material');
    if (step === 'offers') return () => setStep('address');
    if (step === 'contact') return () => setStep('offers');
    return undefined;
  }

  function getStepTitle(): string {
    if (isSent) return 'Pieteikums nosūtīts';
    if (step === 'material') return 'Metāls un apjoms';
    if (step === 'address')
      return transport === 'self' ? 'Jūsu atrašanās vieta' : 'Savākšanas adrese';
    if (step === 'offers') return 'Salīdzini cenas';
    return 'Kontaktinformācija';
  }

  // ── Wizard content ────────────────────────────────────────────────────────

  const wizardContent = (
    <WizardShell
      className={mode === 'dashboard' ? 'flex-1' : 'w-full h-auto'}
      step={STEP_INDEX[step]}
      totalSteps={4}
      title={getStepTitle()}
      onBack={getOnBack()}
      onClose={mode === 'public' && !isSent ? () => router.push('/order') : undefined}
      innerScroll={mode === 'dashboard'}
    >
      {/* ── Step 1: Material, weight, transport ── */}
      {step === 'material' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 p-2">
          {/* Fixed material badge */}
          <div className="flex items-center gap-3.5 rounded-4xl border-2 border-foreground bg-muted/30 px-4 py-3.5 shadow-sm transition-all hover:bg-muted/50">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground">
              <Wrench className="size-5 text-background" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground">Metāls / Dzelzslūžņi</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dzelzs, alumīnijs, varš, nerūsējošais tērauds, profili, stiegrojums
              </p>
            </div>
            <CheckCircle2 className="size-5 shrink-0 text-foreground" />
          </div>

          {/* Dual t / kg weight input */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-foreground mb-0.5">Materiāls un apjoms (t/kg)</p>
              <p className="text-xs text-muted-foreground">
                1 t = 1000 kg. Norādiet apjomu tonnās vai kilogramos.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0.01"
                  step="0.1"
                  placeholder="0"
                  value={weightT}
                  onChange={(e) => setWeightT(e.target.value)}
                  className="rounded-2xl border-none bg-muted/50 h-14 pl-5 pr-10 text-base font-semibold shadow-inner focus-visible:ring-1 focus-visible:ring-ring"
                  autoFocus
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  t
                </span>
              </div>
              <div className="h-px w-6 shrink-0 bg-border/70" />
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="10"
                  step="100"
                  placeholder="0"
                  value={tToKg(weightT)}
                  onChange={(e) => setWeightT(kgToT(e.target.value))}
                  className="rounded-2xl border-none bg-muted/50 h-14 pl-5 pr-10 text-base font-semibold shadow-inner focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  kg
                </span>
              </div>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">
              Precīzs svars nav obligāts — vadītājs izmēra uz vietas
            </p>
          </div>

          {/* Photo toggle */}
          <div>
            <p className="text-sm font-bold text-foreground mb-3">Vai Jums ir materiāla foto?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHasPhoto(true)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition-all',
                  hasPhoto === true
                    ? 'border-foreground bg-muted/30 text-foreground shadow-sm'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/30 hover:bg-muted/10',
                )}
              >
                <Camera className="size-4" />
                Ir foto
              </button>
              <button
                type="button"
                onClick={() => setHasPhoto(false)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-semibold transition-all',
                  hasPhoto === false
                    ? 'border-foreground bg-muted/30 text-foreground shadow-sm'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/30 hover:bg-muted/10',
                )}
              >
                Nav foto
              </button>
            </div>
          </div>

          {/* Transport toggle */}
          <div>
            <p className="text-sm font-bold text-foreground mb-3">Transportēšana</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransport('pickup')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 px-3 text-sm font-semibold text-center transition-all',
                  transport === 'pickup'
                    ? 'border-foreground bg-muted/30 text-foreground shadow-sm'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/30 hover:bg-muted/10',
                )}
              >
                <Truck className="size-5 mb-0.5" />
                <span>Atbrauks paņemt</span>
              </button>
              <button
                type="button"
                onClick={() => setTransport('self')}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 px-3 text-sm font-semibold text-center transition-all',
                  transport === 'self'
                    ? 'border-foreground bg-muted/30 text-foreground shadow-sm'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/30 hover:bg-muted/10',
                )}
              >
                <Car className="size-5 mb-0.5" />
                <span>Atvedīšu pats</span>
              </button>
            </div>
          </div>

          <Button
            className="w-full h-12 text-base rounded-full shadow-md hover:shadow-lg transition-all"
            size="lg"
            disabled={!validWeight}
            onClick={() => setStep('address')}
          >
            Turpināt <ArrowRight className="ml-2 size-5" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Location ── */}
      {step === 'address' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <Step2Address
            value={address}
            lat={lat}
            lng={lng}
            onAddressChange={(addr, la, ln, c) => {
              setAddress(addr);
              setLat(la);
              setLng(ln);
              if (c) setCity(c);
              if (la && ln) updateMapPin(la, ln);
            }}
            title={transport === 'self' ? 'Jūsu atrašanās vieta' : 'Kur atrodas metāls?'}
            subtitle={
              transport === 'self'
                ? 'Norādiet adresi, lai atrastu tuvāko pieņemšanas punktu.'
                : 'Pieņemšanas punkts nosūtīs pārvadātāju uz šo adresi.'
            }
            nextLabel="Skatīt piedāvājumus"
            onNext={() => {
              if (!token) {
                setPendingAction(() => async (tok: string) => {
                  setStep('offers');
                  await loadOffers(tok);
                });
                setAuthGateOpen(true);
              } else {
                setStep('offers');
                loadOffers(token);
              }
            }}
            onBack={() => setStep('material')}
            extra={
              transport === 'pickup' && lat && lng ? (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-foreground">
                    Piezīmes par atrašanās vietu
                  </label>
                  <Textarea
                    placeholder="piem. Pagalms, vārti pa kreisi, zvanīt ierodoties..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="resize-none rounded-2xl bg-muted/50 border-none shadow-inner text-base p-4 focus-visible:ring-1"
                  />
                </div>
              ) : undefined
            }
          />
        </div>
      )}

      {/* ── Step 3: Offer comparison ── */}
      {step === 'offers' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 p-2">
          <div>
            <p className="text-2xl font-extrabold text-foreground">Izdevīgākie piedāvājumi</p>
            <p className="text-sm font-medium text-muted-foreground mt-1.5">
              Aptuvenās cenas par {weightT} t metāla. Izvēlieties pieņemšanas punktu.
            </p>
          </div>

          {offersLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Meklē labākos piedāvājumus…</p>
            </div>
          )}

          {offersError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive space-y-2">
              <p>{offersError}</p>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto"
                onClick={() => token && loadOffers(token)}
              >
                Mēģināt vēlreiz
              </Button>
            </div>
          )}

          {!offersLoading && !offersError && offers !== null && offers.length === 0 && (
            <div className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Nav pieejamu piedāvājumu</p>
              <p>
                Šobrīd neviens pieņemšanas punkts nepiedāvā iepirkšanu jūsu reģionā. Lūdzu, mēģiniet
                vēlāk.
              </p>
            </div>
          )}

          {!offersLoading && offers && offers.length > 0 && (
            <>
              <div className="space-y-4">
                {offers.map((offer, idx) => {
                  const isSelected = offer.centerId === selectedCenterId;
                  const isBest = idx === 0;
                  return (
                    <button
                      key={offer.centerId}
                      onClick={() => setSelectedCenterId(offer.centerId)}
                      className={cn(
                        'w-full text-left rounded-4xl border-2 p-5 transition-all',
                        isSelected
                          ? 'border-foreground bg-foreground/5 shadow-md scale-[1.02]'
                          : 'border-border/60 bg-background hover:border-foreground/30 hover:bg-muted/30 shadow-sm',
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-extrabold text-lg text-foreground truncate">
                              {offer.name}
                            </p>
                            {isBest && (
                              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-800 tracking-wide uppercase">
                                Izdevīgāk
                              </span>
                            )}
                            {offer.licensed && (
                              <BadgeCheck className="size-5 shrink-0 text-emerald-600" />
                            )}
                          </div>
                          <p className="text-sm font-medium text-muted-foreground truncate">
                            {offer.city}
                            {offer.distanceKm != null ? ` · ${offer.distanceKm} km` : ''}
                          </p>
                          {offer.certifications.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2.5">
                              <Award className="size-3.5 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">
                                {offer.certifications.slice(0, 2).join(', ')}
                              </p>
                            </div>
                          )}
                          {offer.centerNotes && (
                            <p className="text-xs font-medium text-muted-foreground mt-1.5 italic">
                              {offer.centerNotes}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right space-y-1">
                          <p className="text-3xl font-black text-foreground tracking-tight">
                            €{offer.totalPayoutEur.toFixed(2)}
                          </p>
                          <p className="text-xs font-bold text-muted-foreground">
                            €{offer.buybackPricePerTonne}/t
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t-2 border-foreground/10 flex items-center justify-between text-sm font-bold text-foreground">
                          <span>Šis ir Jūsu izvēlētais punkts</span>
                          <CheckCircle2 className="size-5 text-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <Button
                  className="w-full h-12 text-base rounded-full shadow-md hover:shadow-lg transition-all"
                  size="lg"
                  disabled={!selectedCenterId}
                  onClick={() => setStep('contact')}
                >
                  Pieteikt nodošanu <ArrowRight className="ml-2 size-5" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 4: Contact + date ── */}
      {step === 'contact' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 p-2">
          <div>
            <p className="text-2xl font-extrabold text-foreground">Noformēt pieteikumu</p>
            <p className="text-sm font-medium text-muted-foreground mt-1.5">
              {transport === 'self'
                ? 'Pieņemšanas punkts sazināsies ar jums pirms nodošanas.'
                : 'Pārvadātājs sazināsies ar jums, lai vienotos par precīzu laiku.'}
            </p>
          </div>

          {selectedOffer && (
            <div className="rounded-4xl bg-muted/40 p-5 flex items-start justify-between gap-4 border border-border/50">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Pieņemšanas punkts
                </p>
                <p className="font-extrabold text-lg text-foreground truncate">
                  {selectedOffer.name}
                </p>
                <p className="text-sm font-medium text-muted-foreground">{selectedOffer.city}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-2xl font-black text-foreground">
                  €{selectedOffer.totalPayoutEur.toFixed(2)}
                </p>
                <p className="text-xs font-bold text-muted-foreground">
                  €{selectedOffer.buybackPricePerTonne}/t
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {transport === 'self'
                    ? 'Plānotais nodošanas datums'
                    : 'Vēlamais savākšanas datums'}
                </span>
              </label>
              <Input
                type="date"
                value={pickupDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setPickupDate(e.target.value)}
                className="rounded-2xl border-none bg-muted/50 h-14 px-5 text-base font-semibold shadow-inner focus-visible:ring-1"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="size-4 text-muted-foreground" />
                  Vārds Uzvārds
                </span>
              </label>
              <Input
                placeholder="Jānis Bērziņš"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="rounded-2xl border-none bg-muted/50 h-14 px-5 text-base font-semibold shadow-inner focus-visible:ring-1"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="size-4 text-muted-foreground" />
                  Tālruņa numurs
                </span>
              </label>
              <Input
                type="tel"
                placeholder="+371 XXXXXXXX"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="rounded-2xl border-none bg-muted/50 h-14 px-5 text-base font-semibold shadow-inner focus-visible:ring-1"
              />
            </div>

            {mode === 'public' && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-4 text-muted-foreground" />
                    E-pasts
                  </span>
                </label>
                <Input
                  type="email"
                  placeholder="jusu@epasts.lv"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="rounded-2xl border-none bg-muted/50 h-14 px-5 text-base font-semibold shadow-inner focus-visible:ring-1"
                />
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-sm font-medium text-destructive bg-destructive/10 rounded-xl px-4 py-3 border border-destructive/20 mt-4">
              {submitError}
            </p>
          )}

          <div className="rounded-2xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-xs text-yellow-900 leading-relaxed">
            <span className="font-bold">Nodokļu informācija:</span> Fiziskām personām no izmaksas
            tiek ieturēts <span className="font-bold">10% IIN</span>. Juridiskām personām piemēro{' '}
            <span className="font-bold">PVN reverso shēmu</span> — PVN jādeklarē pašiem. Precīzas
            saistības noskaidrojiet ar savu grāmatvedi.
          </div>

          <div className="pt-4">
            <Button
              className="w-full h-12 text-base rounded-full shadow-md hover:shadow-lg transition-all"
              size="lg"
              disabled={submitting || !contactPhone.trim()}
              onClick={() => {
                if (!token) {
                  setPendingAction(() => submit);
                  setAuthGateOpen(true);
                } else {
                  submit(token);
                }
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-5 animate-spin" />
                  Iesniedz…
                </>
              ) : (
                <>
                  Iesniegt pieteikumu <Scale className="ml-2 size-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Sent ── */}
      {isSent && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in slide-in-from-bottom-2 gap-5">
          <div className="flex size-20 items-center justify-center rounded-full bg-green-100 shadow-inner">
            <CheckCircle2 className="size-10 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-foreground">Pieteikums nosūtīts!</p>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm mx-auto">
              {transport === 'self'
                ? 'Pieņemšanas punkts sazināsies ar jums, lai vienotos par nodošanas laiku.'
                : 'Saņemsiet zvanu no pārvadātāja, lai vienotos par izbraukšanas laiku.'}
              {refNumber && (
                <>
                  <br />
                  <span className="font-mono font-bold text-foreground mt-2 block">
                    {refNumber}
                  </span>
                </>
              )}
            </p>
          </div>
          {selectedOffer && (
            <div className="rounded-4xl bg-muted/40 border border-border/50 p-5 w-full text-left">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Paredzamā izmaksa
              </p>
              <p className="text-4xl font-black text-foreground tracking-tight">
                €{selectedOffer.totalPayoutEur.toFixed(2)}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1.5 leading-relaxed">
                Precīzu summu noteiks pēc svēršanas{' '}
                <span className="font-bold text-foreground">{selectedOffer.name}</span> punktā.
              </p>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full h-12 text-base rounded-full shadow-sm hover:shadow transition-all"
            onClick={() =>
              mode === 'dashboard' ? router.push('/dashboard/orders') : router.push('/')
            }
          >
            {mode === 'dashboard' ? 'Uz pasūtījumiem' : 'Uz sākumu'}
          </Button>
        </div>
      )}
    </WizardShell>
  );

  // ── Right panel ───────────────────────────────────────────────────────────

  const rightPanel = (
    <div
      className={
        mode === 'public'
          ? 'hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-28 h-150 rounded-3xl shadow-xl ring-1 ring-border/40'
          : 'hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-0 h-[calc(100svh-4rem)]'
      }
    >
      {/* Map — always visible so Google Maps initializes into a sized div */}
      <div ref={mapDivRef} className="absolute inset-0" />

      {/* Address overlay pill */}
      {address && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate max-w-55">{address}</span>
          </div>
        </div>
      )}

      {/* Weight overlay pill */}
      {weightT && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-sm font-bold text-foreground">
          {weightT} t metāls
        </div>
      )}

      {/* Selected offer summary overlay (contact step) */}
      {selectedOffer && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-background/95 backdrop-blur-md rounded-2xl shadow-lg border border-border/50 p-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
            Izvēlētais piedāvājums
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-base text-foreground truncate">
                {selectedOffer.name}
              </p>
              <p className="text-sm font-medium text-muted-foreground">{selectedOffer.city}</p>
            </div>
            <p className="text-2xl font-black text-foreground shrink-0">
              €{selectedOffer.totalPayoutEur.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────

  if (mode === 'public') {
    return (
      <>
        <Container className="pt-32 pb-24 flex max-lg:flex-col items-start gap-10 lg:gap-20">
          <div className="flex flex-col w-full lg:w-110 xl:w-120 shrink-0 bg-background rounded-2xl shadow-xl border border-border/40 overflow-hidden">
            {wizardContent}
          </div>
          {rightPanel}
        </Container>
        <WebWizardAuthGate
          open={authGateOpen}
          onAuthenticated={handleAuthSuccess}
          onDismiss={() => {
            setAuthGateOpen(false);
            setPendingAction(null);
          }}
          prefilledName={contactName}
          prefilledPhone={contactPhone}
          initialMode="login"
        />
      </>
    );
  }

  return (
    <div className="-m-6 xl:-m-8 flex min-h-[calc(100svh-4rem)]">
      <div className="w-full lg:w-125 xl:w-135 border-r border-border/40 bg-background flex flex-col">
        {wizardContent}
      </div>
      {rightPanel}
    </div>
  );
}
