/**
 * SkipHireWizard
 *
 * Single source of truth for the skip-hire order flow.
 * Used by both the public marketing site (/order/skip-hire) and the
 * authenticated dashboard (/dashboard/order/skip-hire).
 *
 * Flow: size → waste → address → details (date + hire period + time window + contact)
 *
 * Conditional last step:
 *  mode="public"     → contact fields collected from guest → auth gate fires on submit
 *  mode="dashboard"  → contact pre-filled from user profile → submits directly
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WizardShell } from '@/components/order/WizardShell';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { WebWizardAuthGate } from '@/components/order/WebWizardAuthGate';
import { Container } from '@/components/marketing/layout/Container';
import { Calendar } from '@/components/ui/calendar';
import {
  createSkipHireOrder,
  mapWasteCategory,
  mapSkipSize,
  type SkipHireOrder,
} from '@/lib/api/skip-hire';
import type { User } from '@/lib/api';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Phone,
  User as UserIcon,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const SIZES = [
  { id: 'mini', label: 'Mini', sub: '2 m³', capacity: 'Mājas remonts, mazie darbi', fromPrice: 59 },
  {
    id: 'midi',
    label: 'Midi',
    sub: '4 m³',
    capacity: 'Virtuves/vannas istabas remonts',
    fromPrice: 89,
  },
  {
    id: 'builders',
    label: 'Builders',
    sub: '6 m³',
    capacity: 'Celtniecības atkritumi, liels remonts',
    fromPrice: 119,
  },
  {
    id: 'large',
    label: 'Liels',
    sub: '8 m³',
    capacity: 'Nojaukšana, lielas tīrīšanas',
    fromPrice: 149,
  },
];

const WASTE_TYPES = [
  { id: 'mixed', label: 'Jaukti atkritumi', sub: 'Dažādu veidu celtniecības atkritumi' },
  { id: 'rubble', label: 'Betons / Ķieģeļi', sub: 'Smagi būvgruži un plāksnes' },
  { id: 'green', label: 'Zaļā masa', sub: 'Koki, zari, lapas, dārza atkritumi' },
  { id: 'wood', label: 'Koksne', sub: 'Dēļi, sijas, logi, durvis' },
  { id: 'metal', label: 'Metāls', sub: 'Stiegrojums, profili, metāllūžņi' },
];

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

type WizardStep = 'size' | 'waste' | 'address' | 'details' | 'confirmed';

const STEP_INDEX: Record<WizardStep, number> = {
  size: 1,
  waste: 2,
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

  const [step, setStep] = useState<WizardStep>('size');
  const [size, setSize] = useState('');
  const [wasteType, setWasteType] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [deliveryDate, setDeliveryDate] = useState('');
  const [hireDays, setHireDays] = useState(14);
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  const [confirmedOrder, setConfirmedOrder] = useState<SkipHireOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Auth gate (public mode only)
  const [authGateOpen, setAuthGateOpen] = useState(false);
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
      if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
      if (d.deliveryWindow) setDeliveryWindow(d.deliveryWindow);
      if (d.hireDays) setHireDays(d.hireDays);
      if (d.notes) setNotes(d.notes);
      if (d.step && d.step !== 'confirmed') setStep(d.step);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  function requireAuth(action: (tok: string) => Promise<void>) {
    if (token) {
      action(token);
    } else {
      setPendingAction(() => action);
      setAuthGateOpen(true);
    }
  }

  function handleAuthSuccess(authUser: User, authToken: string) {
    setAuth(authUser, authToken);
    setAuthGateOpen(false);
    if (pendingAction) {
      pendingAction(authToken);
      setPendingAction(null);
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
          wasteCategory: mapWasteCategory(wasteType),
          skipSize: mapSkipSize(size),
          deliveryDate,
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          hireDays,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
        },
        tok,
      );
      setConfirmedOrder(result);
      setStep('confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const selectedSize = SIZES.find((s) => s.id === size);
  const isConfirmed = step === 'confirmed';
  const showMap = true;

  function getOnBack(): (() => void) | undefined {
    if (isConfirmed) return undefined;
    if (step === 'size')
      return mode === 'dashboard' ? () => router.push('/dashboard/order') : undefined;
    if (step === 'waste') return () => setStep('size');
    if (step === 'address') return () => setStep('waste');
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
      {/* ── Step 1: Container size ── */}
      {step === 'size' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-bold text-foreground">Kādu konteinerus vajag?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Izvēlieties izmēru pēc atkritumu daudzuma
            </p>
          </div>

          {mode === 'public' && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
              Pasūtījuma noslēgšanai lūgums pierakstīties vai reģistrēties — aizņem mazāk nekā 30
              sek.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSize(s.id);
                  setStep('waste');
                }}
                className="group text-left rounded-2xl border border-border/60 bg-card p-5 hover:border-emerald-300 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[16px] text-foreground">{s.label}</p>
                    <p className="text-sm font-medium text-emerald-700 mt-0.5">{s.sub}</p>
                  </div>
                  <p className="text-lg font-bold text-foreground shrink-0">no €{s.fromPrice}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{s.capacity}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Waste type ── */}
      {step === 'waste' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-bold text-foreground">Kādi atkritumi?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tas ietekmē konteinera veidu un pieņemšanas vietu
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {WASTE_TYPES.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setWasteType(w.id);
                  setStep('address');
                }}
                className="flex items-center justify-between text-left rounded-2xl border-2 px-5 py-4 bg-transparent border-border/60 hover:border-emerald-300 hover:shadow-sm transition-all group"
              >
                <div>
                  <p className="font-semibold text-foreground">{w.label}</p>
                  <p className="text-sm text-muted-foreground">{w.sub}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
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
            onBack={() => setStep('waste')}
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
              <CalendarDays className="size-4" /> Piegādes datums
            </label>
            <div className="rounded-2xl border overflow-hidden">
              <Calendar
                mode="single"
                selected={
                  deliveryDate
                    ? (() => {
                        const [y, m, d] = deliveryDate.split('-').map(Number);
                        return new Date(y, m - 1, d);
                      })()
                    : undefined
                }
                onSelect={(d) => {
                  if (!d) return;
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDeliveryDate(`${y}-${m}-${day}`);
                }}
                disabled={{ before: new Date(Date.now() + 86400000) }}
                className="p-3"
              />
            </div>
            {deliveryDate && (
              <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                <CalendarDays className="size-4 text-black shrink-0" />
                <span className="text-sm font-semibold text-primary">
                  Piegāde:{' '}
                  {new Date(deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Nomas periods</label>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.days}
                  onClick={() => setHireDays(d.days)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    hireDays === d.days
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
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

          {submitError && <p className="text-sm text-destructive font-medium">{submitError}</p>}

          <Button
            onClick={() => (mode === 'public' ? requireAuth(submit) : token && submit(token))}
            disabled={!deliveryDate || !contactPhone.trim() || submitting}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
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
              Jums būs nepieciešams konts, lai pabeigtu pasūtījumu
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
          <p className="text-sm text-muted-foreground max-w-xs">
            Mēs sazināsimies ar jums, lai apstiprinātu piegādes laiku.
          </p>
          <Button
            onClick={() => router.push('/dashboard/orders')}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            Skatīt pasūtījumus
          </Button>
        </div>
      )}
    </WizardShell>
  );

  // ── Right panel (map + contextual info) ──────────────────────────────────

  const rightPanel = (
    <div
      className={
        mode === 'public'
          ? 'relative hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-28 h-[600px] rounded-3xl shadow-xl ring-1 ring-border/40'
          : 'relative hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-0 h-[calc(100svh-4rem)]'
      }
    >
      <div
        ref={mapDivRef}
        className={`absolute inset-0 transition-opacity duration-300 ${showMap ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {showMap && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {address && (
            <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate max-w-55">{address}</span>
            </div>
          )}
          {deliveryDate && (
            <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              <span>{deliveryDate}</span>
            </div>
          )}
        </div>
      )}

      {showMap && selectedSize && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-sm font-bold text-foreground">
          {selectedSize.label} · no €{selectedSize.fromPrice}
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
