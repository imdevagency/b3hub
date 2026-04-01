/**
 * Skip-hire order page — /dashboard/order/skip-hire
 * Matches the map-based split UI pattern of disposal.
 */
'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  ArrowLeft,
  Package,
  MapPin,
  CalendarDays,
  ClipboardList,
  Link2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

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
  linkSkipOrder,
  type SkipHireOrder,
  type ApiOrder,
} from '@/lib/api';

// For map
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';

const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

const STEPS = [
  { label: 'Konteiners', icon: Package },
  { label: 'Adrese', icon: MapPin },
  { label: 'Datums', icon: CalendarDays },
  { label: 'Apstiprināt', icon: ClipboardList },
];

function SkipHireOrderPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, user } = useAuth();

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
  const [hirePeriodDays, setHirePeriodDays] = useState(14);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  // Material order linking (Stage 2)
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [matOrdersLoading, setMatOrdersLoading] = useState(false);
  const [linkedMaterialOrderId, setLinkedMaterialOrderId] = useState<string | null>(null);
  const [showMatLink, setShowMatLink] = useState(false);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new (window as any).google.maps.Marker({
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
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

  if (confirmedOrder) {
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
    <div className="h-[calc(100vh-100px)] w-full bg-background rounded-2xl overflow-hidden shadow-lg border flex flex-col-reverse lg:flex-row">
      <div className="w-full lg:w-115 shrink-0 flex flex-col bg-background z-10 relative border-t lg:border-t-0 lg:border-r">
        <div className="p-5 border-b bg-card space-y-3">
          <Link
            href="/dashboard/order"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Konteinera Noma</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pasūtiet būvgružu konteineru un izvēlieties labāko piedāvājumu
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin flex flex-col space-y-6">
          {/* Step indicators */}
          <div className="flex gap-2 w-full shrink-0">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex-1 flex flex-col gap-2">
                  <div
                    className={`h-1.25 w-full rounded-full transition-all ${
                      done ? 'bg-green-500' : active ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                  <div className="flex items-center gap-1.5 opacity-80">
                    <s.icon
                      className={`h-3.5 w-3.5 ${done ? 'text-green-600' : active ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={`text-xs font-semibold ${
                        done
                          ? 'text-green-700'
                          : active
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <span className="hidden sm:inline">{s.label}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1">
            {submitError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <span className="font-semibold">Kļūda:</span> {submitError}
              </div>
            )}

            {step === 1 && (
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

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                <Step2Address
                  value={address}
                  onAddressChange={handleAddressChange}
                  onNext={() => setStep(3)}
                  onBack={() => setStep(1)}
                />
              </div>
            )}

            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6 relative overflow-visible">
                <Step3DateOffers
                  size={size}
                  location={address}
                  deliveryDate={deliveryDate}
                  hirePeriodDays={hirePeriodDays}
                  selectedOffer={selectedOfferId}
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

            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6 space-y-4">
                {/* Link to material order */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowMatLink((v) => !v)}
                    className="w-full flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
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
                        <div className="p-4 text-sm text-center text-muted-foreground">
                          Ielādē...
                        </div>
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
                                  selected
                                    ? 'bg-emerald-600 text-white'
                                    : 'hover:bg-muted/40 text-foreground'
                                }`}
                              >
                                <div>
                                  <span className="font-semibold">#{o.orderNumber}</span>
                                  <span
                                    className={`ml-2 ${selected ? 'text-emerald-100' : 'text-muted-foreground'}`}
                                  >
                                    {name}
                                  </span>
                                </div>
                                {selected && <span className="text-xs font-bold">✓</span>}
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
          </div>
        </div>
      </div>

      <div className="relative w-full h-75 lg:h-auto lg:flex-1 bg-muted/30">
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
    </div>
  );
}

export default function SkipHireOrderPage() {
  return (
    <Suspense>
      <SkipHireOrderPageInner />
    </Suspense>
  );
}
