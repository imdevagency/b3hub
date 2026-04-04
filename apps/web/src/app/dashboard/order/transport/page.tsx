/**
 * Transport Order page — /dashboard/order/transport
 * Uber-like UI: live Google Map with pickup/dropoff pins + routing line.
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
import { createTransportOrder, type TransportVehicleType } from '@/lib/api/orders';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  ChevronRight,
  MapPin,
  CalendarDays,
  Loader2,
  Navigation,
} from 'lucide-react';
import Link from 'next/link';

const DEFAULT_CENTER = { lat: 56.9496, lng: 24.1052 };

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

export default function TransportOrderPage() {
  const router = useRouter();
  const { token } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupLat, setPickupLat] = useState<number>();
  const [pickupLng, setPickupLng] = useState<number>();

  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number>();
  const [dropoffLng, setDropoffLng] = useState<number>();

  const [vehicleType, setVehicleType] = useState<TransportVehicleType>('TIPPER_LARGE');
  const [loadDescription, setLoadDescription] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState<number>(20);

  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [siteContactName, setSiteContactName] = useState('');
  const [siteContactPhone, setSiteContactPhone] = useState('');

  // Map refs
  const mapDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickupMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dropoffMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylineRef = useRef<any>(null);

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
        styles: MAP_STYLES,
      });
      mapInstanceRef.current = map;

      // Centre on user's current location (Uber-style)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            map.panTo(userPos);
            map.setZoom(14);
            new google.maps.Marker({
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

  const updateRoutePolyline = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const google = (window as any).google;
    if (!google || !mapInstanceRef.current) return;
    if (
      pickupLat === undefined ||
      pickupLng === undefined ||
      dropoffLat === undefined ||
      dropoffLng === undefined
    )
      return;

    const path = [
      { lat: pickupLat, lng: pickupLng },
      { lat: dropoffLat, lng: dropoffLng },
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
    bounds.extend({ lat: pickupLat, lng: pickupLng });
    bounds.extend({ lat: dropoffLat, lng: dropoffLng });
    mapInstanceRef.current.fitBounds(bounds, 80);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const handlePickupSelect = useCallback(
    (result: PlaceAddress) => {
      setPickupCity(result.city);
      if (result.lat !== undefined && result.lng !== undefined) {
        setPickupLat(result.lat);
        setPickupLng(result.lng);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google || !mapInstanceRef.current) return;
        const pos = { lat: result.lat, lng: result.lng };
        if (pickupMarkerRef.current) {
          pickupMarkerRef.current.setPosition(pos);
        } else {
          pickupMarkerRef.current = new google.maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            animation: google.maps.Animation.DROP,
            label: { text: 'A', color: '#fff', fontWeight: 'bold', fontSize: '12px' },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#22c55e',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
            },
          });
        }
        if (!dropoffLat) {
          mapInstanceRef.current.panTo(pos);
          mapInstanceRef.current.setZoom(15);
        }
      }
    },
    [dropoffLat],
  );

  const handleDropoffSelect = useCallback(
    (result: PlaceAddress) => {
      setDropoffCity(result.city);
      if (result.lat !== undefined && result.lng !== undefined) {
        setDropoffLat(result.lat);
        setDropoffLng(result.lng);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const google = (window as any).google;
        if (!google || !mapInstanceRef.current) return;
        const pos = { lat: result.lat, lng: result.lng };
        if (dropoffMarkerRef.current) {
          dropoffMarkerRef.current.setPosition(pos);
        } else {
          dropoffMarkerRef.current = new google.maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            animation: google.maps.Animation.DROP,
            label: { text: 'B', color: '#fff', fontWeight: 'bold', fontSize: '12px' },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
            },
          });
        }
        updateRoutePolyline();
      }
    },
    [updateRoutePolyline],
  );

  // Re-draw polyline whenever both coords update
  useEffect(() => {
    if (pickupLat && pickupLng && dropoffLat && dropoffLng) {
      updateRoutePolyline();
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, updateRoutePolyline]);

  const canAdvance = () => {
    if (step === 1) return pickupAddress.length > 5;
    if (step === 2) return dropoffAddress.length > 5;
    if (step === 3) return loadDescription.length > 3;
    if (step === 4) return date !== '';
    return false;
  };

  const handleSubmit = async () => {
    if (!token || !vehicleType) return;
    setLoading(true);
    try {
      const result = await createTransportOrder(
        {
          pickupAddress,
          pickupCity: pickupCity || 'Rīga',
          pickupLat,
          pickupLng,
          dropoffAddress,
          dropoffCity: dropoffCity || 'Rīga',
          dropoffLat,
          dropoffLng,
          vehicleType,
          loadDescription,
          estimatedWeight: estimatedWeight * 1000,
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
    { label: 'Iekraušana', icon: MapPin },
    { label: 'Izkraušana', icon: Navigation },
    { label: 'Krava', icon: Truck },
    { label: 'Datums', icon: CalendarDays },
  ];

  if (createdRef) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Transporta pieprasījums nosūtīts</h1>
          <p className="text-sm text-muted-foreground">Atsauces numurs: #{createdRef}</p>
          <p className="text-sm text-muted-foreground">
            {pickupAddress} → {dropoffAddress}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => router.push('/dashboard/orders')}>Skatīt pasūtījumus</Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/order/transport')}>
            Jauns transporta pieprasījums
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
            <h1 className="text-2xl font-bold tracking-tight">Kravu Pārvadājumi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pasūtiet tehniku materiālu pārvešanai
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <div className="space-y-6">
            <div className="flex w-full items-center gap-1.5 px-0.5 mb-2">
              {STEPS.map((s, i) => {
                const n = i + 1;
                const active = step === n;
                const done = step > n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!(done || active || (n === step + 1 && canAdvance()))}
                    onClick={() => {
                      if (done || (n === step + 1 && canAdvance())) setStep(n);
                    }}
                    className="group flex flex-1 flex-col gap-2 relative disabled:opacity-50 text-left outline-none"
                  >
                    <div
                      className={`h-1.25 w-full rounded-full transition-all duration-300 ${
                        active ? 'bg-[#D82B24]' : done ? 'bg-[#D82B24]/40' : 'bg-gray-200'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-bold tracking-wider uppercase transition-colors pr-1 truncate ${
                        active
                          ? 'text-[#D82B24]'
                          : done
                            ? 'text-foreground hover:text-[#D82B24]'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="py-2">
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h2 className="text-xl font-bold">No kurienes vedīsim?</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ievadiet iekraušanas adresi
                    </p>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-black flex items-center justify-center z-10 pointer-events-none">
                      <div className="h-1.5 w-1.5 bg-white rounded-full" />
                    </div>
                    <AddressAutocomplete
                      value={pickupAddress}
                      onChange={(v) => setPickupAddress(v)}
                      onSelect={handlePickupSelect}
                      placeholder="Iekraušanas adrese..."
                      className="w-full rounded-xl border-2 bg-muted/20 pl-11 pr-4 py-3.5 text-[15px] focus:outline-none focus:border-black focus:ring-0 transition-colors shadow-sm"
                    />
                  </div>
                  {pickupAddress && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-black/5">
                      <MapPin className="h-5 w-5 text-black mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[15px] font-medium text-foreground">{pickupAddress}</p>
                        {pickupCity && (
                          <p className="text-sm text-muted-foreground">{pickupCity}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h2 className="text-xl font-bold">Uz kurieni vedīsim?</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ievadiet izkraušanas adresi
                    </p>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 bg-black flex items-center justify-center z-10 pointer-events-none">
                      <div className="h-1.5 w-1.5 bg-white" />
                    </div>
                    <AddressAutocomplete
                      value={dropoffAddress}
                      onChange={(v) => setDropoffAddress(v)}
                      onSelect={handleDropoffSelect}
                      placeholder="Izkraušanas adrese..."
                      className="w-full rounded-xl border-2 bg-muted/20 pl-11 pr-4 py-3.5 text-[15px] focus:outline-none focus:border-black focus:ring-0 transition-colors shadow-sm"
                    />
                  </div>
                  {dropoffAddress && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-black/5">
                      <MapPin className="h-5 w-5 text-black mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[15px] font-medium text-foreground">{dropoffAddress}</p>
                        {dropoffCity && (
                          <p className="text-sm text-muted-foreground">{dropoffCity}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h2 className="text-xl font-bold">Kravas detaļas</h2>
                    <p className="text-sm text-muted-foreground mt-1">Ko nepieciešams pārvest?</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Tehnikas veids
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          type="button"
                          className={`h-16 justify-start px-4 rounded-xl border-2 transition-all ${vehicleType === 'TIPPER_SMALL' ? 'border-black bg-black/5 ring-0' : 'border-border hover:border-black/30'}`}
                          onClick={() => setVehicleType('TIPPER_SMALL')}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <Truck
                              className={`h-5 w-5 ${vehicleType === 'TIPPER_SMALL' ? 'text-black' : 'text-muted-foreground'}`}
                            />
                            <span className={vehicleType === 'TIPPER_SMALL' ? 'font-bold' : ''}>
                              Pašizgāzējs (10 t)
                            </span>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          type="button"
                          className={`h-16 justify-start px-4 rounded-xl border-2 transition-all ${vehicleType === 'TIPPER_LARGE' ? 'border-black bg-black/5 ring-0' : 'border-border hover:border-black/30'}`}
                          onClick={() => setVehicleType('TIPPER_LARGE')}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <Truck
                              className={`h-5 w-5 ${vehicleType === 'TIPPER_LARGE' ? 'text-black' : 'text-muted-foreground'}`}
                            />
                            <span className={vehicleType === 'TIPPER_LARGE' ? 'font-bold' : ''}>
                              Pašizgāzējs (18 t)
                            </span>
                          </div>
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Kravas svars (tonnās)
                      </Label>
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        className="rounded-xl border-2 py-6 text-lg focus-visible:ring-0 focus-visible:border-black outline-none"
                        value={estimatedWeight || ''}
                        onChange={(e) => setEstimatedWeight(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Kravas apraksts
                      </Label>
                      <Textarea
                        placeholder="Piem. Ekskavators CAT 320, smilts krava..."
                        className="rounded-xl border-2 resize-none focus-visible:ring-0 focus-visible:border-black text-[15px] p-3 outline-none"
                        rows={3}
                        value={loadDescription}
                        onChange={(e) => setLoadDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <h2 className="text-xl font-bold">Kad vedīsim?</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Izvēlieties datumu un pievienojiet piezīmes
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <Label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Vēlamais datums
                      </Label>
                      <Input
                        type="date"
                        className="rounded-xl border-2 py-6 text-[15px] focus-visible:ring-0 focus-visible:border-black outline-none"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Papildus piezīmes
                      </Label>
                      <Textarea
                        placeholder="Piekļuves nosacījumi, vārtu kodi u.c."
                        className="rounded-xl border-2 resize-none focus-visible:ring-0 focus-visible:border-black text-[15px] p-3 outline-none"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    {/* Site contact info */}
                    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          Objekta kontaktpersona
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Šoferis var sazināties ar šo personu piegādes brīdī
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[13px] font-semibold text-slate-600 mb-1 block">
                            Vārds, uzvārds
                          </Label>
                          <Input
                            type="text"
                            placeholder="Jānis Bērziņš"
                            value={siteContactName}
                            onChange={(e) => setSiteContactName(e.target.value)}
                            className="rounded-xl border-2 py-2 text-[14px] focus-visible:ring-0 focus-visible:border-black outline-none"
                          />
                        </div>
                        <div>
                          <Label className="text-[13px] font-semibold text-slate-600 mb-1 block">
                            Tālrunis
                          </Label>
                          <Input
                            type="tel"
                            placeholder="+371 20 000 000"
                            value={siteContactPhone}
                            onChange={(e) => setSiteContactPhone(e.target.value)}
                            className="rounded-xl border-2 py-2 text-[14px] focus-visible:ring-0 focus-visible:border-black outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t bg-card mt-auto z-20">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              className={`flex-1 rounded-xl font-semibold border-2 hover:bg-muted ${step === 1 ? 'invisible' : ''}`}
              onClick={() => setStep(step - 1)}
              disabled={step === 1 || loading}
            >
              Atpakaļ
            </Button>

            {step < 4 ? (
              <Button
                size="lg"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex-1 rounded-xl font-semibold bg-black hover:bg-black/90 text-white shadow-lg gap-2"
              >
                Tālāk <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={!canAdvance() || loading}
                className="flex-2 rounded-xl font-bold bg-black hover:bg-black/90 text-white shadow-lg gap-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                Apstiprināt
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-[#e5e3df] min-h-100 lg:min-h-0">
        <div ref={mapDivRef} className="w-full h-full absolute inset-0 z-0" />
        <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-black/10 to-transparent pointer-events-none z-10" />

        {(pickupAddress || dropoffAddress) && (
          <div className="absolute top-4 right-4 max-w-75 w-[calc(100%-2rem)] z-20 space-y-2 pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
            {pickupAddress && (
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg ring-1 ring-black/5 flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-black flex items-center justify-center shrink-0">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    Iekraušana
                  </p>
                  <p className="text-[13px] font-semibold truncate text-foreground">
                    {pickupAddress}
                  </p>
                </div>
              </div>
            )}
            {dropoffAddress && (
              <div className="bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg ring-1 ring-black/5 flex items-center gap-3">
                <div className="h-6 w-6 bg-black flex items-center justify-center shrink-0">
                  <div className="h-2 w-2 bg-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    Izkraušana
                  </p>
                  <p className="text-[13px] font-semibold truncate text-foreground">
                    {dropoffAddress}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
