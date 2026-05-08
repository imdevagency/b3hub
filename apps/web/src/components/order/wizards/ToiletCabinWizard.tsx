/**
 * ToiletCabinWizard
 *
 * 3-step wizard for toilet cabin (portable toilet) hire.
 * Used by both the public marketing site (/order/toilet-cabin) and
 * the authenticated dashboard (/dashboard/order/toilet-cabin).
 *
 * Flow: cabin count + hire period → address → date range + contact + summary
 *
 *  mode="public"    → contact collected from guest → auth gate fires on submit
 *  mode="dashboard" → contact pre-filled from user profile → submits directly
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WizardShell } from '@/components/order/WizardShell';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { WebWizardAuthGate, type GuestContactInfo } from '@/components/order/WebWizardAuthGate';
import { Container } from '@/components/marketing/layout/Container';
import { Calendar } from '@/components/ui/calendar';
import { createToiletCabinOrder } from '@/lib/api/toilet-cabins';
import type { User } from '@/lib/api';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Phone,
  Plus,
  User as UserIcon,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRICE_PER_CABIN_PER_DAY = 12; // EUR

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
}

export function ToiletCabinWizard({ mode }: Props) {
  const { user, token } = useAuth();
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  // Step 1 — cabin config
  const [cabinCount, setCabinCount] = useState(1);

  // Step 2 — address
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  // ── Map ───────────────────────────────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = getGoogleMapsPublicKey();
    if (!apiKey) return;
    loadGoogleMapsScript(apiKey, () => {
      const google = window.google;
      if (!google || !mapDivRef.current || mapInstanceRef.current) return;
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: 56.946, lng: 24.1059 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
      mapInstanceRef.current = map;
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
          scale: 10,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
    }
    mapInstanceRef.current.panTo(position);
    mapInstanceRef.current.setZoom(16);
  }, []);

  // Step 3 — delivery
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM' | ''>('');
  const [contactName, setContactName] = useState(
    mode === 'dashboard' && user
      ? `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim()
      : '',
  );
  const [contactPhone, setContactPhone] = useState(
    mode === 'dashboard' ? ((user as any)?.phone ?? '') : '',
  );
  const [contactEmail, setContactEmail] = useState(mode === 'dashboard' ? (user?.email ?? '') : '');
  const [notes, setNotes] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [pendingAction, setPendingAction] = useState<((tok: string) => Promise<void>) | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const rangeDays =
    dateRange?.from && dateRange?.to
      ? differenceInCalendarDays(dateRange.to, dateRange.from) + 1
      : null;
  const effectiveDays = rangeDays ?? 0;
  const estimatedPrice = cabinCount * effectiveDays * PRICE_PER_CABIN_PER_DAY;

  // ── Submit helpers ────────────────────────────────────────────────────────────

  async function submit(tok: string) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createToiletCabinOrder(
        {
          address,
          city,
          lat,
          lng,
          cabinCount,
          hireDays: effectiveDays,
          deliveryDate: dateRange!.from!.toISOString().split('T')[0],
          deliveryWindow: deliveryWindow || undefined,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          notes: notes || undefined,
          paymentMethod: 'CARD',
        },
        tok,
      );
      setOrderNumber(result.orderNumber);
      setIsConfirmed(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Neizdevās iesniegt pasūtījumu');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGuestContact(contact: GuestContactInfo) {
    setShowAuthGate(false);
    setContactName(contact.name);
    setContactPhone(contact.phone);
    if (contact.email) setContactEmail(contact.email);
    // No token for guest path — submit without auth
    await submit('');
  }

  function handleAuthenticated(authUser: User, tok: string) {
    setShowAuthGate(false);
    setContactName(
      contactName ||
        `${(authUser as any).firstName ?? ''} ${(authUser as any).lastName ?? ''}`.trim(),
    );
    if (pendingAction) {
      pendingAction(tok);
      setPendingAction(null);
    } else {
      submit(tok);
    }
  }

  function handleSubmitClick() {
    if (mode === 'dashboard' && token) {
      submit(token);
    } else if (user && token) {
      submit(token);
    } else {
      setPendingAction(() => submit);
      setShowAuthGate(true);
    }
  }

  // ── Confirmed screen ──────────────────────────────────────────────────────────

  if (isConfirmed) {
    return (
      <div className="flex flex-col items-center gap-6 py-20 px-6 text-center max-w-lg mx-auto">
        <div className="p-5 bg-green-50 rounded-full">
          <CheckCircle2 className="w-12 h-12 text-green-600" strokeWidth={1.5} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Pasūtījums saņemts!</h1>
        <p className="text-muted-foreground">
          Pasūtījuma numurs: <span className="font-semibold text-foreground">{orderNumber}</span>
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Mēs sazināsimies ar jums, lai apstiprinātu piegādes laiku. Kabīnes tiks piegādātas jūsu
          norādītajā adresē.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full max-w-sm">
          <Button className="flex-1" onClick={() => router.push('/order')}>
            Atpakaļ uz pakalpojumiem
          </Button>
          {mode === 'dashboard' && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/dashboard/orders')}
            >
              Mani pasūtījumi
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Wizard steps ──────────────────────────────────────────────────────────────

  const canProceedStep0 = cabinCount >= 1 && !!dateRange?.from && !!dateRange?.to;

  const wizardContent = (
    <WizardShell
      className={mode === 'dashboard' ? 'flex-1' : 'w-full h-auto'}
      step={step + 1}
      totalSteps={3}
      title="Tualetes kabīnes"
      onClose={mode === 'public' && !isConfirmed ? () => router.push('/order') : undefined}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
      innerScroll={mode === 'dashboard'}
    >
      {/* ── Step 0: Cabin count + date range ───────────────────────── */}
      {step === 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <p className="text-xl font-bold text-foreground">Cik kabīnes nepieciešams?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Izvēlieties daudzumu un nomas periodu
            </p>
          </div>

          {/* Cabin count */}
          <div className="flex items-center gap-5 rounded-2xl border border-border/60 bg-card px-6 py-5">
            <button
              type="button"
              onClick={() => setCabinCount(Math.max(1, cabinCount - 1))}
              className="flex size-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted/50 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-5xl font-bold tracking-tighter">{cabinCount}</span>
              <p className="text-xs text-muted-foreground mt-1">
                kabīne{cabinCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCabinCount(cabinCount + 1)}
              className="flex size-10 items-center justify-center rounded-full border border-border bg-background hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Date range calendar */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Nomas periods
            </label>
            <div className="rounded-2xl border overflow-hidden">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={{ before: new Date(Date.now() + 86400000) }}
                className="p-3"
              />
            </div>
            {dateRange?.from && dateRange?.to && (
              <div className="flex items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                <CalendarDays className="size-4 text-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground">
                  {dateRange.from.toLocaleDateString('lv-LV', { day: 'numeric', month: 'long' })}
                  {' – '}
                  {dateRange.to.toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  {' · '}
                  {rangeDays} {rangeDays === 1 ? 'diena' : 'dienas'}
                </span>
              </div>
            )}
          </div>

          {/* Price estimate */}
          {dateRange?.from && dateRange?.to && (
            <div className="rounded-2xl bg-muted/40 border border-border p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Orientējoša cena</p>
                <p className="text-2xl font-bold tracking-tight">€{estimatedPrice.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cabinCount} kab. × {effectiveDays} d. × €{PRICE_PER_CABIN_PER_DAY}/d.
                </p>
              </div>
            </div>
          )}

          <Button
            disabled={!canProceedStep0}
            onClick={() => setStep(1)}
            className="w-full rounded-full h-14 text-base font-bold shadow-md hover:shadow-lg transition-all"
          >
            Tālāk — piegādes adrese <ArrowRight className="size-4 ml-1.5" />
          </Button>
        </div>
      )}

      {/* ── Step 1: Address ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-2">
          <Step2Address
            value={address}
            lat={lat}
            lng={lng}
            title="Kur piegādāt kabīnes?"
            subtitle="Ievadiet precīzu adresi — šoferis atbrauks ar kabīnēm uz šo vietu"
            nextLabel="Tālāk — datums un kontakti"
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            onAddressChange={(addr, la, ln, ct) => {
              setAddress(addr);
              setLat(la);
              setLng(ln);
              if (ct) setCity(ct);
              if (la && ln) updateMapPin(la, ln);
            }}
          />
        </div>
      )}

      {/* ── Step 2: Time window + contact + submit ─────────────────── */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* Order summary pill */}
          <div className="rounded-2xl bg-muted/40 p-4 flex items-center gap-3">
            <CalendarDays className="size-5 text-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-sm">
                {cabinCount} kabīne{cabinCount !== 1 ? 's' : ''} · {effectiveDays} dienas
              </p>
              <p className="text-xs text-muted-foreground truncate">{address}</p>
            </div>
            <p className="text-base font-bold text-foreground shrink-0">
              ~€{estimatedPrice.toFixed(0)}
            </p>
          </div>

          {/* Delivery time window */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Piegādes laiks</label>
            <div className="flex gap-2">
              {(
                [
                  { value: 'ANY', label: 'Jebkurā laikā' },
                  { value: 'AM', label: 'Rīts (8–12)' },
                  { value: 'PM', label: 'Pēcpusdiena (12–17)' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryWindow(deliveryWindow === value ? '' : value)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    deliveryWindow === value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              Kontaktpersona objektā
              {mode === 'dashboard' && (
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
                  <Mail className="size-3" /> E-pasts (neobligāti)
                </label>
                <Input
                  type="email"
                  placeholder="jusu@epasts.lv"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="rounded-2xl bg-muted/30 border-2 border-transparent hover:border-border focus-visible:border-foreground focus-visible:ring-0 shadow-none px-4 h-14 text-base"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Piezīmes (piekļuve, vārti, u.c.) — neobligāti
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

          {submitError && <p className="text-sm text-destructive font-medium">{submitError}</p>}

          <Button
            disabled={submitting}
            onClick={handleSubmitClick}
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
            <p className="text-xs text-center text-muted-foreground -mt-2">Pasūtīt var bez konta</p>
          )}
        </div>
      )}
    </WizardShell>
  );

  // ── Right panel ────────────────────────────────────────────────────────────

  const showMap = step === 1;

  const rightPanel = (
    <div
      className={
        mode === 'public'
          ? 'hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-28 h-150 rounded-3xl shadow-xl ring-1 ring-border/40'
          : 'hidden lg:flex flex-1 overflow-hidden bg-muted/10 sticky top-0 h-[calc(100svh-4rem)]'
      }
    >
      {/* Map — always rendered so Google Maps initialises; hidden on non-address steps */}
      <div
        ref={mapDivRef}
        className={`absolute inset-0 transition-opacity duration-300 ${showMap ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {showMap && address && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-background/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-border/50 text-xs font-medium text-foreground flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate max-w-55">{address}</span>
          </div>
        </div>
      )}

      {!showMap && (
        <div className="flex flex-1 flex-col gap-8 justify-center px-10 py-10">
          <div>
            <p className="text-2xl font-bold text-foreground mb-2">Tualetes kabīnes</p>
            <p className="text-sm text-muted-foreground">
              Pārvietojamās tualetes būvlaukumiem, pasākumiem un renovācijām. Regulāra apkope
              iekļauta.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              {
                icon: '🚚',
                label: 'Piegāde un uzstādīšana',
                sub: 'Piegādājam un novietojam norādītājā vietā',
              },
              {
                icon: '🧹',
                label: 'Apkope 1× nedēļā',
                sub: 'Tīrīšana, dezinfekcija un atkritumu izvešana',
              },
              {
                icon: '🔄',
                label: 'Savākšana nomas beigās',
                sub: 'Atbraucam un novācam kabīni bez piemaksas',
              },
              {
                icon: '📋',
                label: 'Rēķins un dokumenti',
                sub: 'Piegādājam visus nepieciešamos dokumentus',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-2xl bg-background/60 border border-border/40 px-4 py-3"
              >
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {estimatedPrice > 0 && (
            <div className="rounded-2xl bg-foreground text-background px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium opacity-70 mb-0.5">Orientējoša cena</p>
                <p className="text-3xl font-bold">€{estimatedPrice.toFixed(0)}</p>
              </div>
              <div className="text-right text-xs opacity-70">
                <p>
                  {cabinCount} kab. × {effectiveDays || '?'} d.
                </p>
                <p>€{PRICE_PER_CABIN_PER_DAY}/kab./dienā</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Layout ─────────────────────────────────────────────────────────────────────────

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
          open={showAuthGate}
          onAuthenticated={handleAuthenticated}
          onGuestContact={handleGuestContact}
          onDismiss={() => setShowAuthGate(false)}
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
