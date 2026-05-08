/**
 * ScrapBuybackWizard
 *
 * Web wizard for the scrap metal buyback (iepirkšana) flow.
 * Material type is always METAL — buyers get paid per tonne.
 *
 * Flow:
 *   Step 1 — Weight: how many tonnes of scrap metal?
 *   Step 2 — Pickup address: where will the driver collect from?
 *   Step 3 — Offer comparison: sorted list of recycling centers with payout per tonne.
 *   Step 4 — Contact + date → creates disposal order with buybackPricePerTonne.
 *
 * Auth gate fires at step 3→4 (submitting requires account for payout).
 * Offers (step 3) are loaded publicly — no token needed.
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WizardShell } from '@/components/order/WizardShell';
import { WebWizardAuthGate } from '@/components/order/WebWizardAuthGate';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { getBuybackQuote, type BuybackQuoteResult } from '@/lib/api/recycling-centers';
import { createDisposalOrder, type DisposalTruckType } from '@/lib/api/orders';
import type { User } from '@/lib/api';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Scale,
  User as UserIcon,
  Weight,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'b3hub_scrap_buyback_wizard_draft';
const DRAFT_TTL = 3 * 24 * 60 * 60 * 1000;

type WizardStep = 'weight' | 'address' | 'offers' | 'contact' | 'sent';

const STEP_INDEX: Record<WizardStep, number> = {
  weight: 1,
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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  mode: 'public' | 'dashboard';
}

export function ScrapBuybackWizard({ mode }: Props) {
  const { token, user, setAuth } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('weight');

  // Step 1
  const [weightT, setWeightT] = useState('');

  // Step 2
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

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
  const [notes, setNotes] = useState('');
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
      if (!raw) { draftLoadedRef.current = true; return; }
      const d = JSON.parse(raw);
      if (Date.now() - (d.savedAt ?? 0) > DRAFT_TTL) {
        localStorage.removeItem(DRAFT_KEY);
        draftLoadedRef.current = true;
        return;
      }
      if (d.weightT) setWeightT(d.weightT);
      if (d.address) setAddress(d.address);
      if (d.city) setCity(d.city);
      if (d.lat) setLat(d.lat);
      if (d.lng) setLng(d.lng);
      if (d.notes) setNotes(d.notes);
      if (d.pickupDate) setPickupDate(d.pickupDate);
      if (d.step && d.step !== 'sent') setStep(d.step);
    } catch { /* ignore */ } finally {
      draftLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current || refNumber) {
      if (refNumber) localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      weightT, address, city, lat, lng, notes, pickupDate, step, savedAt: Date.now(),
    }));
  }, [weightT, address, city, lat, lng, notes, pickupDate, step, refNumber]);

  // ── Load offers ─────────────────────────────────────────────────────────

  const loadOffers = useCallback(async () => {
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
  }, [weightT, lat, lng]);

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
          notes: notes || undefined,
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
  const validAddress = address.trim().length > 0;
  const selectedOffer = offers?.find((o) => o.centerId === selectedCenterId) ?? null;
  const isSent = step === 'sent';

  function getOnBack(): (() => void) | undefined {
    if (isSent) return undefined;
    if (step === 'weight') return mode === 'dashboard' ? () => router.push('/dashboard/order') : undefined;
    if (step === 'address') return () => setStep('weight');
    if (step === 'offers') return () => setStep('address');
    if (step === 'contact') return () => setStep('offers');
    return undefined;
  }

  // ── Wizard content ────────────────────────────────────────────────────────

  const wizardContent = (
    <WizardShell
      className={mode === 'dashboard' ? 'flex-1' : 'w-full h-auto'}
      step={STEP_INDEX[step]}
      totalSteps={4}
      title={isSent ? 'Pieteikums nosūtīts' : 'Metāllūžņi'}
      onBack={getOnBack()}
      onClose={mode === 'public' && !isSent ? () => router.push('/order') : undefined}
      innerScroll={mode === 'dashboard'}
    >
      {/* ── Step 1: Weight ── */}
      {step === 'weight' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 p-4">
          <div>
            <p className="text-xl font-bold text-foreground">Cik daudz metāla?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Norādiet aptuvenais daudzums tonnās. Precīzu svaru noteiks pieņemšanas punktā.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              <span className="flex items-center gap-1.5"><Weight className="size-4" />Svars (tonnas)</span>
            </label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="piem. 1.5"
              value={weightT}
              onChange={(e) => setWeightT(e.target.value)}
              className="text-base"
              autoFocus
            />
            {validWeight && (
              <p className="text-xs text-muted-foreground mt-1.5">
                ≈ {Math.round(weightNum * 1000)} kg
              </p>
            )}
          </div>

          <div className="rounded-xl bg-muted/50 p-4 space-y-1.5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Pieņemamie metāli</p>
            <p>Dzelzs un tērauds (armatūra, profili, lūžņi)</p>
            <p>Vara vadi un caurules</p>
            <p>Alumīnijs (profili, trauki, folija)</p>
            <p>Citi krāsainie metāli</p>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!validWeight}
            onClick={() => setStep('address')}
          >
            Turpināt <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}

      {/* ── Step 2: Pickup address ── */}
      {step === 'address' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 p-4">
          <div>
            <p className="text-xl font-bold text-foreground">Kur atrodas metāls?</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pieņemšanas punkts nosūtīs pārvadātāju uz šo adresi.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              <span className="flex items-center gap-1.5"><MapPin className="size-4" />Izbraukšanas adrese</span>
            </label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              placeholder="Ievadiet adresi..."
              onSelect={(place) => {
                setAddress(place.address);
                setCity(place.city ?? '');
                setLat(place.lat ?? undefined);
                setLng(place.lng ?? undefined);
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Piezīmes par atrašanās vietu</label>
            <Textarea
              placeholder="piem. Pagalms, vārti pa kreisi, zvanīt ierodoties..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!validAddress}
            onClick={async () => {
              setStep('offers');
              await loadOffers();
            }}
          >
            Skatīt piedāvājumus <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      )}

      {/* ── Step 3: Offer comparison ── */}
      {step === 'offers' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 p-4">
          <div>
            <p className="text-xl font-bold text-foreground">Pieņemšanas punkti</p>
            <p className="text-sm text-muted-foreground mt-1">
              Cenas par {weightT} t metāla. Izvēlieties labāko piedāvājumu.
            </p>
          </div>

          {offersLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Meklē labākos piedāvājumus…</p>
            </div>
          )}

          {offersError && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
              {offersError}
              <Button variant="link" size="sm" className="mt-1 p-0 h-auto" onClick={loadOffers}>
                Mēģināt vēlreiz
              </Button>
            </div>
          )}

          {!offersLoading && !offersError && offers !== null && offers.length === 0 && (
            <div className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Nav pieejamu piedāvājumu</p>
              <p>Šobrīd neviens pieņemšanas punkts nepiedāvā iepirkšanu jūsu reģionā. Lūdzu, mēģiniet vēlāk.</p>
            </div>
          )}

          {!offersLoading && offers && offers.length > 0 && (
            <div className="space-y-3">
              {offers.map((offer) => {
                const isSelected = offer.centerId === selectedCenterId;
                return (
                  <button
                    key={offer.centerId}
                    onClick={() => setSelectedCenterId(offer.centerId)}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                      isSelected
                        ? 'border-foreground bg-foreground/5'
                        : 'border-border bg-background hover:border-foreground/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-foreground truncate">{offer.name}</p>
                          {offer.licensed && (
                            <BadgeCheck className="size-4 shrink-0 text-green-600" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {offer.city}{offer.distanceKm != null ? ` · ${offer.distanceKm} km` : ''}
                        </p>
                        {offer.certifications.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Award className="size-3 text-muted-foreground" />
                            <p className="text-[11px] text-muted-foreground">
                              {offer.certifications.slice(0, 2).join(', ')}
                            </p>
                          </div>
                        )}
                        {offer.centerNotes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{offer.centerNotes}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-2xl font-extrabold text-foreground leading-none">
                          €{offer.totalPayoutEur.toFixed(2)}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          €{offer.buybackPricePerTonne}/t
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1.5 text-xs text-green-700 font-semibold">
                        <CheckCircle2 className="size-3.5" />
                        Izvēlētais piedāvājums
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!offersLoading && offers && offers.length > 0 && (
            <Button
              className="w-full"
              size="lg"
              disabled={!selectedCenterId}
              onClick={() => {
                if (mode === 'public' && !token) {
                  setPendingAction(() => async (tok: string) => {
                    setStep('contact');
                    void tok;
                  });
                  setAuthGateOpen(true);
                } else {
                  setStep('contact');
                }
              }}
            >
              Pieteikt nodošanu <ArrowRight className="ml-2 size-4" />
            </Button>
          )}
        </div>
      )}

      {/* ── Step 4: Contact + date ── */}
      {step === 'contact' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 p-4">
          <div>
            <p className="text-xl font-bold text-foreground">Kontaktinformācija</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pārvadātājs sazināsies ar jums, lai vienotos par precīzu laiku.
            </p>
          </div>

          {selectedOffer && (
            <div className="rounded-xl bg-muted/50 p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Izvēlētais punkts</p>
                <p className="font-bold text-foreground truncate">{selectedOffer.name}</p>
                <p className="text-xs text-muted-foreground">{selectedOffer.city}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-extrabold text-foreground">€{selectedOffer.totalPayoutEur.toFixed(2)}</p>
                <p className="text-[11px] text-muted-foreground">€{selectedOffer.buybackPricePerTonne}/t</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />Vēlamais datums</span>
              </label>
              <Input
                type="date"
                value={pickupDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><UserIcon className="size-4" />Kontaktpersona</span>
              </label>
              <Input
                placeholder="Vārds Uzvārds"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                <span className="flex items-center gap-1.5"><Phone className="size-4" />Tālrunis</span>
              </label>
              <Input
                type="tel"
                placeholder="+371 2X XXX XXX"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>

            {mode === 'public' && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  <span className="flex items-center gap-1.5"><Mail className="size-4" />E-pasts</span>
                </label>
                <Input
                  type="email"
                  placeholder="jusu@epasts.lv"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <Button
            className="w-full"
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
              <><Loader2 className="mr-2 size-4 animate-spin" />Iesniedz…</>
            ) : (
              <>Iesniegt pieteikumu <Scale className="ml-2 size-4" /></>
            )}
          </Button>
        </div>
      )}

      {/* ── Sent ── */}
      {isSent && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in slide-in-from-bottom-2 gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="size-8 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Pieteikums nosūtīts!</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Saņemsiet zvanu no pārvadātāja, lai vienotos par izbraukšanas laiku.
              {refNumber && (
                <><br /><span className="font-mono font-semibold text-foreground">{refNumber}</span></>
              )}
            </p>
          </div>
          {selectedOffer && (
            <div className="rounded-xl bg-muted/50 p-4 w-full text-left">
              <p className="text-xs text-muted-foreground mb-1">Paredzamā izmaksa</p>
              <p className="text-3xl font-extrabold text-foreground">€{selectedOffer.totalPayoutEur.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Precīzu summu noteiks pēc svēršanas {selectedOffer.name} punktā.
              </p>
            </div>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              mode === 'dashboard'
                ? router.push('/dashboard/orders')
                : router.push('/')
            }
          >
            {mode === 'dashboard' ? 'Uz pasūtījumiem' : 'Uz sākumu'}
          </Button>
        </div>
      )}
    </WizardShell>
  );

  return (
    <>
      {mode === 'public' ? (
        <div className="min-h-screen bg-background">
          <div className="max-w-2xl mx-auto px-4 py-8 md:py-16">
            {wizardContent}
          </div>
        </div>
      ) : (
        wizardContent
      )}

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
