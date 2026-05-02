'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  MapPin,
  Pencil,
  CheckCircle2,
  XCircle,
  Package,
  Recycle,
  Truck,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  getB3Fields,
  createB3Field,
  updateB3Field,
  type ApiB3Field,
  type B3FieldService,
} from '@/lib/api';

const SERVICE_META: Record<
  B3FieldService,
  { label: string; icon: React.ElementType; color: string }
> = {
  MATERIAL_PICKUP: {
    label: 'Materiālu paņemšana',
    icon: Package,
    color: 'bg-blue-500/20 text-blue-400',
  },
  WASTE_DISPOSAL: {
    label: 'Atkritumu nodošana',
    icon: Recycle,
    color: 'bg-green-500/20 text-green-400',
  },
  TRAILER_RENTAL: { label: 'Piekabe īrei', icon: Truck, color: 'bg-orange-500/20 text-orange-400' },
};

const ALL_SERVICES: B3FieldService[] = ['MATERIAL_PICKUP', 'WASTE_DISPOSAL', 'TRAILER_RENTAL'];

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: 'P',
  tuesday: 'O',
  wednesday: 'T',
  thursday: 'C',
  friday: 'Pk',
  saturday: 'S',
  sunday: 'Sv',
};

const DEFAULT_HOURS = {
  monday: { open: '07:00', close: '19:00' },
  tuesday: { open: '07:00', close: '19:00' },
  wednesday: { open: '07:00', close: '19:00' },
  thursday: { open: '07:00', close: '19:00' },
  friday: { open: '07:00', close: '19:00' },
  saturday: { open: '08:00', close: '16:00' },
  sunday: null,
};

type FormState = {
  name: string;
  slug: string;
  address: string;
  city: string;
  postalCode: string;
  lat: string;
  lng: string;
  services: B3FieldService[];
  active: boolean;
  notes: string;
  openingHours: Record<string, { open: string; close: string } | null>;
};

const emptyForm = (): FormState => ({
  name: '',
  slug: '',
  address: '',
  city: '',
  postalCode: '',
  lat: '',
  lng: '',
  services: ['MATERIAL_PICKUP'],
  active: true,
  notes: '',
  openingHours: DEFAULT_HOURS,
});

export default function AdminB3FieldsPage() {
  const { token: rawToken } = useAuth();
  const token = rawToken ?? '';

  const [fields, setFields] = useState<ApiB3Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiB3Field | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getB3Fields(true);
      setFields(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setSheetOpen(true);
  };

  const openEdit = (field: ApiB3Field) => {
    setEditing(field);
    setForm({
      name: field.name,
      slug: field.slug,
      address: field.address,
      city: field.city,
      postalCode: field.postalCode,
      lat: String(field.lat),
      lng: String(field.lng),
      services: field.services,
      active: field.active,
      notes: field.notes ?? '',
      openingHours: field.openingHours as FormState['openingHours'],
    });
    setError('');
    setSheetOpen(true);
  };

  const toggleService = (svc: B3FieldService) => {
    setForm((p) => ({
      ...p,
      services: p.services.includes(svc)
        ? p.services.filter((s) => s !== svc)
        : [...p.services, svc],
    }));
  };

  const toggleDay = (day: (typeof DAYS)[number]) => {
    setForm((p) => ({
      ...p,
      openingHours: {
        ...p.openingHours,
        [day]: p.openingHours[day] ? null : { open: '07:00', close: '19:00' },
      },
    }));
  };

  const setHour = (day: (typeof DAYS)[number], key: 'open' | 'close', val: string) => {
    setForm((p) => ({
      ...p,
      openingHours: {
        ...p.openingHours,
        [day]: { ...(p.openingHours[day] as { open: string; close: string }), [key]: val },
      },
    }));
  };

  const save = async () => {
    setError('');
    if (!form.name || !form.slug || !form.address || !form.city || !form.lat || !form.lng) {
      setError('Aizpildi visus obligātos laukus');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s+/g, '-'),
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        services: form.services,
        active: form.active,
        notes: form.notes || undefined,
        openingHours: form.openingHours,
      };
      if (editing) {
        await updateB3Field(token, editing.id, payload);
      } else {
        await createB3Field(token, payload);
      }
      setSheetOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda saglabājot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="B3 Fields"
        description="Fizisko punktu pārvaldība"
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            Pievienot punktu
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nav B3 Field punktu. Pievieno pirmo!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <Card key={field.id} className={field.active ? '' : 'opacity-60'}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold">{field.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {field.address}, {field.city}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">/{field.slug}</p>
                  </div>
                  <Badge
                    className={
                      field.active
                        ? 'bg-green-500/20 text-green-600 border-green-500/30'
                        : 'bg-red-500/20 text-red-600 border-red-500/30'
                    }
                  >
                    {field.active ? 'Aktīvs' : 'Neaktīvs'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {field.services.map((svc) => {
                    const meta = SERVICE_META[svc];
                    const Icon = meta.icon;
                    return (
                      <span
                        key={svc}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(field)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Rediģēt
                  </Button>
                  <Button variant="default" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/admin/b3-fields/${field.id}`}>Pārvaldīt →</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Rediģēt B3 Field' : 'Jauns B3 Field'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-6 pb-8">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nosaukums *</Label>
                <Input
                  placeholder="B3 Field Gulbene"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Slug (URL) *</Label>
                <Input
                  placeholder="gulbene"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Adrese *</Label>
                <Input
                  placeholder="Brīvības iela 1"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pilsēta *</Label>
                <Input
                  placeholder="Gulbene"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pasta indekss</Label>
                <Input
                  placeholder="LV-4401"
                  value={form.postalCode}
                  onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Platums (lat) *</Label>
                <Input
                  type="number"
                  placeholder="57.1753"
                  value={form.lat}
                  onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Garums (lng) *</Label>
                <Input
                  type="number"
                  placeholder="26.7498"
                  value={form.lng}
                  onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))}
                />
              </div>
            </div>

            {/* Services */}
            <div className="space-y-2">
              <Label>Pakalpojumi</Label>
              <div className="space-y-2">
                {ALL_SERVICES.map((svc) => {
                  const meta = SERVICE_META[svc];
                  const Icon = meta.icon;
                  const checked = form.services.includes(svc);
                  return (
                    <div
                      key={svc}
                      onClick={() => toggleService(svc)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${meta.color}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">{meta.label}</span>
                      {checked && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Opening hours */}
            <div className="space-y-2">
              <Label>Darba laiks</Label>
              <div className="space-y-1.5">
                {DAYS.map((day) => {
                  const hours = form.openingHours[day];
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-6">
                        {DAY_LABELS[day]}
                      </span>
                      <Switch
                        checked={!!hours}
                        onCheckedChange={() => toggleDay(day)}
                        className="scale-75"
                      />
                      {hours ? (
                        <>
                          <Input
                            type="time"
                            value={hours.open}
                            onChange={(e) => setHour(day, 'open', e.target.value)}
                            className="h-7 w-24 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={hours.close}
                            onChange={(e) => setHour(day, 'close', e.target.value)}
                            className="h-7 w-24 text-xs"
                          />
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Slēgts</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Piezīmes (iekšējas)</Label>
              <Textarea
                placeholder="Norādījumi vārtu operatoriem..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
              />
              <Label>Aktīvs (redzams publiskajā sarakstā)</Label>
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                {error}
              </p>
            )}

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editing ? 'Saglabāt izmaiņas' : 'Izveidot B3 Field'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
