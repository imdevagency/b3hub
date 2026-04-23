/**
 * Skip-hire order page — /dashboard/order/skip-hire
 * Matches the map-based split UI pattern of disposal.
 */
'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import Link from 'next/link';
import {
  MapPin,
  CalendarDays,
  Link2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { SKIP_STATUS, SKIP_SIZE_LABEL } from '@/lib/status-config';
import { fmtDate } from '@/lib/format';
import { WizardShell } from '@/components/order/WizardShell';

// Import steps and types
import { Step1Container } from '@/components/order/steps/Step1Container';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { Step3DateOffers, type Offer } from '@/components/order/steps/Step3DateOffers';
import { Step4ContactForm } from '@/components/order/steps/Step4ContactForm';
import { OrderConfirmation } from '@/components/order/OrderConfirmation';
import {
  createSkipHireOrder,
  mapWasteCategory,
  mapSkipSize,
  getMyOrders,
  getMySkipHireOrders,
  linkSkipOrder,
  type SkipHireOrder,
  type ApiOrder,
} from '@/lib/api';

// For map
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';

const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

function skipSizeToWizardId(size: string): string {
  const map: Record<string, string> = {
    MINI: 'mini',
    MIDI: 'midi',
    BUILDERS: 'builders',
    LARGE: 'large',
  };
  return map[size] ?? size.toLowerCase();
}

function wasteCategoryToWizardId(cat: string): string {
  const map: Record<string, string> = {
    MIXED: 'mixed',
    GREEN_GARDEN: 'green',
    CONCRETE_RUBBLE: 'concrete',
    WOOD: 'wood',
    METAL_SCRAP: 'metal',
    ELECTRONICS_WEEE: 'electronics',
  };
  return map[cat] ?? cat.toLowerCase();
}

function SkipHireOrderPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [historyOrders, setHistoryOrders] = useState<SkipHireOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [step, setStep] = useState(1);
  const [confirmedOrder, setConfirmedOrder] = useState<SkipHireOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Pre-fill from URL params for "Order Again" and "Intent-first" flows.
  const [size, setSize] = useState(searchParams.get('size') ?? '');
  const [wasteType, setWasteType] = useState(searchParams.get('waste') ?? '');
  const [address, setAddress] = useState(searchParams.get('address') ?? '');
  const [lat, setLat] = useState<number | undefined>(
    searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
  );
  const [lng, setLng] = useState<number | undefined>(
    searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
  );
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState<'ANY' | 'AM' | 'PM'>('ANY');
  const [hirePeriodDays, setHirePeriodDays] = useState(14);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [notes, setNotes] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  // Material order linking (Stage 2)
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [matOrdersLoading, setMatOrdersLoading] = useState(false);
  const [linkedMaterialOrderId, setLinkedMaterialOrderId] = useState<string | null>(null);
  const [showMatLink, setShowMatLink] = useState(false);

  // Load history when tab switches to history
  useEffect(() => {
    if (activeTab !== 'history' || !token) return;
    setHistoryLoading(true);
    setHistoryError('');
    getMySkipHireOrders(token)
      .then(setHistoryOrders)
      .catch(() => setHistoryError('Neizdevās ielādēt pasūtījumus'))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, token]);

  // If URL has address pre-filled and step 1 is complete, start at step 2.
  useEffect(() => {
    if (searchParams.get('address') && size && wasteType) {
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill contact from authenticated user profile.
  useEffect(() => {
    if (user && !contactPrefilled) {
      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      if (fullName || user.email || user.phone) {
        setContactName(fullName || '');
        setContactEmail(user.email || '');
        setContactPhone(user.phone || '');
        setContactPrefilled(true);
      }
    }
  }, [user, contactPrefilled]);

  // Load unlinked material orders when user reaches step 4
  useEffect(() => {
    if (step !== 4 || !token || matOrders.length > 0) return;
    setMatOrdersLoading(true);
    getMyOrders(token)
      .then((data) => setMatOrders(data.filter((o) => !o.linkedSkipOrder)))
      .catch(() => {})
      .finally(() => setMatOrdersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, token]);

  // ── Draft persistence (localStorage) ──────────────────────────────────────
  const DRAFT_KEY = 'b3hub_skiphire_wizard_draft';
  const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
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
      if (d.hirePeriodDays) setHirePeriodDays(d.hirePeriodDays);
      if (d.notes) setNotes(d.notes);
      if (d.step) setStep(d.step);
    } catch {
      /* ignore corrupt draft */
    } finally {
      draftLoadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (confirmedOrder) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft = {
      size,
      wasteType,
      address,
      deliveryDate,
      deliveryWindow,
      hirePeriodDays,
      notes,
      step,
      savedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    size,
    wasteType,
    address,
    deliveryDate,
    deliveryWindow,
    hirePeriodDays,
    notes,
    step,
    confirmedOrder,
  ]);

  // Map refs
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  // Initialize Google Map
  useEffect(() => {
    const apiKey = getGoogleMapsPublicKey();
    if (!apiKey) return;

    loadGoogleMapsScript(apiKey, () => {
      const google = window.google;
      if (!google || !mapDivRef.current || mapInstanceRef.current) return;

      const map = new google.maps.Map(mapDivRef.current, {
        center: DEFAULT_CENTER,
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

      // Centre on user's current location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.panTo(userPos);
            map.setZoom(14);
            new window.google.maps.Marker({
              position: userPos,
              map,
              title: 'Jūsu atrašanās vieta',
              zIndex: 1,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2.5,
              },
            });
          },
          () => {
            /* permission denied — stay on Riga */
          },
          { timeout: 8000 },
        );
      }
    });
  }, []);

  // Update marker/center when lat/lng change
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

  const handleAddressChange = (addr: string, newLat?: number, newLng?: number) => {
    setAddress(addr);
    if (newLat !== undefined && newLng !== undefined) {
      setLat(newLat);
      setLng(newLng);
      updateMapPin(newLat, newLng);
    }
  };

  const handleOfferSelect = (id: string, offers: Offer[]) => {
    const found = offers.find((o) => o.id === id) ?? null;
    setSelectedOfferId(id);
    setSelectedOffer(found);
  };

  const handleSubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createSkipHireOrder(
        {
          location: address,
          wasteCategory: mapWasteCategory(wasteType),
          skipSize: mapSkipSize(size),
          deliveryDate,
          carrierId: selectedOffer?.id ?? undefined,
          deliveryWindow: deliveryWindow !== 'ANY' ? deliveryWindow : undefined,
          contactName,
          contactEmail,
          contactPhone,
          notes: notes || undefined,
        },
        token,
      );
      // Link to material order if one was selected
      if (linkedMaterialOrderId) {
        try {
          await linkSkipOrder(linkedMaterialOrderId, result.id, token);
        } catch {
          // Non-fatal — skip order is created, linking failed silently
        }
      }
      setConfirmedOrder(result);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setConfirmedOrder(null);
    setStep(1);
    setSize('');
    setWasteType('');
    setAddress('');
    setDeliveryDate('');
    setSelectedOfferId('');
    setSelectedOffer(null);
    setContactPrefilled(false); // re-triggers pre-fill from user
    setLinkedMaterialOrderId(null);
    setMatOrders([]);
    setShowMatLink(false);
  };

  if (confirmedOrder && activeTab === 'order') {
    return (
      <div className="mx-auto max-w-3xl pt-8">
        <OrderConfirmation
          orderNumber={confirmedOrder.orderNumber}
          location={confirmedOrder.location}
          wasteCategory={confirmedOrder.wasteCategory}
          skipSize={confirmedOrder.skipSize}
          deliveryDate={confirmedOrder.deliveryDate}
          price={confirmedOrder.price}
          currency={confirmedOrder.currency}
          onReset={handleReset}
          authenticated={!!token}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className={`absolute inset-0 bg-[#e5e3df] z-0 ${activeTab === 'history' ? 'hidden' : ''}`}
      >
        <div ref={mapDivRef} className="absolute inset-0" />
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {address && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span className="truncate max-w-50">{address}</span>
            </div>
          )}
          {deliveryDate && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              {deliveryDate}
            </div>
          )}
        </div>
      </div>
      <WizardShell
        className="w-full lg:w-115 flex-1 min-h-0 lg:flex-none z-20 relative lg:absolute lg:top-4 lg:bottom-4 lg:left-4 lg:rounded-2xl lg:shadow-2xl border-t lg:border-none flex flex-col bg-white"
        title="Konteinera Noma"
        step={activeTab === 'history' ? 0 : step}
        totalSteps={4}
        onBack={() => router.push('/dashboard/order')}
        headerSlot={
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            <button
              onClick={() => setActiveTab('order')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'order' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Pasūtīt
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'history' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Vēsture
            </button>
          </div>
        }
      >
        {/* History list */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyLoading && (
              <div className="py-8 text-center text-muted-foreground text-sm">Ielādē...</div>
            )}
            {historyError && (
              <div className="py-8 text-center text-destructive text-sm">{historyError}</div>
            )}
            {!historyLoading && !historyError && historyOrders.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Nav pasūtījumu vēstures</p>
                  <p className="text-xs text-muted-foreground">
                    Pasūtīt savu pirmo konteineru augstāk
                  </p>
                </div>
              </div>
            )}
            {!historyLoading &&
              historyOrders.map((o) => {
                const st = SKIP_STATUS[o.status] ?? {
                  label: o.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                return (
                  <div
                    key={o.id}
                    className="bg-muted/50 rounded-xl border border-border/60 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">
                          #{o.orderNumber}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(o.createdAt)}
                        </p>
                      </div>
                      <div
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ backgroundColor: st.bg, color: st.text }}
                      >
                        {st.label}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm">
                        {SKIP_SIZE_LABEL[o.skipSize] ?? o.skipSize}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {o.wasteCategory.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{o.location}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">€{o.price}</span>
                      <Link
                        href={`/dashboard/order/skip-hire?size=${skipSizeToWizardId(o.skipSize)}&waste=${wasteCategoryToWizardId(o.wasteCategory)}`}
                        onClick={() => setActiveTab('order')}
                        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Pasūtīt vēlreiz
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {/* Wizard steps */}
        {activeTab === 'order' && step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
            <Step1Container
              size={size}
              wasteType={wasteType}
              onSizeChange={(v) => setSize(v)}
              onWasteChange={(v) => setWasteType(v)}
              onNext={() => setStep(2)}
            />
          </div>
        )}

        {activeTab === 'order' && step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
            <Step2Address
              value={address}
              lat={lat}
              lng={lng}
              onAddressChange={handleAddressChange}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          </div>
        )}

        {activeTab === 'order' && step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 pb-6 relative overflow-visible">
            <Step3DateOffers
              size={size}
              location={address}
              deliveryDate={deliveryDate}
              hirePeriodDays={hirePeriodDays}
              selectedOffer={selectedOfferId}
              deliveryWindow={deliveryWindow}
              onDeliveryWindowChange={(w) => setDeliveryWindow(w)}
              compact={true}
              onDeliveryDateChange={(d) => {
                setDeliveryDate(d);
                setSelectedOfferId('');
                setSelectedOffer(null);
              }}
              onHirePeriodChange={(d) => setHirePeriodDays(d)}
              onOfferSelect={handleOfferSelect}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          </div>
        )}

        {activeTab === 'order' && step === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 pb-6 space-y-4">
            {/* Link to material order */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMatLink((v) => !v)}
                className="w-full flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Link2 className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">
                  {linkedMaterialOrderId
                    ? `Saistīts: #${matOrders.find((o) => o.id === linkedMaterialOrderId)?.orderNumber ?? '...'}`
                    : 'Saistīt ar materiālu pasūtījumu (neobligāti)'}
                </span>
                {showMatLink ? (
                  <ChevronUp className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                )}
              </button>

              {showMatLink && (
                <div className="rounded-xl border border-border overflow-hidden">
                  {matOrdersLoading ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">Ielādē...</div>
                  ) : matOrders.length === 0 ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      Nav aktīvu materiālu pasūtījumu
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {linkedMaterialOrderId && (
                        <button
                          type="button"
                          onClick={() => {
                            setLinkedMaterialOrderId(null);
                            setShowMatLink(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          Noņemt saiti
                        </button>
                      )}
                      {matOrders.map((o) => {
                        const selected = o.id === linkedMaterialOrderId;
                        const name = o.items?.[0]?.material?.name ?? '—';
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setLinkedMaterialOrderId(o.id);
                              setShowMatLink(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-sm flex items-center justify-between transition-colors ${
                              selected ? 'bg-black text-white' : 'hover:bg-muted/40 text-foreground'
                            }`}
                          >
                            <div>
                              <span className="font-semibold">#{o.orderNumber}</span>
                              <span
                                className={`ml-2 ${selected ? 'text-gray-300' : 'text-muted-foreground'}`}
                              >
                                {name}
                              </span>
                            </div>
                            {selected && <span className="text-xs font-bold"></span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Step4ContactForm
              name={contactName}
              email={contactEmail}
              phone={contactPhone}
              notes={notes}
              summary={{
                size,
                wasteType,
                address,
                deliveryDate,
                hirePeriodDays,
                offerCarrier: selectedOffer?.carrier ?? '',
                offerPrice: selectedOffer?.price ?? 0,
              }}
              onChange={(k, v) => {
                if (k === 'name') setContactName(v);
                else if (k === 'email') setContactEmail(v);
                else if (k === 'phone') setContactPhone(v);
                else if (k === 'notes') setNotes(v);
              }}
              onSubmit={handleSubmit}
              onBack={() => setStep(3)}
              submitting={submitting}
              error={submitError}
              preFilledFromProfile={contactPrefilled}
            />
          </div>
        )}
      </WizardShell>
    </>
  );
}

export default function SkipHireOrderPage() {
  return (
    <Suspense>
      <SkipHireOrderPageInner />
    </Suspense>
  );
}
