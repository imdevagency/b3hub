/**
 * Public order entry page — /order
 *
 * Airbnb pattern: show value first, gate only at commitment.
 *   1. Category grid  — pick material type (public, no login needed)
 *   2. Specs          — name / quantity / unit
 *   3. Where          — delivery address + live map
 *   4. When           — delivery date + truck scheduling
 *   5. Contact        — site contact name + phone
 *   6. Offers         — instant offers loaded publicly (token optional)
 *   → Auth gate fires only when guest tries to select offer or send RFQ
 *   → After login/register: action completes automatically
 *
 * Authenticated users are redirected to their dashboard immediately.
 */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createCartOrder,
  createQuoteRequest,
  getMaterialOffers,
  type MaterialCategory,
  type MaterialUnit,
  type SupplierOffer,
  type User,
} from '@/lib/api';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_MATERIAL_NAMES,
  UNIT_SHORT,
} from '@b3hub/shared';
import { WizardShell } from '@/components/order/WizardShell';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { Container } from '@/components/marketing/layout/Container';
import { MatStep3When } from '@/components/order/steps/MatStep3When';
import { WebWizardAuthGate } from '@/components/order/WebWizardAuthGate';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CalendarDays,
  CheckCircle2,
  Clock,
  Droplets,
  Hexagon,
  Layers,
  Leaf,
  Loader2,
  Map,
  MapPin,
  Minus,
  Mountain,
  MountainSnow,
  Package,
  Phone,
  Plus,
  ReceiptText,
  Recycle,
  Search,
  Send,
  Sprout,
  Star,
  Truck,
  User as UserIcon,
  Zap,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  MaterialCategory,
  {
    label: string;
    description: string;
    defaultUnit: MaterialUnit;
    defaultName: string;
    icon: React.ElementType;
  }
> = {
  SAND: {
    label: CATEGORY_LABELS.SAND,
    description: CATEGORY_DESCRIPTIONS.SAND,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.SAND,
    icon: Droplets,
  },
  GRAVEL: {
    label: CATEGORY_LABELS.GRAVEL,
    description: CATEGORY_DESCRIPTIONS.GRAVEL,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.GRAVEL,
    icon: Mountain,
  },
  STONE: {
    label: CATEGORY_LABELS.STONE,
    description: CATEGORY_DESCRIPTIONS.STONE,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.STONE,
    icon: MountainSnow,
  },
  CONCRETE: {
    label: CATEGORY_LABELS.CONCRETE,
    description: CATEGORY_DESCRIPTIONS.CONCRETE,
    defaultUnit: 'M3',
    defaultName: DEFAULT_MATERIAL_NAMES.CONCRETE,
    icon: Box,
  },
  SOIL: {
    label: CATEGORY_LABELS.SOIL,
    description: CATEGORY_DESCRIPTIONS.SOIL,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.SOIL,
    icon: Sprout,
  },
  RECYCLED_CONCRETE: {
    label: CATEGORY_LABELS.RECYCLED_CONCRETE,
    description: CATEGORY_DESCRIPTIONS.RECYCLED_CONCRETE,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.RECYCLED_CONCRETE,
    icon: Recycle,
  },
  RECYCLED_SOIL: {
    label: CATEGORY_LABELS.RECYCLED_SOIL,
    description: CATEGORY_DESCRIPTIONS.RECYCLED_SOIL,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.RECYCLED_SOIL,
    icon: Recycle,
  },
  ASPHALT: {
    label: CATEGORY_LABELS.ASPHALT,
    description: CATEGORY_DESCRIPTIONS.ASPHALT,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.ASPHALT,
    icon: Map,
  },
  CLAY: {
    label: CATEGORY_LABELS.CLAY,
    description: CATEGORY_DESCRIPTIONS.CLAY,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.CLAY,
    icon: Layers,
  },
  OTHER: {
    label: CATEGORY_LABELS.OTHER,
    description: CATEGORY_DESCRIPTIONS.OTHER,
    defaultUnit: 'TONNE',
    defaultName: DEFAULT_MATERIAL_NAMES.OTHER,
    icon: Hexagon,
  },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as MaterialCategory[];

const UNITS: MaterialUnit[] = ['TONNE', 'M3', 'PIECE', 'LOAD'];

const UNIT_LABEL: Record<MaterialUnit, string> = {
  TONNE: 'tonne',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krāvums',
};

// ── Types ──────────────────────────────────────────────────────────────────────

type WizardStep =
  | 'specs'
  | 'where'
  | 'when'
  | 'contact'
  | 'offers'
  | 'rfq-sent'
  | 'order-confirmed';

const STEP_INDEX: Record<WizardStep, number> = {
  specs: 0,
  where: 1,
  when: 2,
  contact: 3,
  offers: 4,
  'rfq-sent': 4,
  'order-confirmed': 4,
};

interface WizardState {
  category: MaterialCategory;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  address: string;
  city: string;
  postal: string;
  lat?: number;
  lng?: number;
  deliveryDate: string;
  deliveryWindow: 'ANY' | 'AM' | 'PM';
  asap: boolean;
  notes: string;
  truckCount: number;
  truckIntervalMinutes: number;
  siteContactName: string;
  siteContactPhone: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CategoryCard({ category, onClick }: { category: MaterialCategory; onClick: () => void }) {
  const meta = CATEGORY_META[category];
  const isRecycled = category.startsWith('RECYCLED');
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col text-left transition-transform active:scale-[0.98] w-full rounded-2xl border border-border/50 bg-card p-5 hover:border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors group-hover:bg-slate-100 group-hover:text-black">
        <meta.icon className="h-7 w-7" strokeWidth={1.5} />
      </div>
      {isRecycled && (
        <div className="absolute top-5 right-5 flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700">
          <Leaf className="size-3" strokeWidth={2.5} />
          <span>Recikl.</span>
        </div>
      )}
      <div className="mt-auto flex flex-col gap-1.5">
        <p className="font-semibold text-[16px] text-foreground tracking-tight transition-colors group-hover:text-black">
          {meta.label}
        </p>
        <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed">
          {meta.description}
        </p>
      </div>
    </button>
  );
}

function OfferCard({
  offer,
  unit,
  isCheapest,
  submitting,
  onSelect,
}: {
  offer: SupplierOffer;
  unit: MaterialUnit;
  isCheapest: boolean;
  submitting: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden hover:border-foreground/20 transition-colors">
      {offer.images && offer.images.length > 0 && (
        <div className="flex gap-1 p-2 pb-0">
          {offer.images.slice(0, 4).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={offer.name}
              className="h-20 w-20 object-cover rounded-xl border border-border/40 shrink-0"
            />
          ))}
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-[15px] text-foreground truncate">
                {offer.supplier.name}
              </p>
              {isCheapest && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
                  <Star className="size-3" /> Labākais
                </span>
              )}
              {offer.stockQty != null && offer.stockQty < 10 && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  <AlertTriangle className="size-3" /> Maz krājumu
                </span>
              )}
            </div>
            {offer.supplier.rating != null && (
              <div className="flex items-center gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`size-3 ${
                      n <= Math.round(offer.supplier.rating!)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-muted-foreground/30 fill-muted-foreground/10'
                    }`}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-0.5">
                  {offer.supplier.rating.toFixed(1)}
                  {offer.totalOrders > 0 && ` · ${offer.totalOrders} pasūtījumi`}
                </span>
              </div>
            )}
            {offer.supplier.city && (
              <p className="text-sm text-muted-foreground mt-0.5">{offer.supplier.city}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-foreground">€{offer.totalPrice.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              €{offer.basePrice.toFixed(2)} / {UNIT_SHORT[unit]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {offer.distanceKm !== null && (
            <div className="flex items-center gap-1">
              <Truck className="size-3.5" />
              <span>{offer.distanceKm.toFixed(0)} km</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="size-3.5" />
            <span>{offer.etaDays} d.</span>
          </div>
          {offer.isInstant && (
            <div className="flex items-center gap-1">
              <Zap className="size-3.5 text-amber-500" />
              <span className="text-amber-600 font-medium">Tūlītējs</span>
            </div>
          )}
          {offer.completionRate != null && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-green-500" />
              <span className="text-green-700 font-medium">{offer.completionRate}% izpilde</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-4">
        <Button
          onClick={onSelect}
          disabled={submitting}
          className="w-full rounded-xl h-11 font-bold"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              Izvēlēties šo piedāvājumu <ArrowRight className="size-4 ml-1.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function RFQPanel({
  compact = false,
  submitting,
  error,
  onSend,
}: {
  compact?: boolean;
  submitting: boolean;
  error: string;
  onSend: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 space-y-4">
      {!compact && (
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <Send className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-foreground">Nosūtīt cenu pieprasījumu</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Jūsu pieprasījums tiks nosūtīts visiem atbilstošajiem piegādātājiem jūsu rajonā. Viņi
              atbildēs ar savām cenām, un jūs izvēlēsieties labāko.
            </p>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
      <Button
        onClick={onSend}
        disabled={submitting}
        variant={compact ? 'outline' : 'default'}
        className={`w-full rounded-2xl font-bold ${compact ? 'h-11' : 'h-12'}`}
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            <Send className="size-4 mr-1.5" />
            {compact ? 'Pieprasīt vairāk piedāvājumu' : 'Nosūtīt pieprasījumu piegādātājiem'}
          </>
        )}
      </Button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OrderPage() {
  const { user, token, setAuth, isLoading } = useAuth();
  const router = useRouter();

  // ── Wizard state ────────────────────────────────────────────────────────────

  const [activeCategory, setActiveCategory] = useState<MaterialCategory | null>(null);
  const [step, setStep] = useState<WizardStep>('specs');
  const [form, setForm] = useState<WizardState>({
    category: 'GRAVEL',
    materialName: DEFAULT_MATERIAL_NAMES.GRAVEL,
    quantity: 5,
    unit: 'TONNE',
    address: '',
    city: '',
    postal: '',
    deliveryDate: '',
    deliveryWindow: 'ANY',
    asap: false,
    notes: '',
    truckCount: 1,
    truckIntervalMinutes: 30,
    siteContactName: '',
    siteContactPhone: '',
  });

  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');

  // Search / filter
  const [search, setSearch] = useState('');

  // Auth gate
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<((tok: string) => Promise<void>) | null>(null);

  function patch(updates: Partial<WizardState>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  function openCategory(category: MaterialCategory) {
    const meta = CATEGORY_META[category];
    setActiveCategory(category);
    setStep('specs');
    setForm({
      category,
      materialName: meta.defaultName,
      quantity: 5,
      unit: meta.defaultUnit,
      address: '',
      city: '',
      postal: '',
      deliveryDate: '',
      deliveryWindow: 'ANY',
      asap: false,
      notes: '',
      truckCount: 1,
      truckIntervalMinutes: 30,
      siteContactName: '',
      siteContactPhone: '',
    });
    setOffers([]);
    setOffersError('');
    setSubmitError('');
    setOrderNumber('');
    setRfqNumber('');
  }

  function handleAddressChange(
    addr: string,
    lat?: number,
    lng?: number,
    city?: string,
    postal?: string,
  ) {
    patch({ address: addr, city: city ?? form.city, postal: postal ?? form.postal, lat, lng });
    if (lat && lng) updateMapPin(lat, lng);
  }

  async function goToOffers() {
    setStep('offers');
    setOffersLoading(true);
    setOffersError('');
    try {
      const results = await getMaterialOffers(token, {
        category: form.category,
        quantity: form.quantity,
        lat: form.lat,
        lng: form.lng,
      });
      setOffers(results);
    } catch {
      setOffersError('Neizdevās ielādēt piedāvājumus. Jūs joprojām varat nosūtīt pieprasījumu.');
      setOffers([]);
    } finally {
      setOffersLoading(false);
    }
  }

  // Run an action requiring auth. If token exists, run immediately.
  // Otherwise save as pending and open the auth gate.
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

  async function execSelectOffer(offer: SupplierOffer, tok: string) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createCartOrder(
        {
          deliveryAddress: form.address,
          deliveryCity: form.city || form.address.split(',').slice(-1)[0]?.trim() || '',
          deliveryPostal: form.postal,
          deliveryDate: form.asap ? undefined : form.deliveryDate || undefined,
          deliveryWindow: form.asap
            ? undefined
            : form.deliveryWindow !== 'ANY'
              ? form.deliveryWindow
              : undefined,
          notes: form.notes || undefined,
          siteContactName: form.siteContactName || undefined,
          siteContactPhone: form.siteContactPhone || undefined,
          items: [
            {
              materialId: offer.id,
              quantity: form.quantity,
              unit: form.unit,
              unitPrice: offer.basePrice,
            },
          ],
        },
        tok,
      );
      setOrderNumber(result.orderNumber);
      setStep('order-confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function execSendRFQ(tok: string) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const noteParts: string[] = [];
      if (form.deliveryDate) {
        const formatted = new Date(form.deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        noteParts.push(`Vēlamais piegādes datums: ${formatted}`);
      }
      if (form.truckCount > 1) {
        noteParts.push(
          `Nepieciešami ${form.truckCount} transportlīdzekļi` +
            (form.truckIntervalMinutes ? `, intervāls ${form.truckIntervalMinutes} min` : ''),
        );
      }
      if (form.notes) noteParts.push(form.notes);
      const result = await createQuoteRequest(
        {
          materialCategory: form.category,
          materialName: form.materialName,
          quantity: form.quantity,
          unit: form.unit,
          deliveryAddress: form.address,
          deliveryCity: form.city || form.address.split(',').slice(-1)[0]?.trim() || '',
          deliveryLat: form.lat,
          deliveryLng: form.lng,
          notes: noteParts.length > 0 ? noteParts.join('\n') : undefined,
        },
        tok,
      );
      setRfqNumber(result.requestNumber);
      setStep('rfq-sent');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Google Map ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!activeCategory) return;
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
            map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            map.setZoom(14);
          },
          () => {},
          { timeout: 8000 },
        );
      }
    });
  }, [activeCategory]);

  // reset map instance when wizard closes so it re-inits fresh
  useEffect(() => {
    if (!activeCategory) {
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [activeCategory]);

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

  if (isLoading) return null;

  const meta = activeCategory ? CATEGORY_META[activeCategory] : null;

  const filteredCategories = ALL_CATEGORIES.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const m = CATEGORY_META[c];
    return (
      m.label.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.defaultName.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="relative min-h-screen bg-background">
        {/* Category grid — shown when no wizard is active */}
        {!activeCategory && (
          <div className="w-full max-w-6xl mx-auto px-4 py-12 md:py-20">
            {/* Header row */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div className="max-w-xl">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground leading-tight">
                  Ko jums nepieciešams?
                </h1>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  Izvēlieties materiāla veidu — jūs saņemsiet cenas no tuvākajiem piegādātājiem
                </p>
              </div>
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Meklēt..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 bg-muted/40 border-0 h-14 rounded-[1.5rem] text-[16px] font-medium focus-visible:ring-2 focus-visible:ring-foreground/20 transition-all w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-6">
              {filteredCategories.map((cat) => (
                <CategoryCard key={cat} category={cat} onClick={() => openCategory(cat)} />
              ))}
              {filteredCategories.length === 0 && (
                <div className="col-span-full py-20 text-center font-medium text-lg text-muted-foreground">
                  Nav atrasta neviena kategorija
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wizard panel */}
        {activeCategory && meta && (
          <Container className="pt-32 pb-24 flex max-lg:flex-col items-start gap-10 lg:gap-20">
            {/* ── Left: Wizard panel ─────────────────────────────────── */}
            <div className="flex flex-col w-full lg:w-110 xl:w-120 shrink-0 bg-background rounded-2xl shadow-xl border border-border/40 overflow-hidden">
              <WizardShell
                className="w-full h-auto"
                step={STEP_INDEX[step] + 1}
                totalSteps={5}
                title={
                  step === 'rfq-sent'
                    ? 'Pieprasījums nosūtīts'
                    : step === 'order-confirmed'
                      ? 'Pasūtījums pieņemts'
                      : meta.label
                }
                onBack={
                  STEP_INDEX[step] > 0 && step !== 'order-confirmed' && step !== 'rfq-sent'
                    ? () => setStep(Object.keys(STEP_INDEX)[STEP_INDEX[step] - 1] as WizardStep)
                    : undefined
                }
                onClose={() => setActiveCategory(null)}
              >
                {/* Order summary pill */}
                {step !== 'rfq-sent' && step !== 'order-confirmed' && (
                  <div className="mb-6 rounded-2xl bg-gray-100 p-4">
                    <div className="flex items-center gap-3">
                      <Package className="size-5 text-gray-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold truncate text-black">
                          {form.materialName || meta.label}
                        </p>
                        <p className="text-sm font-medium text-gray-500 truncate">
                          {form.quantity} {UNIT_SHORT[form.unit]}
                        </p>
                      </div>
                      {offers.length > 0 && step === 'offers' && (
                        <span className="font-bold text-lg text-primary shrink-0">
                          no €
                          {[...offers].sort((a, b) => a.totalPrice - b.totalPrice)[0].totalPrice}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 1: Specs */}
                {step === 'specs' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div>
                      <p className="text-xl font-bold text-foreground">Ko jums nepieciešams?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Aprakstiet materiālu un norādiet nepieciešamo daudzumu
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Kategorija</label>
                        <Select
                          value={form.category}
                          onValueChange={(val) => {
                            const m = CATEGORY_META[val as MaterialCategory];
                            patch({
                              category: val as MaterialCategory,
                              materialName: m.defaultName,
                              unit: m.defaultUnit,
                            });
                          }}
                        >
                          <SelectTrigger className="w-full rounded-2xl h-13 bg-muted/40 border-0 px-4 text-[15px] font-medium focus:ring-2 focus:ring-foreground/10 transition-shadow data-[state=open]:bg-muted/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {ALL_CATEGORIES.map((c) => {
                              const cMeta = CATEGORY_META[c];
                              return (
                                <SelectItem
                                  key={c}
                                  value={c}
                                  className="rounded-lg py-3 cursor-pointer"
                                >
                                  <span className="font-medium">{cMeta.label}</span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">
                          Frakcija / Precizējums
                        </label>
                        <input
                          type="text"
                          value={form.materialName}
                          onChange={(e) => patch({ materialName: e.target.value })}
                          placeholder={meta.defaultName || 'Piem., 16-32 mm'}
                          className="w-full rounded-2xl border-0 bg-muted/40 px-4 h-13 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-shadow"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Daudzums</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            patch({
                              quantity: Math.max(
                                0.5,
                                parseFloat(
                                  (form.quantity - (form.unit === 'PIECE' ? 1 : 0.5)).toFixed(2),
                                ),
                              ),
                            })
                          }
                          className="flex shrink-0 items-center justify-center rounded-2xl w-14 h-14 bg-muted/40 hover:bg-muted/70 transition-colors text-foreground"
                        >
                          <Minus className="size-5" />
                        </button>
                        <input
                          type="number"
                          value={form.quantity}
                          min={0.5}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) patch({ quantity: v });
                          }}
                          className="flex-1 min-w-0 text-center bg-transparent border-0 px-2 py-2 text-4xl font-bold tracking-tighter focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() =>
                            patch({
                              quantity: parseFloat(
                                (form.quantity + (form.unit === 'PIECE' ? 1 : 0.5)).toFixed(2),
                              ),
                            })
                          }
                          className="flex shrink-0 items-center justify-center rounded-2xl w-14 h-14 bg-muted/40 hover:bg-muted/70 transition-colors text-foreground"
                        >
                          <Plus className="size-5" />
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap mt-3">
                        {UNITS.map((u) => (
                          <button
                            key={u}
                            onClick={() => patch({ unit: u })}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                              form.unit === u
                                ? 'bg-foreground text-background'
                                : 'bg-muted/50 text-foreground hover:bg-muted/80'
                            }`}
                          >
                            {UNIT_LABEL[u]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">
                        Papildu prasības{' '}
                        <span className="text-muted-foreground font-normal">(neobligāti)</span>
                      </label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => patch({ notes: e.target.value })}
                        placeholder="piem. frakcionēts 0-16, sasmalcināts, nesasaldēts..."
                        rows={3}
                        className="w-full rounded-2xl border-0 bg-muted/40 px-4 py-3 text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-shadow resize-none"
                      />
                    </div>
                    <Button
                      onClick={() => setStep('where')}
                      disabled={!form.materialName.trim() || form.quantity <= 0}
                      className="w-full rounded-2xl h-12 text-[15px] font-bold"
                    >
                      Tālāk — piegādes adrese <ArrowRight className="size-4 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Step 2: Where */}
                {step === 'where' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                    <Step2Address
                      value={form.address}
                      onAddressChange={handleAddressChange}
                      title="Kur piegādāt materiālus?"
                      subtitle="Ievadiet precīzu būvlaukuma adresi vai izmantojiet GPS"
                      nextLabel="Tālāk — izvēlēties datumu"
                      onNext={() => setStep('when')}
                      onBack={() => setStep('specs')}
                    />
                  </div>
                )}

                {/* Step 3: When */}
                {step === 'when' && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 pb-6">
                    <MatStep3When
                      deliveryDate={form.deliveryDate}
                      onDateChange={(d) => patch({ deliveryDate: d })}
                      deliveryWindow={form.deliveryWindow}
                      onDeliveryWindowChange={(w) => patch({ deliveryWindow: w })}
                      asap={form.asap}
                      onAsapChange={(v) =>
                        patch({ asap: v, deliveryDate: v ? '' : form.deliveryDate })
                      }
                      truckCount={form.truckCount}
                      onTruckCountChange={(n) => patch({ truckCount: n })}
                      truckIntervalMinutes={form.truckIntervalMinutes}
                      onTruckIntervalChange={(n) => patch({ truckIntervalMinutes: n })}
                      onNext={() => setStep('contact')}
                      onBack={() => setStep('where')}
                    />
                  </div>
                )}

                {/* Step 4: Contact */}
                {step === 'contact' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                    <div>
                      <h2 className="text-lg font-bold">Objekta kontaktpersona</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Šoferis ar šo personu sazināsies piegādes dienā
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                          <UserIcon className="size-3.5" /> Vārds, uzvārds
                        </label>
                        <Input
                          type="text"
                          placeholder="Jānis Bērziņš"
                          value={form.siteContactName}
                          onChange={(e) => patch({ siteContactName: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                          <Phone className="size-3.5" /> Tālrunis
                        </label>
                        <Input
                          type="tel"
                          placeholder="+371 20 000 000"
                          value={form.siteContactPhone}
                          onChange={(e) => patch({ siteContactPhone: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-foreground mb-1.5 block">
                          Papildus piezīmes (neobligāti)
                        </label>
                        <textarea
                          placeholder="Piekļuves kodi, instrukcijas šoferim..."
                          value={form.notes}
                          onChange={(e) => patch({ notes: e.target.value })}
                          rows={2}
                          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => setStep('when')}
                        className="flex-1 rounded-xl border py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Atpakaļ
                      </button>
                      <button
                        onClick={goToOffers}
                        className="flex-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
                      >
                        Skatīt piedāvājumus
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 5: Offers */}
                {step === 'offers' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                    {offersLoading ? (
                      <div className="py-20 flex flex-col items-center gap-3">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Meklējam pieejamos piegādātājus...
                        </p>
                      </div>
                    ) : offersError || offers.length === 0 ? (
                      <div className="space-y-4">
                        {offersError ? (
                          <p className="text-sm text-destructive font-medium">{offersError}</p>
                        ) : (
                          <div>
                            <p className="text-xl font-bold text-foreground">
                              Nav tūlītēju piedāvājumu
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
                            </p>
                          </div>
                        )}
                        <RFQPanel
                          submitting={submitting}
                          error={submitError}
                          onSend={() => requireAuth((tok) => execSendRFQ(tok))}
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <p className="text-xl font-bold text-foreground">
                            {offers.length} piedāvājum{offers.length === 1 ? 's' : 'i'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Sakārtoti pēc cenas — lētākais pirmais
                          </p>
                        </div>
                        {submitError && (
                          <p className="text-sm text-destructive font-medium">{submitError}</p>
                        )}
                        {[...offers]
                          .sort((a, b) => a.totalPrice - b.totalPrice)
                          .map((offer, idx) => (
                            <OfferCard
                              key={offer.id}
                              offer={offer}
                              unit={form.unit}
                              isCheapest={idx === 0}
                              submitting={submitting}
                              onSelect={() => requireAuth((tok) => execSelectOffer(offer, tok))}
                            />
                          ))}
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-sm text-muted-foreground mb-3">
                            Vēlaties saņemt vairāk piedāvājumu?
                          </p>
                          <RFQPanel
                            compact
                            submitting={submitting}
                            error=""
                            onSend={() => requireAuth((tok) => execSendRFQ(tok))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* RFQ sent */}
                {step === 'rfq-sent' && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
                    <div className="flex size-20 items-center justify-center rounded-full bg-blue-50">
                      <Send className="size-9 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">Pieprasījums nosūtīts!</p>
                      <p className="text-base text-muted-foreground font-medium mt-1">
                        Nr. <span className="font-bold text-foreground">{rfqNumber}</span>
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Piegādātāji jūsu rajonā saņēma paziņojumu. Kad kāds atbildēs ar cenu, jūs
                      saņemsiet paziņojumu.
                    </p>
                    <div className="w-full space-y-3 pt-2">
                      <Button
                        onClick={() => router.push('/dashboard/quote-requests')}
                        className="w-full rounded-2xl h-12 font-bold"
                      >
                        <ReceiptText className="size-4 mr-1.5" /> Skatīt pieprasījumus
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveCategory(null)}
                        className="w-full rounded-2xl h-12 font-semibold"
                      >
                        Turpināt iepirkties
                      </Button>
                    </div>
                  </div>
                )}

                {/* Order confirmed */}
                {step === 'order-confirmed' && (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 animate-in zoom-in-95">
                    <div className="flex size-20 items-center justify-center rounded-full bg-foreground">
                      <CheckCircle2 className="size-9 text-background" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">Pasūtījums veikts!</p>
                      <p className="text-base text-muted-foreground font-medium mt-1">
                        Nr. <span className="font-bold text-foreground">{orderNumber}</span>
                      </p>
                    </div>
                    <div className="w-full rounded-2xl bg-muted/40 divide-y divide-border/50 text-[15px]">
                      <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
                        <Package className="size-4 shrink-0 text-foreground" />
                        <span>
                          {form.quantity} {UNIT_SHORT[form.unit]} {form.materialName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
                        <MapPin className="size-4 shrink-0 text-foreground" />
                        <span className="truncate">{form.address}</span>
                      </div>
                      {form.deliveryDate && (
                        <div className="flex items-center gap-3 px-5 py-4 text-muted-foreground">
                          <CalendarDays className="size-4 shrink-0 text-foreground" />
                          <span>
                            {new Date(form.deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="w-full space-y-3">
                      <Button
                        onClick={() => router.push('/dashboard/orders')}
                        className="w-full rounded-2xl h-12 font-bold"
                      >
                        <ReceiptText className="size-4 mr-1.5" /> Skatīt pasūtījumus
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setActiveCategory(null)}
                        className="w-full rounded-2xl h-12 font-semibold"
                      >
                        Turpināt iepirkties
                      </Button>
                    </div>
                  </div>
                )}
              </WizardShell>
            </div>

            {/* ── Right: Contextual panel (lg+) ──────────────────────── */}
            <div className="hidden lg:flex flex-1 relative items-center justify-center p-10 h-[600px] sticky top-28 rounded-3xl overflow-hidden ring-1 ring-border/40 shadow-xl bg-muted/10">
              {/* Map background */}
              <div className="absolute inset-0 bg-[#e5e3df]">
                <div ref={mapDivRef} className="absolute inset-0" />
                <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                  {form.address && (
                    <div className="bg-background/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-border/50 text-sm font-bold text-foreground flex items-center gap-2">
                      <MapPin className="size-4" />
                      <span className="truncate max-w-50">{form.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Container>
        )}
      </div>

      {/* Auth gate — fires only when guest tries to commit */}
      <WebWizardAuthGate
        open={authGateOpen}
        onAuthenticated={handleAuthSuccess}
        onDismiss={() => {
          setAuthGateOpen(false);
          setPendingAction(null);
        }}
      />
    </>
  );
}
