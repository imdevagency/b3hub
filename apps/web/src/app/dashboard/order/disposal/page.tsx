/**
 * Utilization / Disposal Order page — /dashboard/order/disposal
 * Real-world flow: buyer describes waste + weight, provider sends appropriate truck.
 * Pricing is €/tonne — buyer never picks truck type.
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  loadGoogleMapsScript,
  type PlaceAddress,
  AddressAutocomplete,
} from '@/components/ui/AddressAutocomplete';
import { createDisposalOrder, getMyOrders, type ApiOrder } from '@/lib/api/orders';
import { type WasteType, type DisposalTruckType } from '@/lib/api/containers';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  Trash2,
  CheckCircle2,
  ChevronRight,
  MapPin,
  CalendarDays,
  Loader2,
  AlertTriangle,
  Package,
  Weight,
  Truck,
  Clock,
  Info,
} from 'lucide-react';
import { WizardShell } from '@/components/order/WizardShell';

const WASTE_TYPES: { id: WasteType; label: string; sublabel: string; hazardous?: boolean }[] = [
  { id: 'CONCRETE', label: 'Betons / Bruģis', sublabel: 'Plāksnes, pamatnes, bruģakmens' },
  { id: 'BRICK', label: 'Ķieģeļi / Būvgruži', sublabel: 'Sienu materiāli, apmetums, flīzes' },
  { id: 'WOOD', label: 'Koksne', sublabel: 'Koka sijas, dēļi, logi, durvis' },
  { id: 'METAL', label: 'Metāls', sublabel: 'Stiegrojums, profili, metāllūžņi' },
  { id: 'PLASTIC', label: 'Plastmasa', sublabel: 'Caurules, plēves, iepakojums' },
  { id: 'SOIL', label: 'Zeme / Augsne', sublabel: 'Izrakta augsne, šķembas' },
  { id: 'MIXED', label: 'Jaukti būvatkritumi', sublabel: 'Dažādu veidu atkritumu maisījums' },
  {
    id: 'HAZARDOUS',
    label: 'Bīstami atkritumi',
    sublabel: 'Azbestos, krāsas, šķīdinātāji — nepieciešama īpaša atļauja',
    hazardous: true,
  },
];

const PACKAGING_TYPES: { id: string; label: string; sublabel: string }[] = [
  { id: 'LOOSE', label: 'Beramkrava', sublabel: 'Brīvi sabirināti, nav iepakoti' },
  { id: 'BAGGED', label: 'Maisos', sublabel: 'Big-bag vai parastie maisi' },
  { id: 'PALLETISED', label: 'Uz paletēm', sublabel: 'Vienības uz EUR paletēm' },
  { id: 'CONTAINERS', label: 'Konteineros / IBC', sublabel: 'Slēgtos konteinerors vai mucās' },
];

/**
 * Typical disposal price bands per tonne (€/t at acceptance point).
 * These are indicative — final price is set at weigh bridge.
 */
const WASTE_PRICE_BAND: Record<string, { from: number; to: number }> = {
  CONCRETE: { from: 8, to: 18 },
  BRICK: { from: 10, to: 22 },
  WOOD: { from: 25, to: 45 },
  METAL: { from: 0, to: 10 },
  PLASTIC: { from: 30, to: 60 },
  SOIL: { from: 5, to: 15 },
  MIXED: { from: 20, to: 45 },
  HAZARDOUS: { from: 80, to: 250 },
};

/**
 * Derives the appropriate truck type from estimated weight.
 * The provider decides actual vehicle count — buyer never sees this.
 */
function deriveTruckType(weightT: number): { truckType: DisposalTruckType; truckCount: number } {
  if (weightT <= 7) return { truckType: 'TIPPER_SMALL', truckCount: 1 };
  if (weightT <= 15) return { truckType: 'TIPPER_LARGE', truckCount: 1 };
  return { truckType: 'ARTICULATED_TIPPER', truckCount: Math.max(1, Math.ceil(weightT / 20)) };
}
// Default map center: Riga
const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

export default function DisposalOrderPage() {
  const router = useRouter();
  const { token, user } = useAuth();

  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'order' | 'history'>('order');
  const [historyOrders, setHistoryOrders] = useState<ApiOrder[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdRef, setCreatedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contactPrefilled, setContactPrefilled] = useState(false);

  // Step 1 — waste details
  const [wasteType, setWasteType] = useState<WasteType | ''>('');
  const [estimatedWeightT, setEstimatedWeightT] = useState<string>('');
  const [packagingType, setPackagingType] = useState('LOOSE');

  // Step 2 — address + site access
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [hasTruckAccess, setHasTruckAccess] = useState<boolean | null>(null);
  const [hasForklift, setHasForklift] = useState(false);
  const [accessNotes, setAccessNotes] = useState('');

  // Step 3 — date + contact
  const [date, setDate] = useState('');
  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-fill contact from authenticated user profile
  useEffect(() => {
    if (user && !contactPrefilled) {
      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      if (fullName || user.phone) {
        setSiteContactName(fullName);
        setSiteContactPhone(user.phone ?? '');
        setContactPrefilled(true);
      }
    }
  }, [user, contactPrefilled]);

  // Load disposal history when history tab is activated
  useEffect(() => {
    if (activeTab !== 'history' || !token) return;
    setHistoryLoading(true);
    setHistoryError('');
    getMyOrders(token)
      .then((orders) => setHistoryOrders(orders.filter((o) => o.orderType === 'DISPOSAL')))
      .catch(() => setHistoryError('Neizdevās ielādēt pasūtījumus'))
      .finally(() => setHistoryLoading(false));
  }, [activeTab, token]);
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

      // Centre on user's current location (Uber-style)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.panTo(userPos);
            map.setZoom(14);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const handleAddressSelect = useCallback(
    (result: PlaceAddress) => {
      setCity(result.city);
      if (result.lat !== undefined && result.lng !== undefined) {
        setLat(result.lat);
        setLng(result.lng);
        updateMapPin(result.lat, result.lng);
      }
    },
    [updateMapPin],
  );

  const canAdvance = () => {
    if (step === 1) return wasteType !== '' && parseFloat(estimatedWeightT) > 0;
    if (step === 2) return address.length > 5 && hasTruckAccess !== null;
    if (step === 3) return date !== '';
    return false;
  };

  const handleSubmit = async () => {
    if (!token || !wasteType) return;
    const weightT = parseFloat(estimatedWeightT) || 1;
    const { truckType, truckCount } = deriveTruckType(weightT);
    const allNotes = [
      packagingType !== 'LOOSE'
        ? `Iepakojums: ${PACKAGING_TYPES.find((p) => p.id === packagingType)?.label}`
        : null,
      hasForklift ? 'Objektā pieejams autokrāvējs' : null,
      accessNotes ? `Piekļuve: ${accessNotes}` : null,
      notes || null,
    ]
      .filter(Boolean)
      .join('. ');

    setLoading(true);
    try {
      const result = await createDisposalOrder(
        {
          pickupAddress: address,
          pickupCity: city || 'Rīga',
          pickupLat: lat,
          pickupLng: lng,
          wasteType,
          truckType,
          truckCount,
          estimatedWeight: weightT,
          requestedDate: new Date(date).toISOString(),
          notes: allNotes || undefined,
          siteContactName: siteContactName || undefined,
          siteContactPhone: siteContactPhone || undefined,
        },
        token,
      );
      setCreatedRef(result.jobNumber ?? result.orderNumber ?? result.id.slice(0, 8).toUpperCase());
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kļūda saglabājot pasūtījumu');
    } finally {
      setLoading(false);
    }
  };

  if (createdRef) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Izvešanas pieprasījums nosūtīts</h1>
          <p className="text-sm text-muted-foreground">Atsauces numurs: #{createdRef}</p>
          <p className="text-sm text-muted-foreground">{address}</p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => router.push('/dashboard/orders')}>Skatīt pasūtījumus</Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/order/disposal')}>
            Jauns pieprasījums
          </Button>
        </div>
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
          {date && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              {date}
            </div>
          )}
        </div>
      </div>
      <WizardShell
        className="w-full lg:w-115 flex-1 min-h-0 lg:flex-none z-20 relative lg:absolute lg:top-4 lg:bottom-4 lg:left-4 lg:rounded-2xl lg:shadow-2xl border-t lg:border-none flex flex-col bg-white"
        title="Atkritumu Utilizācija"
        step={activeTab === 'history' ? 0 : step}
        totalSteps={3}
        onBack={() => router.push('/dashboard/order')}
        headerSlot={
          <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('order')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'order'
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pasūtīt
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === 'history'
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Vēsture
            </button>
          </div>
        }
      >
        {submitError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <span className="font-semibold">Kļūda:</span> {submitError}
          </div>
        )}

        {/* ── History tab ── */}
        {activeTab === 'history' && (
          <div className="space-y-3 animate-in fade-in">
            {historyLoading && (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {historyError && (
              <div className="py-8 text-center text-destructive text-sm">{historyError}</div>
            )}
            {!historyLoading && !historyError && historyOrders.length === 0 && (
              <div className="py-10 text-center space-y-2">
                <Trash2 className="h-9 w-9 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Nav iepriekšējo pasūtījumu</p>
              </div>
            )}
            {!historyLoading &&
              historyOrders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">#{o.orderNumber}</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: '#f1f5f9', color: '#475569' }}
                    >
                      {o.status}
                    </span>
                  </div>
                  {o.deliveryAddress && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{o.deliveryAddress}</span>
                    </div>
                  )}
                  {o.createdAt && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {new Date(o.createdAt).toLocaleDateString('lv-LV', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* ── Step 1: Waste type + weight + packaging ── */}
        {activeTab === 'order' && step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <h2 className="text-lg font-bold">Ko izvest?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Atkritumu veids un daudzums — mēs izvēlamies piemērotāko transportu
              </p>
            </div>

            {/* Waste type */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Atkritumu veids
              </Label>
              <div className="grid grid-cols-1 gap-1.5">
                {WASTE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (!type.hazardous) setWasteType(type.id);
                    }}
                    disabled={type.hazardous}
                    className={`flex items-start gap-3 p-3.5 rounded-xl text-left transition-all border ${
                      type.hazardous
                        ? 'border-amber-200 bg-amber-50 cursor-not-allowed opacity-80'
                        : wasteType === type.id
                          ? 'border-foreground bg-foreground/5 ring-2 ring-foreground/10'
                          : 'border-border/60 bg-muted/40 hover:bg-muted/70'
                    }`}
                  >
                    {type.hazardous ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <div
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${wasteType === type.id ? 'border-foreground bg-foreground' : 'border-muted-foreground/40'}`}
                      >
                        {wasteType === type.id && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm block">{type.label}</span>
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {type.sublabel}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated weight */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Weight className="h-3.5 w-3.5" />
                Aptuvens daudzums (tonnas)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  placeholder="piem. 5"
                  value={estimatedWeightT}
                  onChange={(e) => setEstimatedWeightT(e.target.value)}
                  className="rounded-xl flex-1"
                />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  t
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Aptuvenais svars — galīgo cenu nosaka svēršana pieņemšanas punktā
              </p>
              {parseFloat(estimatedWeightT) > 0 && (
                <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2.5 text-xs text-muted-foreground">
                  <Truck className="h-3.5 w-3.5 shrink-0" />
                  {parseFloat(estimatedWeightT) <= 7
                    ? 'Mazais pašizgāzējs (līdz 7 t)'
                    : parseFloat(estimatedWeightT) <= 15
                      ? 'Lielais pašizgāzējs (līdz 15 t)'
                      : `Smagā tehnika · ${Math.ceil(parseFloat(estimatedWeightT) / 20)} reiss(-i)`}
                  <span className="ml-auto text-muted-foreground/60">
                    Transportu izvēlas piegādātājs
                  </span>
                </div>
              )}
              {wasteType !== '' && WASTE_PRICE_BAND[wasteType] && (
                <div className="flex items-center gap-2 bg-muted/40 border border-border/50 rounded-xl px-3 py-2.5 text-xs text-foreground/70">
                  <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>
                    Tipiskā cena:{' '}
                    <span className="font-semibold text-foreground">
                      €{WASTE_PRICE_BAND[wasteType].from}–{WASTE_PRICE_BAND[wasteType].to}/t
                    </span>
                  </span>
                  <span className="ml-auto text-muted-foreground/60 whitespace-nowrap">
                    galīgo nosaka svēršana
                  </span>
                </div>
              )}
            </div>

            {/* Packaging type */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Kā atkritumi ir sagatavoti?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PACKAGING_TYPES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPackagingType(p.id)}
                    className={`p-3 rounded-xl text-left transition-all border ${
                      packagingType === p.id
                        ? 'border-foreground bg-foreground/5 ring-2 ring-foreground/10'
                        : 'border-border/60 bg-muted/40 hover:bg-muted/70'
                    }`}
                  >
                    <span className="font-semibold text-sm block">{p.label}</span>
                    <span className="text-xs text-muted-foreground mt-0.5 block">{p.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Address + site access ── */}
        {activeTab === 'order' && step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <h2 className="text-lg font-bold">No kurienes izvest?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Adrese un piekļuves informācija kravas automašīnai
              </p>
            </div>

            <AddressAutocomplete
              value={address}
              onChange={(v) => setAddress(v)}
              onSelect={handleAddressSelect}
              placeholder="Iela, mājas numurs, pilsēta..."
            />

            {address && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-50 ring-1 ring-green-200">
                <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">{address}</p>
                  {city && <p className="text-xs text-green-600">{city}</p>}
                </div>
              </div>
            )}

            {/* Truck access */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Vai kravas auto var braukt klāt?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: 'Jā', sublabel: 'Brīva piekļuve' },
                  { value: false, label: 'Nē / ierobežota', sublabel: 'Šaura ieeja, aizslēgta' },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setHasTruckAccess(opt.value)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      hasTruckAccess === opt.value
                        ? 'border-foreground bg-foreground/5 ring-2 ring-foreground/10'
                        : 'border-border/60 bg-muted/40 hover:bg-muted/70'
                    }`}
                  >
                    <span className="font-semibold text-sm block">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Forklift */}
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/40">
              <input
                id="forklift"
                type="checkbox"
                checked={hasForklift}
                onChange={(e) => setHasForklift(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              <label htmlFor="forklift" className="flex-1 cursor-pointer">
                <span className="text-sm font-medium block">Objektā pieejams autokrāvējs</span>
                <span className="text-xs text-muted-foreground">
                  Palīdz iekraut paletes vai IBC
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Piekļuves piezīmes (neobligāti)</Label>
              <Textarea
                placeholder="Vārtu kods, šoferu instrukcijas, galda numurs u.c."
                className="rounded-xl resize-none"
                rows={2}
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Date + contact + summary ── */}
        {activeTab === 'order' && step === 3 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <h2 className="text-lg font-bold">Kad un kā sazināties?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Vēlamais izbraukšanas datums</p>
            </div>

            {/* Order summary */}
            <div className="rounded-xl bg-muted/60 p-4 space-y-2 text-sm border border-border/40">
              <div className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Veids:</span>
                <span className="font-medium">
                  {WASTE_TYPES.find((t) => t.id === wasteType)?.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Daudzums:</span>
                <span className="font-medium">
                  ~{estimatedWeightT} t ·{' '}
                  {PACKAGING_TYPES.find((p) => p.id === packagingType)?.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Adrese:</span>
                <span className="font-medium truncate">{address}</span>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Izbraukšanas datums</Label>
              <Input
                type="date"
                className="mt-1.5 rounded-xl"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Contact */}
            <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Objekta kontaktpersona</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Šoferis var sazināties izbraukšanas dienā
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Vārds
                  </Label>
                  <Input
                    type="text"
                    placeholder="Jānis Bērziņš"
                    value={siteContactName}
                    onChange={(e) => setSiteContactName(e.target.value)}
                    className="rounded-lg h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Tālrunis
                  </Label>
                  <Input
                    type="tel"
                    placeholder="+371 20 000 000"
                    value={siteContactPhone}
                    onChange={(e) => setSiteContactPhone(e.target.value)}
                    className="rounded-lg h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Papildus piezīmes</Label>
              <Textarea
                placeholder="Jebkas, ko šoferim vai dispečeram vajadzētu zināt..."
                className="mt-1.5 rounded-xl resize-none"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        {activeTab === 'order' && (
          <div className="mt-6 pt-5 border-t flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              disabled={step === 1 || loading}
            >
              Atpakaļ
            </Button>

            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="gap-1.5"
              >
                Tālāk <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canAdvance() || loading}
                className="gap-1.5"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Iesniegt pieprasījumu
              </Button>
            )}
          </div>
        )}
      </WizardShell>
    </>
  );
}
