/**
 * TransportWizard
 *
 * Single source of truth for the freight/transport order flow.
 * Used by both the public marketing site (/order/transport) and the
 * authenticated dashboard (/dashboard/order/transport).
 *
 * Flow: cargo → from → to → details (vehicle + date + time window + contact)
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
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { createTransportOrder, type TransportVehicleType } from '@/lib/api/orders';
import type { User } from '@/lib/api';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Send,
  Truck,
  User as UserIcon,
  Weight,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const VEHICLES: {
  type: TransportVehicleType;
  label: string;
  sub: string;
  maxT: number;
  fromPrice: number;
}[] = [
  {
    type: 'BOX_TRUCK',
    label: 'Kravas furgons',
    sub: 'līdz 3.5 t · 20 m³',
    maxT: 3.5,
    fromPrice: 79,
  },
  {
    type: 'TIPPER_SMALL',
    label: 'Mazais pašizgāzējs',
    sub: 'līdz 5 t · 6 m³',
    maxT: 5,
    fromPrice: 89,
  },
  {
    type: 'TIPPER_LARGE',
    label: 'Lielais pašizgāzējs',
    sub: 'līdz 15 t · 18 m³',
    maxT: 15,
    fromPrice: 149,
  },
  { type: 'FLATBED', label: 'Platforma', sub: 'līdz 20 t · 13.6 m', maxT: 20, fromPrice: 199 },
  {
    type: 'ARTICULATED_TIPPER',
    label: 'Puspiekabe',
    sub: 'līdz 26 t · 22 m³',
    maxT: 26,
    fromPrice: 219,
  },
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

const DRAFT_KEY = 'b3hub_transport_wizard_draft';
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;

type WizardStep = 'cargo' | 'from' | 'to' | 'details' | 'sent';

const STEP_INDEX: Record<WizardStep, number> = {
  cargo: 1,
  from: 2,
  to: 3,
  details: 4,
  sent: 4,
};

function suggestVehicle(weightT: number): TransportVehicleType {
  if (weightT <= 3.5) return 'BOX_TRUCK';
  if (weightT <= 5) return 'TIPPER_SMALL';
  if (weightT <= 15) return 'TIPPER_LARGE';
  if (weightT <= 20) return 'FLATBED';
  return 'ARTICULATED_TIPPER';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
}

export function TransportWizard({ mode }: Props) {
  const { token, user, setAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('cargo');
  const [cargoDesc, setCargoDesc] = useState('');
  const [weightT, setWeightT] = useState('');
  const [vehicleType, setVehicleType] = useState<TransportVehicleType>('TIPPER_LARGE');
  const [vehicleOverridden, setVehicleOverridden] = useState(false);

  const [fromAddress, setFromAddress] = useState('');
  const [fromCity, setFromCity] = useState('');
  const [fromLat, setFromLat] = useState<number | undefined>();
  const [fromLng, setFromLng] = useState<number | undefined>();

  const [toAddress, setToAddress] = useState('');
  const [toCity, setToCity] = useState('');
  const [toLat, setToLat] = useState<number | undefined>();
  const [toLng, setToLng] = useState<number | undefined>();

  const [date, setDate] = useState('');
  const [timeWindow, setTimeWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  const [refNumber, setRefNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Auth gate (public mode only)
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<((tok: string) => Promise<void>) | null>(null);

  // Auto-suggest vehicle from weight
  useEffect(() => {
    if (!vehicleOverridden) {
      setVehicleType(suggestVehicle(parseFloat(weightT) || 0));
    }
  }, [weightT, vehicleOverridden]);

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
      if (d.cargoDesc) setCargoDesc(d.cargoDesc);
      if (d.weightT) setWeightT(d.weightT);
      if (d.vehicleType) {
        setVehicleType(d.vehicleType);
        setVehicleOverridden(true);
      }
      if (d.fromAddress) setFromAddress(d.fromAddress);
      if (d.fromCity) setFromCity(d.fromCity);
      if (d.toAddress) setToAddress(d.toAddress);
      if (d.toCity) setToCity(d.toCity);
      if (d.date) setDate(d.date);
      if (d.timeWindow) setTimeWindow(d.timeWindow);
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
        cargoDesc,
        weightT,
        vehicleType,
        fromAddress,
        fromCity,
        toAddress,
        toCity,
        date,
        timeWindow,
        notes,
        step,
        savedAt: Date.now(),
      }),
    );
  }, [
    cargoDesc,
    weightT,
    vehicleType,
    fromAddress,
    fromCity,
    toAddress,
    toCity,
    date,
    timeWindow,
    notes,
    step,
    refNumber,
  ]);

  // ── Map ───────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);

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

  const updateRoutePolyline = useCallback(() => {
    const google = window.google;
    if (
      !google ||
      !mapInstanceRef.current ||
      fromLat == null ||
      fromLng == null ||
      toLat == null ||
      toLng == null
    )
      return;
    const path = [
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
    ];
    if (polylineRef.current) {
      polylineRef.current.setPath(path);
    } else {
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#6366f1',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapInstanceRef.current,
      });
    }
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: fromLat, lng: fromLng });
    bounds.extend({ lat: toLat, lng: toLng });
    mapInstanceRef.current.fitBounds(bounds, 80);
  }, [fromLat, fromLng, toLat, toLng]);

  const updateMapPin = useCallback(
    (newLat: number, newLng: number, which: 'from' | 'to') => {
      const google = window.google;
      if (!google || !mapInstanceRef.current) return;
      const position = { lat: newLat, lng: newLng };
      const markerRef = which === 'from' ? fromMarkerRef : toMarkerRef;
      const fillColor = which === 'from' ? '#22c55e' : '#ef4444';
      const label = which === 'from' ? 'A' : 'B';
      if (markerRef.current) {
        markerRef.current.setPosition(position);
      } else {
        markerRef.current = new google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          animation: google.maps.Animation.DROP,
          label: { text: label, color: '#fff', fontWeight: 'bold', fontSize: '12px' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
          },
        });
      }
      if (which === 'from' && !toLat) {
        mapInstanceRef.current.panTo(position);
        mapInstanceRef.current.setZoom(15);
      }
    },
    [toLat],
  );

  useEffect(() => {
    if (fromLat && fromLng && toLat && toLng) updateRoutePolyline();
  }, [fromLat, fromLng, toLat, toLng, updateRoutePolyline]);

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
      const result = await createTransportOrder(
        {
          pickupAddress: fromAddress,
          pickupCity: fromCity || fromAddress.split(',').slice(-1)[0]?.trim() || 'Rīga',
          pickupLat: fromLat,
          pickupLng: fromLng,
          dropoffAddress: toAddress,
          dropoffCity: toCity || toAddress.split(',').slice(-1)[0]?.trim() || 'Rīga',
          dropoffLat: toLat,
          dropoffLng: toLng,
          vehicleType,
          loadDescription: cargoDesc,
          estimatedWeight: parseFloat(weightT) || undefined,
          requestedDate: date,
          pickupWindow: timeWindow !== 'ANY' ? timeWindow : undefined,
          siteContactName: contactName || undefined,
          siteContactPhone: contactPhone || undefined,
          notes: notes || undefined,
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

  const selectedVehicle = VEHICLES.find((v) => v.type === vehicleType);
  const isSent = step === 'sent';
  const showMap = true;

  function getOnBack(): (() => void) | undefined {
    if (isSent) return undefined;
    if (step === 'cargo')
      return mode === 'dashboard' ? () => router.push('/dashboard/order') : undefined;
    if (step === 'from') return () => setStep('cargo');
    if (step === 'to') return () => setStep('from');
    if (step === 'details') return () => setStep('to');
    return undefined;
  }

  // ── Wizard content ────────────────────────────────────────────────────────

  const wizardContent = (
    <WizardShell
      className={mode === 'dashboard' ? 'flex-1' : 'w-full h-auto'}
      step={STEP_INDEX[step]}
      totalSteps={4}
      title={isSent ? 'Pieprasījums nosūtīts' : 'Kravu pārvadāšana'}
      onBack={getOnBack()}
      onClose={mode === 'public' && !isSent ? () => router.push('/order') : undefined}
      innerScroll={mode === 'dashboard'}
    >
      {/* ── Step 1: Cargo description + weight ── */}
      {step === 'cargo' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-bold text-foreground">Ko pārvadāt?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Aprakstiet kravu — mēs piedāvāsim piemēroto transportlīdzekli
            </p>
          </div>
          {mode === 'public' && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
              Pieprasījuma noslēgšanai lūgums pierakstīties vai reģistrēties — aizņem mazāk nekā 30
              sek.
            </p>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Kravas apraksts</label>
            <Textarea
              placeholder="piem. Ekskavatora asmens, 4 EUR paletes ar ķieģēļiem, metāla konstrukcija..."
              value={cargoDesc}
              onChange={(e) => setCargoDesc(e.target.value)}
              rows={3}
              className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 py-3 text-base resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Weight className="size-4" /> Aptuvens svars (tonnēs, neobligāti)
            </label>
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="piem. 3.5"
              value={weightT}
              onChange={(e) => setWeightT(e.target.value)}
              className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 h-14 text-base"
            />
            {weightT && selectedVehicle && !vehicleOverridden && (
              <p className="text-xs text-muted-foreground">
                Ieteicamais transportlīdzeklis:{' '}
                <span className="font-semibold text-foreground">{selectedVehicle.label}</span> — no
                €{selectedVehicle.fromPrice}
              </p>
            )}
          </div>

          <Button
            onClick={() => setStep('from')}
            disabled={!cargoDesc.trim()}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            Tālāk — iekraušanas adrese <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Pickup (from) address ── */}
      {step === 'from' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <Step2Address
            value={fromAddress}
            lat={fromLat}
            lng={fromLng}
            onAddressChange={(addr, la, ln, c) => {
              setFromAddress(addr);
              setFromLat(la);
              setFromLng(ln);
              if (c) setFromCity(c);
              if (la && ln) updateMapPin(la, ln, 'from');
            }}
            title="No kurienes?"
            subtitle="Ievadiet iekraušanas adresi"
            nextLabel="Tālāk — izkraušanas adrese"
            onNext={() => setStep('to')}
            onBack={() => setStep('cargo')}
          />
        </div>
      )}

      {/* ── Step 3: Dropoff (to) address ── */}
      {step === 'to' && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <Step2Address
            value={toAddress}
            lat={toLat}
            lng={toLng}
            onAddressChange={(addr, la, ln, c) => {
              setToAddress(addr);
              setToLat(la);
              setToLng(ln);
              if (c) setToCity(c);
              if (la && ln) updateMapPin(la, ln, 'to');
            }}
            title="Uz kurieni?"
            subtitle="Ievadiet izkraušanas adresi"
            nextLabel="Tālāk — datums un detaļas"
            onNext={() => setStep('details')}
            onBack={() => setStep('from')}
          />
        </div>
      )}

      {/* ── Step 4: Vehicle + date + time window + contact ── */}
      {step === 'details' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Route summary */}
          <div className="rounded-2xl bg-muted/40 p-4 space-y-2">
            <p className="font-bold text-foreground text-sm truncate">{cargoDesc}</p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0 text-emerald-600" /> {fromAddress}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-3 shrink-0 text-red-500" /> {toAddress}
              </div>
            </div>
          </div>

          {/* Vehicle type */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Truck className="size-4" /> Transportlīdzekļa tips
              </label>
              {!vehicleOverridden && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Ieteicams
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {VEHICLES.map((v) => (
                <button
                  key={v.type}
                  onClick={() => {
                    setVehicleType(v.type);
                    setVehicleOverridden(true);
                  }}
                  className={`flex items-center justify-between text-left rounded-2xl border-2 px-5 py-4 transition-all group ${
                    vehicleType === v.type
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border/60 hover:border-foreground/30'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm text-foreground">{v.label}</p>
                    <p className="text-xs text-muted-foreground">{v.sub}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground shrink-0">no €{v.fromPrice}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Vēlamais datums
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
                  Datums:{' '}
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
            <label className="text-sm font-semibold text-foreground">Iekraušanas laiks</label>
            <div className="flex gap-2">
              {(['ANY', 'AM', 'PM'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setTimeWindow(w)}
                  className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition-colors ${
                    timeWindow === w
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {w === 'ANY' ? 'Jebkurā' : w === 'AM' ? 'Rīts' : 'Pēcpusdiena'}
                </button>
              ))}
            </div>
          </div>

          {/* Contact — always visible; pre-filled from profile in dashboard mode */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              Kontaktpersona iekraušanas vietā
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
                Piezīmes (neobligāti)
              </label>
              <Textarea
                placeholder="Piekļuves instrukcijas, īpāšas prasības..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 py-3 text-base resize-none"
              />
            </div>
          </div>

          {!contactPhone.trim() && (
            <p className="text-sm text-destructive font-medium">
              Tālrunis ir obligāts — šoferim jāsazinās ar iekraušanas vietas kontaktpersonu.
            </p>
          )}

          {submitError && <p className="text-sm text-destructive font-medium">{submitError}</p>}

          <Button
            onClick={() => (mode === 'public' ? requireAuth(submit) : token && submit(token))}
            disabled={!date || !contactPhone.trim() || submitting}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Send className="size-4 mr-1.5" />
                <span>Pieprasīt transportu</span>
              </>
            )}
          </Button>

          {mode === 'public' && (
            <p className="text-xs text-center text-muted-foreground -mt-2">
              Jums būs nepieciešams konts, lai pabeigtu pieprasījumu
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
            <p className="text-2xl font-bold text-foreground">Pieprasījums nosūtīts!</p>
            {refNumber && (
              <p className="text-base text-muted-foreground font-medium mt-1">
                Nr. <span className="font-bold text-foreground">{refNumber}</span>
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">
            Pārvadātāji aprajonā saņēma paziņojumu. Labākais piedāvājums tiks apstiprināts.
          </p>
          <Button
            onClick={() => router.push('/dashboard/orders')}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            <CheckCircle2 className="size-4 mr-1.5" /> Skatīt pasūtījumus
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
          {fromAddress && (
            <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-55">{fromAddress}</span>
            </div>
          )}
          {toAddress && (
            <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-red-500 shrink-0" />
              <span className="truncate max-w-55">{toAddress}</span>
            </div>
          )}
        </div>
      )}

      {showMap && selectedVehicle && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-sm font-bold text-foreground">
          {selectedVehicle.label} · no €{selectedVehicle.fromPrice}
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
