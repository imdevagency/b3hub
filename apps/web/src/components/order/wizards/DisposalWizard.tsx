/**
 * DisposalWizard
 *
 * Single source of truth for the disposal/collection order flow.
 * Used by both the public marketing site (/order/disposal) and the
 * authenticated dashboard (/dashboard/order/disposal).
 *
 * Flow: waste → address → details (date + time window + truck access + contact)
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
import { WebWizardAuthGate, type GuestContactInfo } from '@/components/order/WebWizardAuthGate';
import { Container } from '@/components/marketing/layout/Container';
import { Calendar } from '@/components/ui/calendar';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { createDisposalOrder, type WasteType, type DisposalTruckType } from '@/lib/api/orders';
import { createGuestOrder } from '@/lib/api';
import type { User } from '@/lib/api';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
  User as UserIcon,
  Weight,
  Blocks,
  BrickWall,
  Trees,
  Wrench,
  Mountain,
  Layers,
  Flame,
  Check,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const WASTE_TYPES: { id: WasteType; label: string; sub: string; icon: any; hazardous?: true }[] = [
  { id: 'CONCRETE', label: 'Betons / Bruģis', sub: 'Plāksnes, pamatnes, bruģakmens', icon: Blocks },
  {
    id: 'BRICK',
    label: 'Ķieģeļi / Būvgruži',
    sub: 'Sienu materiāli, apmetums, flīzes',
    icon: BrickWall,
  },
  { id: 'WOOD', label: 'Koksne', sub: 'Koka sijas, dēļi, logi, durvis', icon: Trees },
  { id: 'METAL', label: 'Metāls', sub: 'Stiegrojums, profili, metāllūžņi', icon: Wrench },
  { id: 'SOIL', label: 'Zeme / Augsne', sub: 'Izrakta augsne, šķembas', icon: Mountain },
  {
    id: 'MIXED',
    label: 'Jaukti būvatkritumi',
    sub: 'Dažādu veidu atkritumu maisījums',
    icon: Layers,
  },
  {
    id: 'HAZARDOUS',
    label: 'Bīstami atkritumi',
    sub: 'Azbestos, krāsas, šķīdinātāji',
    icon: Flame,
    hazardous: true,
  },
];

const PRICE_BAND: Record<string, { from: number; to: number }> = {
  CONCRETE: { from: 8, to: 18 },
  BRICK: { from: 10, to: 22 },
  WOOD: { from: 25, to: 45 },
  METAL: { from: 0, to: 10 },
  PLASTIC: { from: 30, to: 60 },
  SOIL: { from: 5, to: 15 },
  MIXED: { from: 20, to: 45 },
  HAZARDOUS: { from: 80, to: 250 },
};

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

const DRAFT_KEY = 'b3hub_disposal_wizard_draft';
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;

type WizardStep = 'waste' | 'address' | 'details' | 'sent';

const STEP_INDEX: Record<WizardStep, number> = {
  waste: 1,
  address: 2,
  details: 3,
  sent: 3,
};

function deriveTruck(weightT: number): { truckType: DisposalTruckType; truckCount: number } {
  if (weightT <= 7) return { truckType: 'TIPPER_SMALL', truckCount: 1 };
  if (weightT <= 15) return { truckType: 'TIPPER_LARGE', truckCount: 1 };
  return { truckType: 'ARTICULATED_TIPPER', truckCount: Math.max(1, Math.ceil(weightT / 20)) };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
}

export function DisposalWizard({ mode }: Props) {
  const { token, user, setAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('waste');
  const [wasteType, setWasteType] = useState<WasteType | ''>('');
  const [weightT, setWeightT] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [date, setDate] = useState('');
  const [timeWindow, setTimeWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [hasTruckAccess, setHasTruckAccess] = useState<boolean | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  const [refNumber, setRefNumber] = useState('');
  const [guestToken, setGuestToken] = useState('');
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
      if (d.wasteType) setWasteType(d.wasteType);
      if (d.weightT) setWeightT(d.weightT);
      if (d.address) setAddress(d.address);
      if (d.city) setCity(d.city);
      if (d.date) setDate(d.date);
      if (d.timeWindow) setTimeWindow(d.timeWindow);
      if (typeof d.hasTruckAccess === 'boolean') setHasTruckAccess(d.hasTruckAccess);
      if (d.notes) setNotes(d.notes);
      if (d.step && d.step !== 'sent') setStep(d.step);
    } catch {
      /* ignore corrupt draft */
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
        wasteType,
        weightT,
        address,
        city,
        date,
        timeWindow,
        hasTruckAccess,
        notes,
        step,
        savedAt: Date.now(),
      }),
    );
  }, [wasteType, weightT, address, city, date, timeWindow, hasTruckAccess, notes, step, refNumber]);

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
        materialCategory: 'DISPOSAL',
        materialName: wasteType ? `Atkritumu izvešana: ${wasteType}` : 'Atkritumu izvešana',
        quantity: parseFloat(weightT) || 1,
        unit: 'TONNE',
        deliveryAddress: address,
        deliveryCity: city || address.split(',').slice(-1)[0]?.trim() || '',
        deliveryLat: lat,
        deliveryLng: lng,
        deliveryDate: date || undefined,
        deliveryWindow: timeWindow !== 'ANY' ? timeWindow : undefined,
        contactName: contact.name,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        notes: notes || undefined,
      });
      setRefNumber(guestRes.orderNumber);
      setGuestToken(guestRes.token);
      setStep('sent');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kļūda iesniedzot pasūtījumu.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submit(tok: string) {
    if (!wasteType) return;
    const weight = parseFloat(weightT) || 5;
    const { truckType, truckCount } = deriveTruck(weight);
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createDisposalOrder(
        {
          pickupAddress: address,
          pickupCity: city || address.split(',').slice(-1)[0]?.trim() || 'Rīga',
          pickupLat: lat,
          pickupLng: lng,
          wasteType,
          truckType,
          truckCount,
          estimatedWeight: weight,
          requestedDate: date,
          pickupWindow: timeWindow !== 'ANY' ? timeWindow : undefined,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes:
            [
              hasTruckAccess === false ? 'Nav kravas auto piekļuves' : '',
              hasTruckAccess === true ? 'Kravas auto piekļuve pieejama' : '',
              notes,
            ]
              .filter(Boolean)
              .join('\n') || undefined,
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

  // ── Derived state ──────────────────────────────────────────────────────────

  const selectedWaste = WASTE_TYPES.find((w) => w.id === wasteType);
  const priceBand = wasteType ? PRICE_BAND[wasteType] : null;
  const isSent = step === 'sent';
  const showMap = true;

  function getOnBack(): (() => void) | undefined {
    if (isSent) return undefined;
    if (step === 'waste')
      return mode === 'dashboard' ? () => router.push('/dashboard/order') : undefined;
    if (step === 'address') return () => setStep('waste');
    if (step === 'details') return () => setStep('address');
    return undefined;
  }

  // ── Wizard content ────────────────────────────────────────────────────────

  const wizardContent = (
    <WizardShell
      className={mode === 'dashboard' ? 'flex-1' : 'w-full h-auto'}
      step={STEP_INDEX[step]}
      totalSteps={3}
      title={isSent ? 'Pieprasījums nosūtīts' : 'Atkritumu izvešana'}
      onBack={getOnBack()}
      onClose={mode === 'public' && !isSent ? () => router.push('/order') : undefined}
      innerScroll={mode === 'dashboard'}
    >
      {/* ── Step 1: Waste type + weight ── */}
      {step === 'waste' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-extrabold text-foreground tracking-tight">Kādi atkritumi?</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              Izvēlieties atkritumu veidu un norādiet aptuveno svaru.
            </p>
          </div>

          {mode === 'public' && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
              Pieprasījuma noslēgšanai lūgums pierakstīties vai reģistrēties — aizņem mazāk nekā 30
              sek.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WASTE_TYPES.map((w) => {
              const selected = wasteType === w.id;
              const Icon = w.icon;
              return (
                <button
                  key={w.id}
                  onClick={() => setWasteType(w.id)}
                  className={`relative flex flex-col text-left rounded-2xl border-2 p-4 transition-all group ${
                    selected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/60 bg-transparent hover:border-primary/30'
                  } ${w.hazardous && !selected ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300' : ''} ${
                    w.hazardous && selected ? 'border-amber-500 bg-amber-100/30' : ''
                  }`}
                >
                  <div className="flex w-full items-start justify-between mb-2.5">
                    <div
                      className={`p-2.5 rounded-xl transition-colors ${
                        selected
                          ? w.hazardous
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-primary text-white shadow-sm'
                          : w.hazardous
                            ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-200'
                            : 'bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
                      }`}
                    >
                      <Icon className="size-5" strokeWidth={2.5} />
                    </div>
                    <div
                      className={`size-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        selected
                          ? w.hazardous
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-primary bg-primary'
                          : w.hazardous
                            ? 'border-amber-300'
                            : 'border-border/60 group-hover:border-primary/40'
                      }`}
                    >
                      {selected && <Check className="size-3 text-white" strokeWidth={3.5} />}
                    </div>
                  </div>
                  <div className="w-full">
                    <p
                      className={`font-extrabold ${w.hazardous ? 'text-amber-900' : 'text-foreground'}`}
                    >
                      {w.label}
                    </p>
                    <p
                      className={`text-xs mt-1 leading-snug line-clamp-2 ${
                        selected ? 'text-foreground/80 font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {w.sub}
                    </p>
                  </div>
                  {/* Price pushed to bottom */}
                  {selected && priceBand && (
                    <div className="mt-3 pt-3 border-t border-border/40 w-full">
                      <p
                        className={`text-xs font-extrabold ${w.hazardous ? 'text-amber-700' : 'text-primary'}`}
                      >
                        ~ €{priceBand.from}–€{priceBand.to}{' '}
                        <span className="font-semibold opacity-70">/ t</span>
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border/40 space-y-4">
            <label className="text-sm font-bold text-foreground flex items-center gap-1.5">
              Kāds ir aptuvenais svars?
            </label>
            <div className="relative w-full max-w-sm">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Weight className="size-5 text-muted-foreground" />
              </div>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                placeholder="piem. 5"
                value={weightT}
                onChange={(e) => setWeightT(e.target.value)}
                className="pl-12 pr-16 h-14 text-lg font-bold rounded-2xl bg-muted/30 border-2 border-transparent hover:border-primary/40 focus-visible:ring-0 focus-visible:border-primary transition-all shadow-none"
                style={{ WebkitAppearance: 'none', margin: 0 }}
              />
              <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                <span className="text-muted-foreground font-extrabold">tonnas</span>
              </div>
            </div>
            {priceBand && weightT && (
              <p className="text-xs font-semibold text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/40">
                Indikatīvā kopējā cena:{' '}
                <span className="text-foreground font-bold">
                  €{(priceBand.from * (parseFloat(weightT) || 0)).toFixed(0)}–€
                  {(priceBand.to * (parseFloat(weightT) || 0)).toFixed(0)}
                </span>{' '}
                (galīgā cena tiek noteikta pēc svēršanas)
              </p>
            )}
          </div>

          <Button
            onClick={() => setStep('address')}
            disabled={!wasteType || !weightT}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            Tālāk — adrese <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Address ── */}
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
            title="No kurienes izvest?"
            subtitle="Ievadiet precīzu adresi, kur atrodas atkritumi"
            nextLabel="Tālāk — datums un kontakti"
            onNext={() => setStep('details')}
            onBack={() => setStep('waste')}
          />
        </div>
      )}

      {/* ── Step 3: Date + truck access + contact ── */}
      {step === 'details' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {selectedWaste && (
            <div className="rounded-2xl bg-muted/40 p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-foreground text-sm">{selectedWaste.label}</p>
                {priceBand && weightT && (
                  <p className="text-sm font-bold text-foreground shrink-0">
                    ~€{(priceBand.from * parseFloat(weightT)).toFixed(0)}–€
                    {(priceBand.to * parseFloat(weightT)).toFixed(0)}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {weightT ? `~${weightT} t · ` : ''}
                {address}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Vēlamais izņemšanas datums
            </label>
            <div className="rounded-2xl border overflow-hidden">
              <Calendar
                mode="single"
                selected={
                  date
                    ? (() => {
                        const [y, m, d] = date.split('-').map(Number);
                        return new Date(y, m - 1, d);
                      })()
                    : undefined
                }
                onSelect={(d) => {
                  if (!d) return;
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setDate(`${y}-${m}-${day}`);
                }}
                disabled={{ before: new Date(Date.now() + 86400000) }}
                className="p-3"
              />
            </div>
            {date && (
              <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                <CalendarDays className="size-4 text-black shrink-0" />
                <span className="text-sm font-semibold text-primary">
                  Izņemšana:{' '}
                  {new Date(date + 'T00:00:00').toLocaleDateString('lv-LV', {
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
            <label className="text-sm font-semibold text-foreground">Laika logs</label>
            <div className="flex gap-2">
              {(['ANY', 'AM', 'PM'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setTimeWindow(w)}
                  className={`flex-1 rounded-2xl border-2 py-3.5 text-sm font-bold transition-colors ${
                    timeWindow === w
                      ? 'border-foreground bg-transparent text-foreground'
                      : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {w === 'ANY' ? 'Jebkurā' : w === 'AM' ? 'Rīts' : 'Pēcpusdiena'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">
              Kravas auto piekļuve objektam?
            </label>
            <div className="flex gap-2">
              {[
                { val: true, label: 'Jā' },
                { val: false, label: 'Nē / Ierobežota' },
              ].map((o) => (
                <button
                  key={String(o.val)}
                  onClick={() => setHasTruckAccess(o.val)}
                  className={`flex-1 rounded-2xl border-2 py-3.5 text-sm font-bold transition-colors ${
                    hasTruckAccess === o.val
                      ? 'border-foreground bg-transparent text-foreground'
                      : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {o.label}
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
                Papildus informācija (neobligāti)
              </label>
              <Textarea
                placeholder="Piekļuves kodi, instrukcijas šoferim..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 py-3 text-base resize-none"
              />
            </div>
          </div>

          {(!contactPhone.trim() || hasTruckAccess === null) && (
            <div className="space-y-1">
              {!contactPhone.trim() && (
                <p className="text-sm text-destructive font-medium">
                  Tālrunis ir obligāts — šoferim jāsazinās ar objekta kontaktpersonu.
                </p>
              )}
              {hasTruckAccess === null && (
                <p className="text-sm text-destructive font-medium">
                  Lūdzu norādiet, vai ir kravas auto piekļuve objektam.
                </p>
              )}
            </div>
          )}

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
            disabled={!date || !contactPhone.trim() || hasTruckAccess === null || submitting}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Send className="size-4 mr-1.5" />
                <span>Pieprasīt izvešanu</span>
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

      {/* ── Sent ── */}
      {isSent && (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
          <div className="flex size-20 items-center justify-center rounded-full bg-foreground">
            <CheckCircle2 className="size-9 text-background" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">Pieprasījums saņemts!</p>
            {refNumber && (
              <p className="text-base text-muted-foreground font-medium mt-1">
                Nr. <span className="font-bold text-foreground">{refNumber}</span>
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Operatori pārskatīs jūsu pieprasījumu un sazināsies ar cenu piedāvājumu.
          </p>
          {guestToken ? (
            <Button
              onClick={() => router.push(`/pasutijums/${guestToken}`)}
              className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
            >
              <CheckCircle2 className="size-4 mr-1.5" /> Sekot pasūtījumam
            </Button>
          ) : (
            <Button
              onClick={() => router.push('/dashboard/orders')}
              className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
            >
              <CheckCircle2 className="size-4 mr-1.5" /> Skatīt pasūtījumus
            </Button>
          )}
        </div>
      )}
    </WizardShell>
  );

  // ── Right panel (map + contextual info) ──────────────────────────────────

  const rightPanel = (
    <div
      className={
        mode === 'public'
          ? 'hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-28 h-150 rounded-3xl shadow-xl ring-1 ring-border/40'
          : 'hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-0 h-[calc(100svh-4rem)]'
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
          {date && (
            <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              <span>{date}</span>
            </div>
          )}
        </div>
      )}

      {showMap && priceBand && weightT && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-sm font-bold text-foreground">
          ~€{(priceBand.from * parseFloat(weightT)).toFixed(0)}–€
          {(priceBand.to * parseFloat(weightT)).toFixed(0)}
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
    <div className="-m-6 xl:-m-8 flex min-h-[calc(100svh-4rem)]">
      <div className="w-full lg:w-125 xl:w-135 border-r border-border/40 bg-background flex flex-col">
        {wizardContent}
      </div>
      {rightPanel}
    </div>
  );
}
