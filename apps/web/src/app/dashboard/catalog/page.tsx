/**
 * Materials catalog — /dashboard/catalog
 *
 * Demand-first flow (Schüttflix-style):
 *   1. Browse material categories  (static grid, no supplier info)
 *   2. Specs  — name / quantity / unit
 *   3. Where  — delivery address + map
 *   4. When   — delivery date
 *   5. Offers — instant offers from nearby suppliers OR send RFQ
 *   6. Success
 *
 * Buyers specify what they need; suppliers see the demand and compete on price.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { loadGoogleMapsScript } from '@/components/ui/AddressAutocomplete';
import {
  createCartOrder,
  createQuoteRequest,
  getMaterialOffers,
  type MaterialCategory,
  type MaterialUnit,
  type SupplierOffer,
} from '@/lib/api';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Leaf,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Star,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Step2Address } from '@/components/order/steps/Step2Address';
import { MatStep3When } from '@/components/order/steps/MatStep3When';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  MaterialCategory,
  { label: string; description: string; defaultUnit: MaterialUnit; defaultName: string; image: string }
> = {
  SAND: {
    label: 'Smiltis',
    description: 'Uzbēruma, celtnieku un filtrācijas smiltis',
    defaultUnit: 'TONNE',
    defaultName: 'Uzbēruma smiltis',
    image: 'https://images.unsplash.com/photo-1621644784423-d2dcf35198e3?q=80&w=600&auto=format&fit=crop',
  },
  GRAVEL: {
    label: 'Grants',
    description: 'Ceļu grants, drenāžas grants, šķembas',
    defaultUnit: 'TONNE',
    defaultName: 'Ceļu grants',
    image: 'https://images.unsplash.com/photo-1541624602-5ee3f3127599?q=80&w=600&auto=format&fit=crop',
  },
  STONE: {
    label: 'Akmens',
    description: 'Drupināts akmens, bruģakmens, laukakmens',
    defaultUnit: 'TONNE',
    defaultName: 'Drupināts akmens',
    image: 'https://images.unsplash.com/photo-1518709268805-4e904baf370d?q=80&w=600&auto=format&fit=crop',
  },
  CONCRETE: {
    label: 'Betons',
    description: 'Gatavs betona maisījums, betona bloki',
    defaultUnit: 'M3',
    defaultName: 'Gatavs betons',
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=600&auto=format&fit=crop',
  },
  SOIL: {
    label: 'Augsne',
    description: 'Tīrā augsne, melnzeme, dārza zeme',
    defaultUnit: 'TONNE',
    defaultName: 'Augsne uzbēršanai',
    image: 'https://images.unsplash.com/photo-1581454536647-79282b0e6df2?q=80&w=600&auto=format&fit=crop',
  },
  RECYCLED_CONCRETE: {
    label: 'Recikl. Betons',
    description: 'Sasmalcināts betons no nojaukšanas darbiem',
    defaultUnit: 'TONNE',
    defaultName: 'Reciklēts betons',
    image: 'https://images.unsplash.com/photo-1602741548650-620ee80206f3?q=80&w=600&auto=format&fit=crop',
  },
  RECYCLED_SOIL: {
    label: 'Recikl. Augsne',
    description: 'Pārstrādāta augsne celtniecības vajadzībām',
    defaultUnit: 'TONNE',
    defaultName: 'Reciklēta augsne',
    image: 'https://images.unsplash.com/photo-1589139599557-6101c56ceeed?q=80&w=600&auto=format&fit=crop',
  },
  ASPHALT: {
    label: 'Asfalts',
    description: 'Asfalts ceļiem un stāvvietām',
    defaultUnit: 'TONNE',
    defaultName: 'Asfalta maisījums',
    image: 'https://images.unsplash.com/photo-1627911677322-83b6f0e27f12?q=80&w=600&auto=format&fit=crop',
  },
  CLAY: {
    label: 'Māls',
    description: 'Māls hidroizolācijai un uzbērumiem',
    defaultUnit: 'TONNE',
    defaultName: 'Māls',
    image: 'https://images.unsplash.com/photo-1616886616016-1f7c0a6b8c9d?q=80&w=600&auto=format&fit=crop',
  },
  OTHER: {
    label: 'Citi',
    description: 'Citi celtniecības pieprasījumi',
    defaultUnit: 'TONNE',
    defaultName: '',
    image: 'https://images.unsplash.com/photo-1541888086925-eb26bc361664?q=80&w=600&auto=format&fit=crop',
  },
};

const UNIT_LABEL: Record<MaterialUnit, string> = {
  TONNE: 'tonne',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krāvums',
};

const UNIT_SHORT: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krv.',
};

const UNITS: MaterialUnit[] = ['TONNE', 'M3', 'PIECE', 'LOAD'];

const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

const WIZARD_STEPS = [
  { label: 'Materiāls', icon: Package },
  { label: 'Kur', icon: MapPin },
  { label: 'Kad', icon: CalendarDays },
  { label: 'Piedāvājumi', icon: Zap },
];

// ── Category card ──────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  onClick,
}: {
  category: MaterialCategory;
  onClick: () => void;
}) {
  const meta = CATEGORY_META[category];
  const isRecycled = category.startsWith('RECYCLED');

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col text-left transition-transform active:scale-[0.98] w-full"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={meta.image} 
          alt={meta.label}
          className="h-full w-full object-cover transition-transform duration-500 will-change-transform ease-out group-hover:scale-105"
        />
        {isRecycled && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded bg-background/90 backdrop-blur-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-green-700 shadow-sm">
            <Leaf className="size-3" /> Recikl.
          </div>
        )}
      </div>
      
      <div className="mt-3 flex flex-col gap-0.5 px-0.5">
        <p className="font-semibold text-[15px] sm:text-base text-foreground tracking-tight">{meta.label}</p>
        <p className="text-[13px] text-muted-foreground line-clamp-1">{meta.description}</p>
      </div>
    </button>
  );
}

// ── Wizard overlay ─────────────────────────────────────────────────────────────

type WizardStep = 'specs' | 'where' | 'when' | 'offers' | 'rfq-sent' | 'order-confirmed';

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
  notes: string;
}

function WizardInline({
  initialCategory,
  token,
  onClose,
}: {
  initialCategory: MaterialCategory;
  token: string;
  onClose: () => void;
}) {
  const meta = CATEGORY_META[initialCategory];
  const stepIndex: Record<WizardStep, number> = {
    specs: 0,
    where: 1,
    when: 2,
    offers: 3,
    'rfq-sent': 3,
    'order-confirmed': 3,
  };

  const [step, setStep] = useState<WizardStep>('specs');
  const [form, setForm] = useState<WizardState>({
    category: initialCategory,
    materialName: meta.defaultName,
    quantity: 5,
    unit: meta.defaultUnit,
    address: '',
    city: '',
    postal: '',
    deliveryDate: '',
    notes: '',
  });

  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersError, setOffersError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [rfqNumber, setRfqNumber] = useState('');

  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

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
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d9e8' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });
      mapInstanceRef.current = map;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.panTo(p);
            map.setZoom(14);
          },
          () => {},
          { timeout: 8000 },
        );
      }
    });
  }, []);

  const updateMapPin = useCallback((lat: number, lng: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google || !mapInstanceRef.current) return;
    const position = { lat, lng };
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

  function patch(updates: Partial<WizardState>) {
    setForm((f) => ({ ...f, ...updates }));
  }

  function handleAddressChange(
    addr: string,
    lat?: number,
    lng?: number,
    city?: string,
    postal?: string,
  ) {
    patch({ address: addr, city: city ?? form.city, postal: postal ?? form.postal, lat, lng });
    if (lat !== undefined && lng !== undefined) updateMapPin(lat, lng);
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

  async function handleSelectOffer(offer: SupplierOffer) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await createCartOrder(
        {
          deliveryAddress: form.address,
          deliveryCity: form.city || form.address.split(',').slice(-1)[0]?.trim() || '',
          deliveryPostal: form.postal,
          deliveryDate: form.deliveryDate || undefined,
          notes: form.notes || undefined,
          siteContactName: '',
          siteContactPhone: '',
          items: [
            {
              materialId: offer.id,
              quantity: form.quantity,
              unit: form.unit,
              unitPrice: offer.basePrice,
            },
          ],
        },
        token,
      );
      setOrderNumber(result.orderNumber);
      setStep('order-confirmed');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendRFQ() {
    setSubmitting(true);
    setSubmitError('');
    try {
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
          notes: form.notes || undefined,
        },
        token,
      );
      setRfqNumber(result.requestNumber);
      setStep('rfq-sent');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kaut kas nogāja greizi.');
    } finally {
      setSubmitting(false);
    }
  }

  const currentStepIndex = stepIndex[step];

  return (
    <div className="flex flex-col lg:flex-row bg-background border sm:rounded-[24px] shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300 xl:h-[750px] min-h-[600px] mb-12">
      {/* Left panel */}
      <div className="w-full lg:w-[460px] shrink-0 flex flex-col bg-background border-t lg:border-t-0 lg:border-r border-border/50 z-10">
        {/* Header */}
        <div className="p-5 border-b border-border/50 bg-background space-y-4">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Atpakaļ uz katalogu
          </button>
          <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-4 py-3">
            <Package className="size-5 text-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold truncate text-foreground">
                {form.materialName || CATEGORY_META[form.category].label}
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                {CATEGORY_META[form.category].label} · {form.quantity} {UNIT_SHORT[form.unit]}
              </p>
            </div>
          </div>
          {step !== 'order-confirmed' && step !== 'rfq-sent' && (
            <div className="flex gap-2 w-full">
              {WIZARD_STEPS.map((s, i) => {
                const done = currentStepIndex > i;
                const active = currentStepIndex === i;
                return (
                  <div key={i} className="flex-1 flex flex-col gap-1.5">
                    <div
                      className={`h-1.5 w-full rounded-full transition-all ${
                        done || active ? 'bg-foreground' : 'bg-muted/60'
                      }`}
                    />
                    <div className="flex items-center gap-1">
                      <s.icon
                        className={`h-3.5 w-3.5 ${
                          done || active ? 'text-foreground' : 'text-muted-foreground/40'
                        }`}
                      />
                      <span
                        className={`text-[12px] font-bold hidden sm:inline ${
                          done || active ? 'text-foreground' : 'text-muted-foreground/40'
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5">
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
                        unit: m.defaultUnit as MaterialUnit,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full rounded-2xl h-[52px] bg-muted/40 border-0 px-4 text-[15px] font-medium focus:ring-2 focus:ring-foreground/10 transition-shadow data-[state=open]:bg-muted/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ALL_CATEGORIES.map((c) => {
                        const cMeta = CATEGORY_META[c];
                        return (
                          <SelectItem key={c} value={c} className="rounded-lg py-3 cursor-pointer">
                            <span className="font-medium">{cMeta.label}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Frakcija / Precizējums</label>
                  <input
                    type="text"
                    value={form.materialName}
                    onChange={(e) => patch({ materialName: e.target.value })}
                    placeholder={meta.defaultName || "Piem., 16-32 mm"}
                    className="w-full rounded-2xl border-0 bg-muted/40 px-4 h-[52px] text-[15px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-shadow"
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
                          parseFloat((form.quantity - (form.unit === 'PIECE' ? 1 : 0.5)).toFixed(2)),
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
                onNext={goToOffers}
                onBack={() => setStep('where')}
              />
            </div>
          )}

          {/* Step 4: Offers */}
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
                      <p className="text-xl font-bold text-foreground">Nav tūlītēju piedāvājumu</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Nosūtiet pieprasījumu — piegādātāji atbildēs ar savām cenām.
                      </p>
                    </div>
                  )}
                  <RFQPanel submitting={submitting} error={submitError} onSend={handleSendRFQ} />
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
                        onSelect={() => handleSelectOffer(offer)}
                      />
                    ))}
                  <div className="pt-2 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-3">
                      Vēlaties saņemt vairāk piedāvājumu?
                    </p>
                    <RFQPanel compact submitting={submitting} error="" onSend={handleSendRFQ} />
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
                  onClick={() => (window.location.href = '/dashboard/quotes')}
                  className="w-full rounded-2xl h-12 font-bold"
                >
                  <ReceiptText className="size-4 mr-1.5" /> Skatīt pieprasījumus
                </Button>
                <Button variant="outline" onClick={onClose} className="w-full rounded-2xl h-12 font-semibold">
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
                  <span>{form.quantity} {UNIT_SHORT[form.unit]} {form.materialName}</span>
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
                  onClick={() => (window.location.href = '/dashboard/orders')}
                  className="w-full rounded-2xl h-12 font-bold"
                >
                  <ReceiptText className="size-4 mr-1.5" /> Skatīt pasūtījumus
                </Button>
                <Button variant="outline" onClick={onClose} className="w-full rounded-2xl h-12 font-semibold">
                  Turpināt iepirkties
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: map */}
      <div className="relative w-full h-72 lg:h-auto lg:flex-1 bg-muted/30">
        <div ref={mapDivRef} className="absolute inset-0" />
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          {form.address && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-500" />
              <span className="truncate max-w-52">{form.address}</span>
            </div>
          )}
          {form.deliveryDate && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              {new Date(form.deliveryDate + 'T00:00:00').toLocaleDateString('lv-LV', {
                day: 'numeric',
                month: 'long',
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Offer card ─────────────────────────────────────────────────────────────────

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
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-[15px] text-foreground truncate">{offer.supplier.name}</p>
              {isCheapest && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
                  <Star className="size-3" /> Labākais
                </span>
              )}
            </div>
            {offer.supplier.city && (
              <p className="text-sm text-muted-foreground">{offer.supplier.city}</p>
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
          <div className="flex items-center gap-1">
            <Zap className="size-3.5 text-amber-500" />
            <span className="text-amber-600 font-medium">Tūlītējs</span>
          </div>
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
            <>Izvēlēties šo piedāvājumu <ArrowRight className="size-4 ml-1.5" /></>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── RFQ panel ─────────────────────────────────────────────────────────────────

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
              Jūsu pieprasījums tiks nosūtīts visiem atbilstošajiem piegādātājiem jūsu rajonā.
              Viņi atbildēs ar savām cenām, un jūs izvēlēsieties labāko.
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

// ── Page ───────────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as MaterialCategory[];

export default function CatalogPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | null>(null);

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
  }, [token, isLoading, router]);

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

  if (activeCategory && token) {
    return (
      <div className="pb-12 max-w-[1400px] mx-auto w-full">
        <WizardInline
          initialCategory={activeCategory}
          token={token}
          onClose={() => setActiveCategory(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-[1400px] mx-auto w-full">
      <PageHeader
        title="Būvmateriāli"
        description="Izvēlieties materiāla kategoriju, lai atrastu labākos piedāvājumus."
        action={
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Meklēt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background w-full"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-8 mt-4">
        {filteredCategories.map((cat) => (
          <CategoryCard
            key={cat}
            category={cat}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
        {filteredCategories.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Nav atrasta neviena kategorija
          </div>
        )}
      </div>
    </div>
  );
}
