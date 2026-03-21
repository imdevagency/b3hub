const fs = require('fs');

const disposalPage = `/**
 * Disposal Order page — /dashboard/order/disposal
 * Mirrors the mobile Disposal flow.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { createDisposalOrder, type WasteType, type DisposalTruckType } from '@/lib/api/orders';
import { ArrowLeft, Trash2, CheckCircle2, ChevronRight, Package, MapPin, CalendarDays, Loader2 } from 'lucide-react';
import Link from 'next/link';

const WASTE_TYPES: { id: WasteType; label: string }[] = [
  { id: 'CONCRETE', label: 'Betons' },
  { id: 'BRICK', label: 'Ķieģeļi / Būvgruži' },
  { id: 'WOOD', label: 'Koksne' },
  { id: 'MIXED', label: 'Jaukti atkritumi' },
  { id: 'SOIL', label: 'Zeme / Augsne' },
];

export default function DisposalOrderPage() {
  const router = useRouter();
  const { token } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Data
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  
  const [wasteType, setWasteType] = useState<WasteType | ''>('');
  const [truckCount, setTruckCount] = useState<number>(1);
  
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const canAdvance = () => {
    if (step === 1) return address.length > 5;
    if (step === 2) return wasteType !== '';
    if (step === 3) return date !== '';
    return false;
  };

  const handleSubmit = async () => {
    if (!token || !wasteType) return;
    setLoading(true);
    try {
      const res = await createDisposalOrder(
        {
          pickupAddress: address,
          pickupCity: city || 'Rīga',
          pickupLat: lat,
          pickupLng: lng,
          wasteType: wasteType,
          truckType: 'TIPPER_LARGE',
          truckCount,
          estimatedWeight: 1000 * truckCount,
          requestedDate: new Date(date).toISOString(),
          notes,
        },
        token
      );
      router.push(\`/dashboard/orders\`);
    } catch (err) {
      console.error(err);
      alert('Kļūda saglabājot pasūtījumu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full pb-20 space-y-6">
      <Link
        href="/dashboard/order"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ uz pasūtījumiem
      </Link>
      <PageHeader 
        title="Atkritumu utilizācija" 
        description="Pasūtiet atkritumu un būvgružu izvešanu" 
      />

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-muted -z-10 -translate-y-1/2 rounded-full" />
        <div 
          className={\`absolute top-1/2 left-0 h-[2px] bg-primary -z-10 -translate-y-1/2 transition-all duration-300 rounded-full\`} 
          style={{ width: \`\${(step - 1) * 50}%\` }} 
        />
        
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={\`h-10 w-10 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors border-2 \${
              step >= s ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted text-muted-foreground'
            }\`}
          >
            {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
          </div>
        ))}
      </div>

      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5 bg-white">
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                No kurienes izvest?
              </h2>
              <div className="space-y-4 max-w-md mt-4">
                <div>
                  <Label>Adrese</Label>
                  <AddressAutocomplete
                    value={address}
                    onChange={(val) => {
                      setAddress(val.address);
                      setCity(val.city || '');
                      setLat(val.lat);
                      setLng(val.lng);
                    }}
                    placeholder="Ievadiet adresi..."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-primary" />
                Ko vēlaties utilizēt?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {WASTE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setWasteType(type.id)}
                    className={\`p-4 rounded-xl text-left transition-all border-2 \${
                      wasteType === type.id 
                        ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
                        : 'border-transparent bg-muted hover:bg-muted/80'
                    }\`}
                  >
                    <div className="font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-8 max-w-md">
                <Label>Kravu / Mašīnu skaits</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Button variant="outline" size="icon" onClick={() => setTruckCount(Math.max(1, truckCount - 1))}>-</Button>
                  <span className="text-xl font-bold w-12 text-center">{truckCount}</span>
                  <Button variant="outline" size="icon" onClick={() => setTruckCount(truckCount + 1)}>+</Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Kad izvest atkritumus?
              </h2>
              <div className="max-w-md mt-4 space-y-4">
                <div>
                  <Label>Izvešanas datums</Label>
                  <Input 
                    type="date" 
                    className="mt-1.5" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>Papildus piezīmes</Label>
                  <Textarea 
                    placeholder="Piekļuves nosacījumi, vārtu kodi u.c." 
                    className="mt-1.5"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t flex justify-between items-center">
            <Button 
              variant="ghost" 
              onClick={() => setStep(step - 1)}
              disabled={step === 1 || loading}
            >
              Atpakaļ
            </Button>
            
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                Tālāk <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canAdvance() || loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Apstiprināt pasūtījumu
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
\`;

const transportPage = \`/**
 * Transport Order page — /dashboard/order/transport
 * Mirrors the mobile Transport flow.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { createTransportOrder, type TransportVehicleType } from '@/lib/api/orders';
import { ArrowLeft, Truck, CheckCircle2, ChevronRight, MapPin, CalendarDays, Loader2, Weight } from 'lucide-react';
import Link from 'next/link';

export default function TransportOrderPage() {
  const router = useRouter();
  const { token } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Data
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupLat, setPickupLat] = useState<number>();
  const [pickupLng, setPickupLng] = useState<number>();
  
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number>();
  const [dropoffLng, setDropoffLng] = useState<number>();
  
  const [vehicleType, setVehicleType] = useState<TransportVehicleType | ''>('TIPPER_LARGE');
  const [loadDescription, setLoadDescription] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState<number>(20);
  
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

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
      await createTransportOrder(
        {
          pickupAddress,
          pickupCity: pickupCity || 'Rīga',
          pickupLat, pickupLng,
          dropoffAddress,
          dropoffCity: dropoffCity || 'Rīga',
          dropoffLat, dropoffLng,
          vehicleType,
          loadDescription,
          estimatedWeight: estimatedWeight * 1000,
          requestedDate: new Date(date).toISOString(),
          notes,
        },
        token
      );
      router.push('/dashboard/orders');
    } catch (err) {
      console.error(err);
      alert('Kļūda saglabājot pasūtījumu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full pb-20 space-y-6">
      <Link
        href="/dashboard/order"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Atpakaļ uz pasūtījumiem
      </Link>
      <PageHeader 
        title="Kravu Pārvadājumi" 
        description="Pasūtiet tehniku materiālu vai tehnikas pārvešanai" 
      />

      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-muted -z-10 -translate-y-1/2 rounded-full" />
        <div 
          className="absolute top-1/2 left-0 h-[2px] bg-primary -z-10 -translate-y-1/2 transition-all duration-300 rounded-full" 
          style={{ width: \`\${(step - 1) * 33.33}%\` }} 
        />
        
        {[1, 2, 3, 4].map((s) => (
          <div 
            key={s} 
            className={\`h-10 w-10 rounded-full flex items-center justify-center font-bold shadow-sm transition-colors border-2 \${
              step >= s ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted text-muted-foreground'
            }\`}
          >
            {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
          </div>
        ))}
      </div>

      <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5 bg-white">
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Iekraušanas adrese
              </h2>
              <div className="max-w-md mt-4">
                <Label>No kurienes vedīsim?</Label>
                <AddressAutocomplete
                  value={pickupAddress}
                  onChange={(val) => {
                    setPickupAddress(val.address);
                    setPickupCity(val.city || '');
                    setPickupLat(val.lat);
                    setPickupLng(val.lng);
                  }}
                  placeholder="Ievadiet iekraušanas adresi..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                Izkraušanas adrese
              </h2>
              <div className="max-w-md mt-4">
                <Label>Uz kurieni vedīsim?</Label>
                <AddressAutocomplete
                  value={dropoffAddress}
                  onChange={(val) => {
                    setDropoffAddress(val.address);
                    setDropoffCity(val.city || '');
                    setDropoffLat(val.lat);
                    setDropoffLng(val.lng);
                  }}
                  placeholder="Ievadiet izkraušanas adresi..."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Kravas detaļas
              </h2>
              <div className="max-w-md mt-4 space-y-4">
                <div>
                  <Label>Kravas apraksts</Label>
                  <Textarea 
                    placeholder="Piem. smiltis, tehnika, palešu krava" 
                    value={loadDescription}
                    onChange={(e) => setLoadDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Aptuvenais svars (tonnās)</Label>
                  <Input 
                    type="number" 
                    value={estimatedWeight} 
                    onChange={(e) => setEstimatedWeight(Number(e.target.value))} 
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Datums un apstiprinājums
              </h2>
              <div className="max-w-md mt-4 space-y-4">
                <div>
                  <Label>Vēlamais datums</Label>
                  <Input 
                    type="date" 
                    className="mt-1.5" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label>Papildus piezīmes</Label>
                  <Textarea 
                    placeholder="Piekļuves nosacījumi, vārtu kodi u.c." 
                    className="mt-1.5"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t flex justify-between items-center">
            <Button 
              variant="ghost" 
              onClick={() => setStep(step - 1)}
              disabled={step === 1 || loading}
            >
              Atpakaļ
            </Button>
            
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                Tālāk <ChevronRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canAdvance() || loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Apstiprināt pasūtījumu
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
\`

fs.writeFileSync('apps/web/src/app/dashboard/order/disposal/page.tsx', disposalPage);
fs.writeFileSync('apps/web/src/app/dashboard/order/transport/page.tsx', transportPage);
console.log('Wizard pages generated');
