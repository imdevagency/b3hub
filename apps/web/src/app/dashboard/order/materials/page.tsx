/**
 * Materials order page — /dashboard/order/materials
 * 4-step wizard: What → Where → When → Who
 * Mirrors the skip-hire wizard layout with a split panel + live map.
 * Can be deep-linked from the catalog: ?materialId=<id> pre-selects a material.
 */
'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  loadGoogleMapsScript,
  AddressAutocomplete,
  type PlaceAddress,
} from '@/components/ui/AddressAutocomplete';
import { createCartOrder, type ApiOrder } from '@/lib/api';

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Layers,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ReceiptText,
  UserCheck,
  Zap,
} from 'lucide-react';

import { MatStep1What, type SelectedItem } from '@/components/order/steps/MatStep1What';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { MatStep3When } from '@/components/order/steps/MatStep3When';
import { MatStep4Who } from '@/components/order/steps/MatStep4Who';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

const STEPS = [
  { label: 'Materiāls', icon: Layers },
  { label: 'Adrese', icon: MapPin },
  { label: 'Datums', icon: CalendarDays },
  { label: 'Apstiprināt', icon: ClipboardList },
];

// ── Confirmation screen ───────────────────────────────────────────────────────

function MaterialsConfirmation({
  order,
  items,
  onReset,
}: {
  order: ApiOrder;
  items: SelectedItem[];
  onReset: () => void;
}) {
  const router = useRouter();
  const subtotal = items.reduce((s, i) => s + i.material.basePrice * i.qty, 0);
  const total = subtotal * 1.21;

  return (
    <div className="mx-auto max-w-lg py-12 px-4">
      <div className="rounded-3xl border bg-card shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Pasūtījums veikts!</h1>
          <p className="mt-1 text-sm text-white/80">
            Pasūtījuma numurs: <span className="font-bold">{order.orderNumber}</span>
          </p>
        </div>

        {/* Summary */}
        <div className="p-6 space-y-4">
          <div className="rounded-2xl border bg-muted/30 divide-y overflow-hidden">
            {items.map((item) => (
              <div
                key={item.material.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.material.name}</p>
                  <p className="text-xs text-muted-foreground">{item.material.supplier.name}</p>
                </div>
                <span className="font-semibold">
                  €{(item.qty * item.material.basePrice).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">Piegādes adrese</span>
              <span className="font-semibold text-right max-w-50 truncate">
                {order.deliveryAddress}
              </span>
            </div>
            {order.deliveryDate && (
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">Piegādes datums</span>
                <span className="font-semibold">
                  {new Date(order.deliveryDate).toLocaleDateString('lv-LV', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3 text-sm font-bold bg-muted/20">
              <span>Kopā (iekļ. PVN)</span>
              <span className="text-primary text-base">€{total.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Piegādātājs sazināsies ar jums, lai apstiprinātu piegādes laiku.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/dashboard/orders')}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
            >
              <ReceiptText className="size-4" />
              Skatīt manus pasūtījumus
            </button>
            <button
              onClick={onReset}
              className="w-full rounded-xl border py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Jauns pasūtījums
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick checkout (single-pane form used when coming from catalog) ────────────────────────────

interface QuickCheckoutProps {
  items: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
  address: string;
  onAddressChange: (v: string) => void;
  deliveryDate: string;
  onDeliveryDateChange: (v: string) => void;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  onContactChange: (k: 'name' | 'email' | 'phone' | 'notes', v: string) => void;
  preFilledFromProfile: boolean;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string;
}

function MaterialsQuickCheckout({
  items,
  onItemsChange,
  address,
  onAddressChange,
  deliveryDate,
  onDeliveryDateChange,
  contactName,
  contactEmail,
  contactPhone,
  notes,
  onContactChange,
  preFilledFromProfile,
  onSubmit,
  onBack,
  submitting,
  error,
}: QuickCheckoutProps) {
  const [contactExpanded, setContactExpanded] = useState(!preFilledFromProfile);

  const subtotal = items.reduce((s, i) => s + i.material.basePrice * i.qty, 0);
  const total = subtotal * 1.21;

  const canSubmit =
    address.trim().length > 5 &&
    items.length > 0 &&
    contactName.trim().length >= 2 &&
    contactEmail.includes('@') &&
    contactPhone.trim().length >= 6;

  function adjustQty(materialId: string, delta: number) {
    onItemsChange(
      items
        .map((i) => (i.material.id === materialId ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Ātrā pasūtīšana</h2>
        <p className="text-sm text-gray-500">Aizpildiet visus laukus un apstipriniet</p>
      </div>

      {/* Materials */}
      <div className="rounded-2xl border-2 border-gray-100 overflow-hidden">
        <div className="bg-primary px-4 py-2.5">
          <p className="text-xs font-bold text-white uppercase tracking-wider">Materiāli</p>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.material.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{item.material.name}</p>
                <p className="text-xs text-gray-500">{item.material.supplier.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => adjustQty(item.material.id, -1)}
                  className="size-7 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Minus className="size-3" />
                </button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">
                  {item.qty}
                </span>
                <button
                  onClick={() => adjustQty(item.material.id, 1)}
                  className="size-7 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <span className="w-20 text-right text-sm font-bold text-primary tabular-nums">
                €{(item.qty * item.material.basePrice).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-bold">
            <span className="text-gray-500">Kopā (iekļ. PVN 21%)</span>
            <span className="text-primary text-base">€{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
          <MapPin className="size-3.5 text-gray-400" /> Piegādes adrese *
        </label>
        <AddressAutocomplete
          value={address}
          onChange={onAddressChange}
          onSelect={(p: PlaceAddress) => onAddressChange(p.address + (p.city ? `, ${p.city}` : ''))}
          placeholder="Ielas nosaukums, mājas nr., pilsēta"
          required
        />
      </div>

      {/* Date */}
      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
          <CalendarDays className="size-3.5 text-gray-400" /> Vēlamais piegādes datums
        </label>
        <input
          type="date"
          value={deliveryDate}
          onChange={(e) => onDeliveryDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {/* Contact */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">Kontaktinformācija</p>
          {preFilledFromProfile && (
            <button
              type="button"
              onClick={() => setContactExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <UserCheck className="size-3" />
              No profila
              <ChevronDown
                className={`size-3 transition-transform ${contactExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
        {!contactExpanded && preFilledFromProfile ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 space-y-0.5">
            <p className="font-semibold">{contactName}</p>
            <p className="text-xs text-emerald-600">
              {contactEmail} · {contactPhone}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Vārds, uzvārds *"
                value={contactName}
                onChange={(e) => onContactChange('name', e.target.value)}
                className="rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <input
                type="tel"
                placeholder="Tālrunis *"
                value={contactPhone}
                onChange={(e) => onContactChange('phone', e.target.value)}
                className="rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <input
              type="email"
              placeholder="E-pasts *"
              value={contactEmail}
              onChange={(e) => onContactChange('email', e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <textarea
              rows={2}
              placeholder="Piezīmes (piekļuve, vārtejas kods...)"
              value={notes}
              onChange={(e) => onContactChange('notes', e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary resize-none"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-2xl border-2 border-gray-200 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Mainīt materiālus
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="flex-2 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {submitting ? 'Apstrādā...' : 'Pasūtīt'}
        </button>
      </div>
      <p className="text-xs text-center text-gray-400 -mt-2">
        Pasūtot jūs piekrītat B3Hub lietošanas noteikumiem
      </p>
    </div>
  );
}

// ── Inner wizard (needs useSearchParams → must be inside Suspense) ────────────

function MaterialsOrderWizard() {
  const searchParams = useSearchParams();
  const initialMaterialId = searchParams.get('materialId') ?? undefined;
  const { token, user } = useAuth();
  const router = useRouter();

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [quickMode] = useState(!!initialMaterialId); // single-pane checkout when coming from catalog
  const [confirmedOrder, setConfirmedOrder] = useState<ApiOrder | null>(null);
  const [confirmedItems, setConfirmedItems] = useState<SelectedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [contactPrefilled, setContactPrefilled] = useState(false);

  // Step 1 — What
  const [items, setItems] = useState<SelectedItem[]>([]);

  // Step 2 — Where
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postal, setPostal] = useState('');
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();

  // Step 3 — When
  const [deliveryDate, setDeliveryDate] = useState('');
  const [truckCount, setTruckCount] = useState(1);
  const [truckIntervalMinutes, setTruckIntervalMinutes] = useState(60);

  // Step 4 — Who
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  // ── Map refs ──────────────────────────────────────────────────────────────
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!token) router.push('/');
  }, [token, router]);

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

  // ── Map init ──────────────────────────────────────────────────────────────
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

  // ── Map pin update ────────────────────────────────────────────────────────
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
          fillColor: '#f59e0b',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
    }
    mapInstanceRef.current.panTo(position);
    mapInstanceRef.current.setZoom(16);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleAddressChange(
    addr: string,
    newLat?: number,
    newLng?: number,
    newCity?: string,
    newPostal?: string,
  ) {
    setAddress(addr);
    if (newCity) setCity(newCity);
    if (newPostal) setPostal(newPostal);
    if (newLat !== undefined && newLng !== undefined) {
      setLat(newLat);
      setLng(newLng);
      updateMapPin(newLat, newLng);
    }
  }

  async function handleSubmit() {
    if (!token) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createCartOrder(
        {
          deliveryAddress: address,
          deliveryCity: city || address.split(',').slice(-1)[0]?.trim() || '',
          deliveryPostal: postal || '',
          deliveryDate: deliveryDate || undefined,
          notes: notes || undefined,
          siteContactName: contactName,
          siteContactPhone: contactPhone,
          truckCount,
          truckIntervalMinutes: truckCount > 1 ? truckIntervalMinutes : undefined,
          items: items.map((i) => ({
            materialId: i.material.id,
            quantity: i.qty,
            unit: i.material.unit,
            unitPrice: i.material.basePrice,
          })),
        },
        token,
      );
      setConfirmedItems([...items]);
      setConfirmedOrder(result);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Kaut kas nogāja greizi. Lūdzu, mēģiniet vēlreiz.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setConfirmedOrder(null);
    setConfirmedItems([]);
    setStep(1);
    setItems([]);
    setAddress('');
    setCity('');
    setPostal('');
    setDeliveryDate('');
    setTruckCount(1);
    setTruckIntervalMinutes(60);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setNotes('');
    setSubmitError('');
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  if (confirmedOrder) {
    return (
      <MaterialsConfirmation order={confirmedOrder} items={confirmedItems} onReset={handleReset} />
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-100px)] w-full bg-background rounded-2xl overflow-hidden shadow-lg border flex flex-col-reverse lg:flex-row">
      {/* ── Left panel: wizard ── */}
      <div className="w-full lg:w-115 shrink-0 flex flex-col bg-background z-10 relative border-t lg:border-t-0 lg:border-r">
        {/* Header */}
        <div className="p-5 border-b bg-card space-y-3">
          <Link
            href="/dashboard/order"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Materiālu Pasūtījums</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Smiltis, grants, akmens un citi celtniecības materiāli
            </p>
          </div>
        </div>

        {/* Scrollable step area */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin flex flex-col space-y-6">
          {/* Step progress bar */}
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
                      className={`h-3.5 w-3.5 ${
                        done ? 'text-green-600' : active ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    <span
                      className={`text-xs font-semibold hidden sm:inline ${
                        done
                          ? 'text-green-700'
                          : active
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error banner (outside steps, for submit errors) */}
          {submitError && step < 4 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">Kļūda:</span> {submitError}
            </div>
          )}

          {/* ── Step content ── */}
          <div className="flex-1">
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <MatStep1What
                  initialMaterialId={initialMaterialId}
                  items={items}
                  onItemsChange={setItems}
                  onNext={() => setStep(2)}
                />
              </div>
            )}

            {/* Quick checkout — single pane for catalog deep-links */}
            {step > 1 && quickMode && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                <MaterialsQuickCheckout
                  items={items}
                  onItemsChange={setItems}
                  address={address}
                  onAddressChange={(v) => setAddress(v)}
                  deliveryDate={deliveryDate}
                  onDeliveryDateChange={setDeliveryDate}
                  contactName={contactName}
                  contactEmail={contactEmail}
                  contactPhone={contactPhone}
                  notes={notes}
                  onContactChange={(k, v) => {
                    if (k === 'name') setContactName(v);
                    else if (k === 'email') setContactEmail(v);
                    else if (k === 'phone') setContactPhone(v);
                    else if (k === 'notes') setNotes(v);
                  }}
                  preFilledFromProfile={contactPrefilled}
                  onSubmit={handleSubmit}
                  onBack={() => setStep(1)}
                  submitting={submitting}
                  error={submitError}
                />
              </div>
            )}

            {step === 2 && !quickMode && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                <Step2Address
                  value={address}
                  onAddressChange={handleAddressChange}
                  title="Kur piegādāt materiālus?"
                  subtitle="Ievadiet precīzu būvlaukuma adresi vai izmantojiet GPS"
                  nextLabel="Tālāk — izvēlēties datumu"
                  onNext={() => setStep(3)}
                  onBack={() => setStep(1)}
                />
              </div>
            )}

            {step === 3 && !quickMode && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                <MatStep3When
                  deliveryDate={deliveryDate}
                  onDateChange={setDeliveryDate}
                  truckCount={truckCount}
                  onTruckCountChange={setTruckCount}
                  truckIntervalMinutes={truckIntervalMinutes}
                  onTruckIntervalChange={setTruckIntervalMinutes}
                  onNext={() => setStep(4)}
                  onBack={() => setStep(2)}
                />
              </div>
            )}

            {step === 4 && !quickMode && (
              <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                <MatStep4Who
                  items={items}
                  address={address}
                  deliveryDate={deliveryDate}
                  name={contactName}
                  email={contactEmail}
                  phone={contactPhone}
                  notes={notes}
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

      {/* ── Right panel: map ── */}
      <div className="relative w-full h-75 lg:h-auto lg:flex-1 bg-muted/30">
        <div ref={mapDivRef} className="absolute inset-0" />
        {/* Floating overlays */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {address && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              <span className="truncate max-w-50">{address}</span>
            </div>
          )}
          {deliveryDate && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              {new Date(deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'long',
              })}
            </div>
          )}
          {items.length > 0 && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              {items.length} material{items.length === 1 ? 's' : 'i'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page export (Suspense boundary required for useSearchParams) ──────────────

export default function MaterialsOrderPage() {
  return (
    <Suspense>
      <MaterialsOrderWizard />
    </Suspense>
  );
}
