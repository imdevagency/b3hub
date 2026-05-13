/**
 * SkipHireWizard
 *
 * Single source of truth for the skip-hire order flow.
 * Used by both the public marketing site (/order/skip-hire) and the
 * authenticated dashboard (/dashboard/order/skip-hire).
 *
 * Flow: waste → size → address → details (date + hire period + time window + contact)
 *
 * Conditional last step:
 *  mode="public"     → contact fields collected from guest → auth gate fires on submit
 *  mode="dashboard"  → contact pre-filled from user profile → submits directly
 */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WizardShell } from '@/components/order/WizardShell';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { WebWizardAuthGate, type GuestContactInfo } from '@/components/order/WebWizardAuthGate';
import { Container } from '@/components/marketing/layout/Container';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { createSkipHireOrder, mapSkipSize, type SkipHireOrder } from '@/lib/api/skip-hire';
import { SKIP_WASTE_CATEGORIES, SKIP_WASTE_LABELS, type SkipWasteCategory } from '@b3hub/shared';
import { createGuestOrder } from '@/lib/api';
import type { User } from '@/lib/api';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  User as UserIcon,
  Zap,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZES = [
  {
    id: 'mini',
    label: 'Mini',
    sub: '2 m³',
    capacity: 'Mājas remonts, mazie darbi',
    fromPrice: 59,
    maxTonnes: 1,
    examples: ['Vannas istabas remonts', 'Nelielas tīrīšanas', 'Dārza atkritumi'],
  },
  {
    id: 'midi',
    label: 'Midi',
    sub: '4 m³',
    capacity: 'Virtuves/vannas istabas remonts',
    fromPrice: 89,
    maxTonnes: 2,
    examples: ['Virtuves remonts', 'Grīdas nomaiņa', 'Mēbeļu izvešana'],
  },
  {
    id: 'builders',
    label: 'Builders',
    sub: '6 m³',
    capacity: 'Celtniecības atkritumi, liels remonts',
    fromPrice: 119,
    maxTonnes: 3,
    examples: ['Visa māja remonts', 'Jumta nomaiņa', 'Jaunbūve iekšdarbi'],
  },
  {
    id: 'large',
    label: 'Liels',
    sub: '8 m³',
    capacity: 'Nojaukšana, lielas tīrīšanas',
    fromPrice: 149,
    maxTonnes: 4,
    examples: ['Nojaukšana', 'Liela objekta uzkopšana', 'Masīvs remonts'],
  },
];

const WASTE_INFO: Record<SkipWasteCategory, { accepts: string[]; rejects: string[] }> = {
  MIXED: {
    accepts: ['Ģipškartons', 'Iepakojumi', 'Sadzīves priekšmeti', 'Keramika', 'Stikls'],
    rejects: ['Bīstamie atkritumi', 'Azbests', 'Elektroiekārtas', 'Šķidrumi'],
  },
  CONCRETE_RUBBLE: {
    accepts: ['Betons', 'Ķieģeļi', 'Cementa plāksnes', 'Flīzes', 'Bruģis'],
    rejects: ['Koksne', 'Jaukti atkritumi', 'Metāls', 'Bīstamās vielas'],
  },
  WOOD: {
    accepts: ['Dēļi', 'Sijas', 'Durvis', 'Logi', 'Paletes', 'Mēbeles'],
    rejects: ['Azbesta plāksnes', 'Krāsota koksne ar svinu', 'Laminēta koksne'],
  },
};

// SKIP_WASTE_CATEGORIES + SKIP_WASTE_LABELS imported from @b3hub/shared — single source of truth with mobile.

const DURATIONS = [
  { days: 7, label: '1 nedēļa' },
  { days: 14, label: '2 nedēļas' },
  { days: 28, label: '4 nedēļas' },
];

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

const DRAFT_KEY = 'b3hub_skiphire_wizard_draft';
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;

type WizardStep = 'waste' | 'size' | 'address' | 'details' | 'confirmed';

const STEP_INDEX: Record<WizardStep, number> = {
  waste: 1,
  size: 2,
  address: 3,
  details: 4,
  confirmed: 4,
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
}

export function SkipHireWizard({ mode }: Props) {
  const { token, user, setAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('waste');
  const [size, setSize] = useState('');
  const [wasteType, setWasteType] = useState<SkipWasteCategory | ''>('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [hireDays, setHireDays] = useState(14);
  const [hireRange, setHireRange] = useState<DateRange | undefined>();
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'INVOICE'>('CARD');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  const [hoveredWaste, setHoveredWaste] = useState<SkipWasteCategory | null>(null);
  const [hoveredSize, setHoveredSize] = useState<string | null>(null);

  const [confirmedOrder, setConfirmedOrder] = useState<SkipHireOrder | null>(null);
  const [guestToken, setGuestToken] = useState('');
  const [guestOrderNumber, setGuestOrderNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Auth gate (public mode only)
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateMode, setAuthGateMode] = useState<'login' | 'register' | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<((tok: string) => Promise<void>) | null>(null);

  // Pre-fill contact from authenticated user profile
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
      if (d.size) setSize(d.size);
      if (d.wasteType) setWasteType(d.wasteType);
      if (d.address) setAddress(d.address);
      if (d.deliveryDate) {
        setDeliveryDate(d.deliveryDate);
        // Restore hireRange from saved deliveryDate + hireDays
        const days = d.hireDays ?? 14;
        const [y, mo, dy] = d.deliveryDate.split('-').map(Number);
        const from = new Date(y, mo - 1, dy);
        const to = new Date(y, mo - 1, dy);
        to.setDate(to.getDate() + days - 1);
        setHireRange({ from, to });
      }
      if (d.deliveryWindow) setDeliveryWindow(d.deliveryWindow);
      if (d.hireDays) setHireDays(d.hireDays);
      if (d.notes) setNotes(d.notes);
      if (d.step && d.step !== 'confirmed') setStep(d.step as WizardStep);
    } catch {
      /* ignore corrupt draft */
    } finally {
      draftLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || confirmedOrder) {
      if (confirmedOrder) localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        size,
        wasteType,
        address,
        deliveryDate,
        deliveryWindow,
        hireDays,
        notes,
        step,
        savedAt: Date.now(),
      }),
    );
  }, [
    size,
    wasteType,
    address,
    deliveryDate,
    deliveryWindow,
    hireDays,
    notes,
    step,
    confirmedOrder,
  ]);

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

  // ── Auth helpers ──────────────────────────────────────────────────────────

  function handleAuthSuccess(authUser: User, authToken: string) {
    setAuth(authUser, authToken);
    setAuthGateOpen(false);
    if (pendingAction) {
      pendingAction(authToken);
      setPendingAction(null);
    }
  }

  async function handleGuestCheckout(contact: GuestContactInfo) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const guestRes = await createGuestOrder({
        materialCategory: 'SKIP_HIRE',
        materialName: `Skip ${size || ''}`.trim(),
        quantity: 1,
        unit: 'PIECE',
        deliveryAddress: address,
        deliveryCity: address.split(',').slice(-1)[0]?.trim() || '',
        deliveryLat: lat,
        deliveryLng: lng,
        deliveryDate: deliveryDate || undefined,
        deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        notes: notes || undefined,
      });
      setGuestToken(guestRes.token);
      setGuestOrderNumber(guestRes.orderNumber);
      setStep('confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kļūda iesniedzot pasūtījumu.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit(tok: string) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createSkipHireOrder(
        {
          location: address,
          wasteCategory: wasteType as SkipWasteCategory,
          skipSize: mapSkipSize(size),
          deliveryDate,
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          hireDays,
          paymentMethod,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
        },
        tok,
      );
      setConfirmedOrder(result);
      setStep('confirmed');
      // For card orders, redirect to Paysera immediately after confirmation renders
      if (result.paymentUrl) {
        // Small delay so user sees the "Pasūtījums pieņemts" screen briefly
        setTimeout(() => {
          window.location.href = result.paymentUrl!;
        }, 1500);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const selectedSize = SIZES.find((s) => s.id === size);
  const isConfirmed = step === 'confirmed';
  // Map is relevant only on the address step (dashboard); public mode always shows it
  const showMap = mode === 'public' || step === 'address';
  // Derived labels for right panel
  const selectedWasteLabel = wasteType
    ? (SKIP_WASTE_LABELS[wasteType as SkipWasteCategory]?.label ?? wasteType)
    : null;
  const selectedDuration = DURATIONS.find((d) => d.days === hireDays);

  function getOnBack(): (() => void) | undefined {
    if (isConfirmed) return undefined;
    if (step === 'waste')
      return mode === 'dashboard' ? () => router.push('/dashboard/order') : undefined;
    if (step === 'size') return () => setStep('waste');
    if (step === 'address') return () => setStep('size');
    if (step === 'details') return () => setStep('address');
    return undefined;
  }

  // ── Wizard content ────────────────────────────────────────────────────────

  const wizardContent = (
    <WizardShell
      className={mode === 'dashboard' ? 'flex-1' : 'w-full h-auto'}
      step={STEP_INDEX[step]}
      totalSteps={4}
      title={isConfirmed ? 'Pasūtījums pieņemts' : 'Konteinera noma'}
      onBack={getOnBack()}
      onClose={mode === 'public' && !isConfirmed ? () => router.push('/order') : undefined}
      innerScroll={mode === 'dashboard'}
    >
      {/* ── Step 1: Waste type ── */}
      {step === 'waste' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-bold text-foreground">Kādi atkritumi?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tas ietekmē konteinera veidu un pieņemšanas vietu
            </p>
          </div>

          {mode === 'public' && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
              Pasūtījuma noslēgšanai lūgums pierakstīties vai reģistrēties — aizņem mazāk nekā 30
              sek.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {SKIP_WASTE_CATEGORIES.map((id) => {
              const w = SKIP_WASTE_LABELS[id];
              return (
                <button
                  key={id}
                  onClick={() => {
                    setWasteType(id);
                    setStep('size');
                  }}
                  onMouseEnter={() => setHoveredWaste(id)}
                  onMouseLeave={() => setHoveredWaste(null)}
                  className="flex items-center justify-between text-left rounded-2xl border-2 px-5 py-4 bg-transparent border-border/60 hover:border-[#203728] hover:shadow-sm transition-all group"
                >
                  <div>
                    <p className="font-semibold text-foreground">{w.label}</p>
                    <p className="text-sm text-muted-foreground">{w.sub}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Container size ── */}
      {step === 'size' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-bold text-foreground">Kādu konteinerus vajag?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Izvēlieties izmēru pēc atkritumu daudzuma
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSize(s.id);
                  setStep('address');
                }}
                onMouseEnter={() => setHoveredSize(s.id)}
                onMouseLeave={() => setHoveredSize(null)}
                className="group text-left rounded-2xl border border-border/60 bg-card p-5 hover:border-[#203728] hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[16px] text-foreground">{s.label}</p>
                    <p className="text-sm font-medium text-[#203728] mt-0.5">{s.sub}</p>
                  </div>
                  <p className="text-lg font-bold text-foreground shrink-0">no €{s.fromPrice}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{s.capacity}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Address ── */}
      {step === 'address' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <Step2Address
            value={address}
            lat={lat}
            lng={lng}
            onAddressChange={(addr, la, ln) => {
              setAddress(addr);
              setLat(la);
              setLng(ln);
              if (la && ln) updateMapPin(la, ln);
            }}
            title="Kur novietot konteinerus?"
            subtitle="Ievadiet precīzu adresi — šoferis atbrauks ar konteinerus uz šo vietu"
            nextLabel="Tālāk — datums un kontakti"
            onNext={() => setStep('details')}
            onBack={() => setStep('size')}
          />
        </div>
      )}

      {/* ── Step 4: Date + hire period + time window + contact ── */}
      {step === 'details' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {selectedSize && (
            <div className="rounded-2xl bg-muted/40 p-4 flex items-center gap-3">
              <Package className="size-5 text-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">
                  {selectedSize.label} konteiners ({selectedSize.sub})
                </p>
                <p className="text-xs text-muted-foreground truncate">{address}</p>
              </div>
              <p className="text-base font-bold text-foreground shrink-0">
                no €{selectedSize.fromPrice}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Piegādes un nodošanas datumi
            </label>
            <p className="text-xs text-muted-foreground">
              Izvēlieties piegādes datumu un klikšķiniet uz nodošanas datuma.
            </p>
            <div className="rounded-2xl border overflow-hidden">
              <Calendar
                mode="range"
                selected={hireRange}
                onSelect={(range) => {
                  setHireRange(range);
                  if (range?.from) {
                    const f = range.from;
                    const y = f.getFullYear();
                    const m = String(f.getMonth() + 1).padStart(2, '0');
                    const day = String(f.getDate()).padStart(2, '0');
                    setDeliveryDate(`${y}-${m}-${day}`);
                  } else {
                    setDeliveryDate('');
                  }
                  if (range?.from && range?.to) {
                    const diff =
                      Math.round((range.to.getTime() - range.from.getTime()) / 86400000) + 1;
                    setHireDays(Math.max(1, diff));
                  }
                }}
                disabled={{ before: new Date(Date.now() + 86400000) }}
                className="p-3"
              />
            </div>
            {hireRange?.from && (
              <div className="flex items-center gap-2.5 rounded-xl bg-[#203728]/10 border border-[#203728]/20 px-4 py-3">
                <CalendarDays className="size-4 text-black shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-[#203728]">
                    Piegāde:{' '}
                    {hireRange.from.toLocaleDateString('lv-LV', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                  {hireRange.to && hireRange.to.getTime() !== hireRange.from.getTime() && (
                    <span className="text-xs font-medium text-[#203728]/70">
                      Nodošana:{' '}
                      {hireRange.to.toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}{' '}
                      · {hireDays} dienas
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Piegādes laiks</label>
            <div className="flex gap-2">
              {(['ANY', 'AM', 'PM'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setDeliveryWindow(w)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    deliveryWindow === w
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {w === 'ANY' ? 'Jebkurā' : w === 'AM' ? 'Rīts (8–13)' : 'Pēcpusdiena (13–18)'}
                </button>
              ))}
            </div>
          </div>

          {/* Contact — always visible; pre-filled from profile in dashboard mode */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              Kontaktpersona objektā
              {mode === 'dashboard' && contactPrefilled && (
                <span className="text-xs font-normal text-muted-foreground">(no profila)</span>
              )}
            </p>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <UserIcon className="size-3" /> Vārds, uzvārds
              </label>
              <Input
                placeholder="Jānis Bērziņš"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 h-14 text-base"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Phone className="size-3" /> Tālrunis
              </label>
              <Input
                type="tel"
                placeholder="+371 20 000 000"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 h-14 text-base"
              />
            </div>
            {mode === 'public' && (
              <div>
                <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <Mail className="size-3" /> E-pasts (neobligāti, statusu paziņojumiem)
                </label>
                <Input
                  type="email"
                  placeholder="jusu@epasts.lv"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  autoComplete="email"
                  className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 h-14 text-base"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Piezīmes šoferim (neobligāti)
              </label>
              <Textarea
                placeholder="Piekļuves instrukcijas, adreses precizējums..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          {!contactPhone.trim() && (
            <p className="text-sm text-destructive font-medium">
              Tālrunis ir obligāts — šoferim jāsazinās ar objekta kontaktpersonu.
            </p>
          )}

          {/* Payment method */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Maksājuma veids</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    val: 'CARD',
                    label: '💳 Ar karti (Paysera)',
                    sub: 'Tūlītējs maksājums — jūs tiksiet novirzīts uz Paysera',
                  },
                  {
                    val: 'INVOICE',
                    label: '🧾 Priekšapmaksas rēķins',
                    sub: 'Rēķins tiks nosūtīts uz e-pastu pirms piegādes',
                  },
                ] as const
              ).map(({ val, label, sub }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPaymentMethod(val)}
                  className={`flex items-start gap-3 text-left rounded-2xl border-2 px-4 py-3 transition-colors ${
                    paymentMethod === val
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border hover:border-foreground/30'
                  }`}
                >
                  <span
                    className={`mt-0.5 size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === val ? 'border-foreground' : 'border-muted-foreground/40'}`}
                  >
                    {paymentMethod === val && (
                      <span className="size-2 rounded-full bg-foreground block" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {submitError && <p className="text-sm text-destructive font-medium">{submitError}</p>}

          <Button
            onClick={() => {
              if (token) {
                submit(token);
              } else {
                handleGuestCheckout({
                  name: contactName.trim() || 'Klients',
                  phone: contactPhone.trim(),
                  email: contactEmail.trim() || undefined,
                });
              }
            }}
            disabled={!deliveryDate || !contactPhone.trim() || submitting}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all bg-[#203728] text-white hover:bg-[#203728]/90"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <span>Apstiprināt pasūtījumu</span>
                <ArrowRight className="size-4 ml-1.5" />
              </>
            )}
          </Button>

          {mode === 'public' && (
            <p className="text-xs text-center text-muted-foreground -mt-2">
              Pasūtīt var bez konta ·{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthGateMode('login');
                  setPendingAction(() => submit);
                  setAuthGateOpen(true);
                }}
                className="underline font-semibold hover:text-foreground transition-colors"
              >
                Jau ir konts? Ieiet
              </button>
            </p>
          )}
        </div>
      )}

      {/* ── Confirmed ── */}
      {isConfirmed && confirmedOrder && (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
          <div className="flex size-20 items-center justify-center rounded-full bg-foreground">
            <CheckCircle2 className="size-9 text-background" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">Pasūtījums pieņemts!</p>
            <p className="text-base text-muted-foreground font-medium mt-1">
              Nr. <span className="font-bold text-foreground">{confirmedOrder.orderNumber}</span>
            </p>
          </div>
          {confirmedOrder.paymentUrl ? (
            <p className="text-sm text-muted-foreground max-w-xs">
              Novirzām uz Paysera maksājumu... Ja tas nenotiek automātiski, noklikšķiniet zemāk.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground max-w-xs">
              {confirmedOrder.paymentMethod === 'INVOICE'
                ? 'Priekšapmaksas rēķins tiks nosūtīts uz jūsu e-pastu. Piegāde tiks apstiprināta pēc apmaksas.'
                : 'Mēs sazināsimies ar jums, lai apstiprinātu piegādes laiku.'}
            </p>
          )}
          {confirmedOrder.paymentUrl && (
            <a
              href={confirmedOrder.paymentUrl}
              className="w-full flex items-center justify-center rounded-full h-14 text-base font-bold bg-foreground text-background shadow-md hover:shadow-lg transition-all"
            >
              💳 Apmaksāt pasūtījumu
            </a>
          )}
          <Button
            onClick={() => router.push('/dashboard/orders')}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all bg-[#203728] text-white hover:bg-[#203728]/90"
          >
            Skatīt pasūtījumus
          </Button>
        </div>
      )}

      {/* ── Confirmed (guest, no payment intent) ── */}
      {isConfirmed && !confirmedOrder && guestToken && (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
          <div className="flex size-20 items-center justify-center rounded-full bg-foreground">
            <CheckCircle2 className="size-9 text-background" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">Pasūtījums saņemts!</p>
            <p className="text-base text-muted-foreground font-medium mt-1">
              Nr. <span className="font-bold text-foreground">{guestOrderNumber}</span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Mēs sazināsimies ar jūsu kontaktpersonu, lai apstiprinātu pieprasījumu un pieprasītu
            apmaksu.
          </p>
          <Button
            onClick={() => router.push(`/pasutijums/${guestToken}`)}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all bg-[#203728] text-white hover:bg-[#203728]/90"
          >
            <CheckCircle2 className="size-4 mr-1.5" /> Sekot pasūtījumam
          </Button>
        </div>
      )}
    </WizardShell>
  );

  // ── Right panel (map + contextual info) ──────────────────────────────────

  const rightPanel = (
    <div
      className={cn(
        'relative hidden lg:flex flex-1 overflow-hidden',
        mode === 'public'
          ? 'bg-muted/10 sticky top-28 h-150 rounded-3xl shadow-xl ring-1 ring-border/40'
          : 'bg-card border border-border/40 rounded-2xl sticky top-8 h-[calc(100svh-6rem)]',
      )}
    >
      {/* ── Map — always in DOM for initialization, visible only on address step ── */}
      <div
        ref={mapDivRef}
        className={`absolute inset-0 transition-opacity duration-300 ${showMap ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Map overlays */}
      {showMap && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {address && (
            <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate max-w-55">{address}</span>
            </div>
          )}
        </div>
      )}
      {showMap && selectedSize && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-sm font-bold text-foreground">
          {selectedSize.label} · no €{selectedSize.fromPrice}
        </div>
      )}

      {/* ── Step: waste — Service intro or hovered waste detail ─────────────── */}
      {!showMap &&
        step === 'waste' &&
        (() => {
          const hw = hoveredWaste ? SKIP_WASTE_LABELS[hoveredWaste] : null;
          const hwInfo = hoveredWaste ? WASTE_INFO[hoveredWaste] : null;
          return hw && hwInfo ? (
            <div
              key={hoveredWaste}
              className="absolute inset-0 flex flex-col justify-center p-8 gap-6 overflow-y-auto animate-in fade-in duration-150"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Atkritumu veids
                </p>
                <h3 className="text-2xl font-bold text-foreground">{hw.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{hw.sub}</p>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mb-2.5">
                    Pieņem
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {hwInfo.accepts.map((item) => (
                      <div key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                        <div className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-500 mb-2.5">
                    Nepieņem
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {hwInfo.rejects.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2.5 text-sm text-muted-foreground"
                      >
                        <div className="size-1.5 rounded-full bg-rose-400 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border border-border/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/50 border-b border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground">Izmēri no</p>
                </div>
                {SIZES.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-3',
                      i < SIZES.length - 1 && 'border-b border-border/30',
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {s.label}{' '}
                      <span className="text-xs font-normal text-muted-foreground">{s.sub}</span>
                    </span>
                    <span className="text-sm font-bold text-[#203728]">€{s.fromPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col justify-center p-8 gap-7 overflow-y-auto animate-in fade-in duration-200">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  B3 Hub · Konteineru noma
                </p>
                <h3 className="text-2xl font-bold text-foreground leading-snug">
                  Vienkārša atkritumu
                  <br />
                  izvešana Latvijā
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {(
                  [
                    { Icon: Zap, text: 'Piegāde 24 h laikā' },
                    { Icon: ShieldCheck, text: 'Licencēta utilizācija ar dokumentiem' },
                    { Icon: MapPin, text: 'Reāllaika izsekošana mobilajā lietotnē' },
                    { Icon: CreditCard, text: 'Apmaksa ar karti vai rēķins uzņēmumam' },
                  ] as { Icon: React.ElementType; text: string }[]
                ).map(({ Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-foreground/80">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#203728]/10 shrink-0">
                      <Icon className="size-3.5 text-[#203728]" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
              <div className="border border-border/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/50 border-b border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground">Pieejamie izmēri</p>
                </div>
                {SIZES.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-3',
                      i < SIZES.length - 1 && 'border-b border-border/30',
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {s.label}{' '}
                      <span className="text-xs font-normal text-muted-foreground">{s.sub}</span>
                    </span>
                    <span className="text-sm font-bold text-[#203728]">€{s.fromPrice}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      {/* ── Step: size — Waste chip + hovered/selected size detail ──────────── */}
      {!showMap &&
        step === 'size' &&
        (() => {
          const previewId = hoveredSize ?? size;
          const previewSize = SIZES.find((s) => s.id === previewId);
          return (
            <div className="absolute inset-0 flex flex-col justify-start p-8 gap-5 overflow-y-auto">
              {/* Chosen waste chip */}
              {selectedWasteLabel && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Atkritumu veids
                  </p>
                  <div className="flex items-center gap-2.5 bg-[#203728]/8 border border-[#203728]/20 rounded-xl px-4 py-2.5">
                    <Package className="size-3.5 text-[#203728] shrink-0" />
                    <span className="text-sm font-semibold text-foreground">
                      {selectedWasteLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic size preview */}
              {previewSize ? (
                <div
                  key={previewSize.id}
                  className="flex flex-col gap-4 animate-in fade-in duration-150"
                >
                  <div className="border border-[#203728]/30 bg-[#203728]/4 rounded-2xl p-5">
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="text-xl font-bold text-foreground">{previewSize.label}</p>
                      <p className="text-2xl font-bold text-[#203728]">€{previewSize.fromPrice}</p>
                    </div>
                    <p className="text-base font-semibold text-[#203728]">{previewSize.sub}</p>
                    <p className="text-sm text-muted-foreground mt-2">{previewSize.capacity}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3.5 shrink-0" />
                      <span>Maks. ~{previewSize.maxTonnes} t</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">
                      Piemērots
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {previewSize.examples.map((ex) => (
                        <div key={ex} className="flex items-center gap-2.5 text-sm text-foreground">
                          <div className="size-1.5 rounded-full bg-[#203728] shrink-0" />
                          {ex}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 animate-in fade-in duration-150">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Uzvelciet uz izmēra, lai redzētu detaļas
                  </p>
                  {SIZES.map((s, i) => (
                    <div
                      key={s.id}
                      className={cn(
                        'flex items-center justify-between px-4 py-3 rounded-xl border',
                        i === 1 ? 'border-[#203728]/30 bg-[#203728]/4' : 'border-border/40',
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {s.label}{' '}
                        <span className="text-xs font-normal text-muted-foreground">{s.sub}</span>
                      </span>
                      <span className="text-sm font-bold text-[#203728]">€{s.fromPrice}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

      {/* ── Step: details / confirmed — Order summary receipt ───────────────── */}
      {!showMap && (step === 'details' || step === 'confirmed') && (
        <div className="absolute inset-0 flex flex-col justify-center p-8 gap-5 overflow-y-auto animate-in fade-in duration-200">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Pasūtījuma pārskats
          </p>
          <div className="flex flex-col border border-border/40 rounded-2xl overflow-hidden divide-y divide-border/30 bg-background/60">
            {selectedWasteLabel && (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Package className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Atkritumu veids</p>
                  <p className="text-sm font-medium text-foreground">{selectedWasteLabel}</p>
                </div>
              </div>
            )}
            {selectedSize && (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Package className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Konteiners</p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedSize.label} · {selectedSize.sub}
                  </p>
                </div>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Piegādes adrese</p>
                  <p className="text-sm font-medium text-foreground truncate">{address}</p>
                </div>
              </div>
            )}
            {deliveryDate && (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <CalendarDays className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Piegādes datums</p>
                  <p className="text-sm font-medium text-foreground">{deliveryDate}</p>
                </div>
              </div>
            )}
            {selectedDuration && (
              <div className="flex items-start gap-3 px-4 py-3.5">
                <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Nomas periods</p>
                  <p className="text-sm font-medium text-foreground">{selectedDuration.label}</p>
                </div>
              </div>
            )}
          </div>
          {selectedSize && (
            <div className="flex items-center justify-between bg-[#203728] text-white rounded-2xl px-5 py-4">
              <span className="text-sm font-medium opacity-70">Kopā no</span>
              <span className="text-2xl font-bold">€{selectedSize.fromPrice}</span>
            </div>
          )}
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
          onGuestContact={handleGuestCheckout}
          onDismiss={() => {
            setAuthGateOpen(false);
            setAuthGateMode(undefined);
            setPendingAction(null);
          }}
          prefilledName={contactName}
          prefilledPhone={contactPhone}
          initialMode={authGateMode}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] gap-8">
      <div className="w-full lg:w-125 xl:w-135 shrink-0 border border-border/40 bg-background rounded-2xl overflow-hidden flex flex-col shadow-sm self-start">
        {wizardContent}
      </div>
      {rightPanel}
    </div>
  );
}
