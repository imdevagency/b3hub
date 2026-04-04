/**
 * Disposal Order page — /dashboard/order/disposal
 * Uber-like UI: live Google Map preview + multi-step booking wizard.
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
  AddressAutocomplete,
  loadGoogleMapsScript,
  type PlaceAddress,
} from '@/components/ui/AddressAutocomplete';
import { createDisposalOrder } from '@/lib/api/orders';
import { type WasteType } from '@/lib/api/containers';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  ChevronRight,
  MapPin,
  CalendarDays,
  Loader2,
  Search,
} from 'lucide-react';
import Link from 'next/link';

const WASTE_TYPES: { id: WasteType; label: string; emoji: string }[] = [
  { id: 'CONCRETE', label: 'Betons', emoji: '🏗️' },
  { id: 'BRICK', label: 'Ķieģeļi / Būvgruži', emoji: '🧱' },
  { id: 'WOOD', label: 'Koksne', emoji: '🪵' },
  { id: 'MIXED', label: 'Jaukti atkritumi', emoji: '🗑️' },
  { id: 'SOIL', label: 'Zeme / Augsne', emoji: '🌱' },
];

const VOLUME_PRESETS: {
  key: string;
  label: string;
  sublabel: string;
  truckType: 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';
  truckCount: number;
  fromPrice: number;
}[] = [
  {
    key: 'sm',
    label: 'Neliela',
    sublabel: '~8 m³ · ~5 t · 1 mašīna',
    truckType: 'TIPPER_SMALL',
    truckCount: 1,
    fromPrice: 89,
  },
  {
    key: 'md',
    label: 'Vidēja',
    sublabel: '~12 m³ · ~10 t · 1 mašīna',
    truckType: 'TIPPER_LARGE',
    truckCount: 1,
    fromPrice: 149,
  },
  {
    key: 'lg',
    label: 'Liela',
    sublabel: '~18 m³ · ~15 t · smagā tehnika',
    truckType: 'ARTICULATED_TIPPER',
    truckCount: 1,
    fromPrice: 219,
  },
  {
    key: 'xl',
    label: 'Ļoti liela',
    sublabel: '~36 m³ · ~26 t · 2 mašīnas',
    truckType: 'ARTICULATED_TIPPER',
    truckCount: 2,
    fromPrice: 399,
  },
];

// Default map center: Riga
const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

export default function DisposalOrderPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();

  const [wasteType, setWasteType] = useState<WasteType | ''>('');
  const [selectedVolume, setSelectedVolume] = useState<string>('md');
  const selectedPreset = VOLUME_PRESETS.find((p) => p.key === selectedVolume) ?? VOLUME_PRESETS[1];

  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');

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

      // Centre on user's current location (Uber-style)
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
    if (step === 1) return wasteType !== '';
    if (step === 2) return address.length > 5;
    if (step === 3) return date !== '';
    return false;
  };

  const handleSubmit = async () => {
    if (!token || !wasteType) return;
    setLoading(true);
    try {
      const result = await createDisposalOrder(
        {
          pickupAddress: address,
          pickupCity: city || 'Rīga',
          pickupLat: lat,
          pickupLng: lng,
          wasteType,
          truckType: selectedPreset.truckType,
          truckCount: selectedPreset.truckCount,
          estimatedWeight: 1000 * selectedPreset.truckCount,
          requestedDate: new Date(date).toISOString(),
          notes,
          siteContactName: siteContactName || undefined,
          siteContactPhone: siteContactPhone || undefined,
        },
        token,
      );
      setCreatedRef(result.jobNumber ?? result.orderNumber ?? result.id.slice(0, 8).toUpperCase());
    } catch (err) {
      console.warn('Order submission error', err instanceof Error ? err.message : err);
      alert('Kļūda saglabājot pasūtījumu');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = [
    { label: 'Veids', icon: Trash2 },
    { label: 'Adrese', icon: MapPin },
    { label: 'Datums', icon: CalendarDays },
  ];

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
            Jauns izvešanas pieprasījums
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] w-full bg-background rounded-2xl overflow-hidden shadow-lg border flex flex-col-reverse lg:flex-row">
      <div className="w-full lg:w-105 shrink-0 flex flex-col bg-background z-10 relative border-t lg:border-t-0 lg:border-r">
        <div className="p-5 border-b bg-card space-y-3">
          <Link
            href="/dashboard/order"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Būvgružu Izvešana</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pasūtiet konteineru vai tehniku būvgružu izvešanai
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <div className="space-y-6">
            {/* Step indicators */}
            <div className="flex gap-2 w-full mb-6">
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
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-0">
              {/* Step 1: Waste type */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                    <h2 className="text-lg font-bold">Ko vēlaties utilizēt?</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Izvēlieties atkritumu veidu
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {WASTE_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setWasteType(type.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl text-left transition-all border-2 ${
                          wasteType === type.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                            : 'border-transparent bg-muted/60 hover:bg-muted'
                        }`}
                      >
                        <span className="text-xl">{type.emoji}</span>
                        <span className="font-medium text-sm">{type.label}</span>
                        {wasteType === type.id && (
                          <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">Apjoms</p>
                    <div className="grid grid-cols-2 gap-2">
                      {VOLUME_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => setSelectedVolume(preset.key)}
                          className={`flex flex-col gap-0.5 p-3.5 rounded-xl text-left transition-all border-2 ${
                            selectedVolume === preset.key
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                              : 'border-transparent bg-muted/60 hover:bg-muted'
                          }`}
                        >
                          <span className="font-semibold text-sm">{preset.label}</span>
                          <span className="text-xs text-muted-foreground">{preset.sublabel}</span>
                          <span className="text-xs font-semibold text-primary mt-1">
                            no €{preset.fromPrice}
                          </span>
                          {selectedVolume === preset.key && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Address */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                    <h2 className="text-lg font-bold">No kurienes izvest?</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Ievadiet precīzu adresi, kur atrodas atkritumi
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                    <AddressAutocomplete
                      value={address}
                      onChange={(v) => setAddress(v)}
                      onSelect={handleAddressSelect}
                      placeholder="Iela, mājas numurs, pilsēta..."
                      className="w-full rounded-xl border bg-muted/30 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                  </div>

                  {address && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-50 ring-1 ring-green-200">
                      <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-800">{address}</p>
                        {city && <p className="text-xs text-green-600">{city}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Date */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                  <div>
                    <h2 className="text-lg font-bold">Kad izvest?</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Izvēlieties vēlamo datumu
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl bg-muted/60 p-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Adrese:</span>
                      <span className="font-medium truncate">{address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Veids:</span>
                      <span className="font-medium">
                        {WASTE_TYPES.find((t) => t.id === wasteType)?.label} ·{' '}
                        {selectedPreset.label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Izvešanas datums</Label>
                    <Input
                      type="date"
                      className="mt-1.5 rounded-xl"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold">Papildus piezīmes</Label>
                    <Textarea
                      placeholder="Piekļuves nosacījumi, vārtu kodi u.c."
                      className="mt-1.5 rounded-xl resize-none"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Site contact info */}
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Objekta kontaktpersona</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Šoferis var sazināties ar šo personu piegādes brīdī
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-600 mb-1 block">
                          Vārds, uzvārds
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
                        <Label className="text-xs font-semibold text-slate-600 mb-1 block">
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
                </div>
              )}

              {/* Navigation */}
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
                    Apstiprināt pasūtījumu
                  </Button>
                )}
              </div>
            </div>
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
          {date && (
            <div className="bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-sm border text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              {date}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
