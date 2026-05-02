/**
 * Admin Field-ops hub — /dashboard/admin/field-ops
 * Tabbed hub: B3 Fields · Caurlaides · Svēršanas akti
 */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Scale,
  Search,
  Ticket,
  Clock,
  ShieldAlert,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import {
  getB3Fields,
  createB3Field,
  updateB3Field,
  getFieldPassesAdmin,
  revokeFieldPass,
  getWeighingSlipsAdmin,
  createWeighingSlip,
  voidWeighingSlip,
  type ApiB3Field,
  type B3FieldService,
  type ApiFieldPass,
  type FieldPassStatus,
  type ApiWeighingSlip,
} from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── B3 Fields tab ────────────────────────────────────────────────────────────

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

type FieldFormState = {
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
const emptyFieldForm = (): FieldFormState => ({
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

function B3FieldsTab({ token }: { token: string }) {
  const [fields, setFields] = useState<ApiB3Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiB3Field | null>(null);
  const [form, setForm] = useState<FieldFormState>(emptyFieldForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFields(await getB3Fields(true));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyFieldForm());
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
      openingHours: field.openingHours as FieldFormState['openingHours'],
    });
    setError('');
    setSheetOpen(true);
  };
  const toggleService = (svc: B3FieldService) =>
    setForm((p) => ({
      ...p,
      services: p.services.includes(svc)
        ? p.services.filter((s) => s !== svc)
        : [...p.services, svc],
    }));
  const toggleDay = (day: (typeof DAYS)[number]) =>
    setForm((p) => ({
      ...p,
      openingHours: {
        ...p.openingHours,
        [day]: p.openingHours[day] ? null : { open: '07:00', close: '19:00' },
      },
    }));
  const setHour = (day: (typeof DAYS)[number], key: 'open' | 'close', val: string) =>
    setForm((p) => ({
      ...p,
      openingHours: {
        ...p.openingHours,
        [day]: { ...(p.openingHours[day] as { open: string; close: string }), [key]: val },
      },
    }));

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
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Pievienot punktu
        </Button>
      </div>
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
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-border'}`}
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
            <div className="space-y-1.5">
              <Label>Piezīmes (iekšējas)</Label>
              <Textarea
                placeholder="Norādījumi vārtu operatoriem..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
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

// ─── Field passes tab ─────────────────────────────────────────────────────────

const PASS_STATUS_META: Record<
  FieldPassStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    icon: React.ElementType;
  }
> = {
  ACTIVE: { label: 'Aktīva', variant: 'default', icon: CheckCircle2 },
  EXPIRED: { label: 'Beigusies', variant: 'secondary', icon: Clock },
  REVOKED: { label: 'Atcelta', variant: 'destructive', icon: XCircle },
};

function PassCard({ pass, onRevoke }: { pass: ApiFieldPass; onRevoke: (p: ApiFieldPass) => void }) {
  const now = new Date();
  const expired = pass.status === 'ACTIVE' && new Date(pass.validTo) < now;
  const effectiveStatus: FieldPassStatus = expired ? 'EXPIRED' : pass.status;
  const meta = PASS_STATUS_META[effectiveStatus];
  const Icon = meta.icon;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-600">
              <Ticket className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{pass.passNumber}</span>
                <Badge variant={meta.variant} className="text-xs">
                  <Icon className="h-3 w-3 mr-1" />
                  {meta.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pass.vehiclePlate}
                {pass.driverName ? ` · ${pass.driverName}` : ''}
              </p>
              {pass.company && <p className="text-xs text-muted-foreground">{pass.company.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pass.fileUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={pass.fileUrl} target="_blank" rel="noopener noreferrer">
                  PDF
                </a>
              </Button>
            )}
            {pass.status === 'ACTIVE' && !expired && (
              <Button variant="destructive" size="sm" onClick={() => onRevoke(pass)}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Atcelt
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground/70">No: </span>
            {fmtDate(pass.validFrom)}
          </div>
          <div>
            <span className="font-medium text-foreground/70">Līdz: </span>
            {fmtDate(pass.validTo)}
          </div>
          {pass.wasteClassCode && (
            <div>
              <span className="font-medium text-foreground/70">Kods: </span>
              {pass.wasteClassCode}
            </div>
          )}
          {pass.unloadingPoint && (
            <div>
              <span className="font-medium text-foreground/70">Izkraušana: </span>
              {pass.unloadingPoint}
            </div>
          )}
          {pass.revokedReason && (
            <div className="col-span-2 mt-1 pt-1.5 border-t text-destructive">
              <span className="font-medium">Atcelšanas iemesls: </span>
              {pass.revokedReason}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldPassesTab({ token }: { token: string }) {
  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<ApiFieldPass | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setPasses(await getFieldPassesAdmin(token));
    } catch {
      /* show empty state */
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = async () => {
    if (!token || !revokeTarget) return;
    setRevoking(true);
    try {
      await revokeFieldPass(revokeTarget.id, revokeReason, token);
      setRevokeTarget(null);
      setRevokeReason('');
      await load();
    } finally {
      setRevoking(false);
    }
  };

  const active = passes.filter((p) => p.status === 'ACTIVE' && new Date(p.validTo) >= new Date());
  const past = passes.filter((p) => p.status !== 'ACTIVE' || new Date(p.validTo) < new Date());

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-6 pt-4">
      {passes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="Nav caurlaiţu"
          description="Neviens uzņēmums vēl nav izveidojis caurlaides"
        />
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Aktīvās ({active.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {active.map((p) => (
                  <PassCard key={p.id} pass={p} onRevoke={setRevokeTarget} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Vēsture ({past.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((p) => (
                  <PassCard key={p.id} pass={p} onRevoke={setRevokeTarget} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Dialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
            setRevokeReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atcelt caurlaidi {revokeTarget?.passNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Atcelšanas iemesls</Label>
              <Input
                placeholder="Norādiet iemeslu..."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={revoking || !revokeReason.trim()}
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Apstiprināt
              atcelšanu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Weighing slips tab ───────────────────────────────────────────────────────

function SlipCard({
  slip,
  onVoid,
}: {
  slip: ApiWeighingSlip;
  onVoid: (s: ApiWeighingSlip) => void;
}) {
  const voided = Boolean(slip.voidedAt);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${voided ? 'bg-red-50 text-red-400' : 'bg-emerald-50 text-emerald-600'}`}
            >
              <Scale className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{slip.slipNumber}</span>
                {voided ? (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3 mr-1" />
                    Anulēts
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-xs bg-emerald-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Derīgs
                  </Badge>
                )}
              </div>
              {slip.fieldPass && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Caurlaide: {slip.fieldPass.passNumber} · {slip.fieldPass.vehiclePlate}
                  {slip.fieldPass.driverName ? ` · ${slip.fieldPass.driverName}` : ''}
                </p>
              )}
              {slip.operatorName && (
                <p className="text-xs text-muted-foreground">
                  Operators: {slip.operatorName}
                  {slip.operatorCompany ? ` (${slip.operatorCompany})` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!voided && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onVoid(slip)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Anulēt
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div className="rounded bg-muted px-2 py-1.5">
            <p className="text-muted-foreground">Bruto</p>
            <p className="font-semibold text-sm">{slip.grossTonnes.toFixed(3)} t</p>
          </div>
          <div className="rounded bg-muted px-2 py-1.5">
            <p className="text-muted-foreground">Tara</p>
            <p className="font-semibold text-sm">{slip.tareTonnes.toFixed(3)} t</p>
          </div>
          <div className="rounded bg-emerald-50 px-2 py-1.5">
            <p className="text-emerald-600">Neto</p>
            <p className="font-semibold text-sm text-emerald-700">{slip.netTonnes.toFixed(3)} t</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span>Reģistrēts: {fmtDate(slip.createdAt)}</span>
          {slip.voidedAt && (
            <span className="text-destructive">
              Anulēts: {fmtDate(slip.voidedAt)}
              {slip.voidedReason ? ` — ${slip.voidedReason}` : ''}
            </span>
          )}
          {slip.notes && <span>Piezīme: {slip.notes}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function WeighingSlipsTab({ token }: { token: string }) {
  const [slips, setSlips] = useState<ApiWeighingSlip[]>([]);
  const [passes, setPasses] = useState<ApiFieldPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [voidSlip, setVoidSlip] = useState<ApiWeighingSlip | null>(null);
  // Create dialog state
  const [passSearch, setPassSearch] = useState('');
  const [selectedPassId, setSelectedPassId] = useState('');
  const [grossTonnes, setGrossTonnes] = useState('');
  const [tareTonnes, setTareTonnes] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorCompany, setOperatorCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  // Void dialog state
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getWeighingSlipsAdmin(token), getFieldPassesAdmin(token)]);
      setSlips(s);
      setPasses(p);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const filtered = slips.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.slipNumber.toLowerCase().includes(q) ||
      s.fieldPass?.passNumber.toLowerCase().includes(q) ||
      s.fieldPass?.vehiclePlate.toLowerCase().includes(q) ||
      s.operatorName?.toLowerCase().includes(q) ||
      false
    );
  });
  const totalNet = slips.filter((s) => !s.voidedAt).reduce((sum, s) => sum + s.netTonnes, 0);

  const filteredPasses = passes.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      (p.passNumber.toLowerCase().includes(passSearch.toLowerCase()) ||
        p.vehiclePlate.toLowerCase().includes(passSearch.toLowerCase())),
  );
  const netTonnesCalc = parseFloat(grossTonnes) - parseFloat(tareTonnes);

  const handleCreate = async () => {
    setCreateError('');
    if (!selectedPassId) return setCreateError('Izvēlieties caurlaidi');
    const gross = parseFloat(grossTonnes),
      tare = parseFloat(tareTonnes);
    if (isNaN(gross) || gross <= 0) return setCreateError('Ievadiet derīgu bruto svaru');
    if (isNaN(tare) || tare < 0) return setCreateError('Ievadiet derīgu tara svaru');
    if (tare >= gross) return setCreateError('Tara nevar būt lielāka vai vienāda ar bruto');
    setSaving(true);
    try {
      await createWeighingSlip(
        {
          passId: selectedPassId,
          grossTonnes: gross,
          tareTonnes: tare,
          operatorName: operatorName.trim() || undefined,
          operatorCompany: operatorCompany.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );
      setShowCreate(false);
      setSelectedPassId('');
      setGrossTonnes('');
      setTareTonnes('');
      setOperatorName('');
      setOperatorCompany('');
      setNotes('');
      load();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!voidSlip || !voidReason.trim()) return;
    setVoiding(true);
    try {
      await voidWeighingSlip(voidSlip.id, voidReason.trim(), token);
      setVoidSlip(null);
      setVoidReason('');
      load();
    } finally {
      setVoiding(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {slips.filter((s) => !s.voidedAt).length} derīgi akti · {totalNet.toFixed(2)} t
        </p>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Jauns akts
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Meklēt pēc numura, caurlaides, auto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nav svēršanas aktu"
          description="Reģistrējiet pirmo aktu, nospiežot pogu augšā."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SlipCard key={s.id} slip={s} onVoid={setVoidSlip} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => !v && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Jauns svēršanas akts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Caurlaide *</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Meklēt pēc numura vai auto..."
                  value={passSearch}
                  onChange={(e) => setPassSearch(e.target.value)}
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border p-1">
                {filteredPasses.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">Nav aktīvu caurlaiž</p>
                ) : (
                  filteredPasses.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPassId(p.id)}
                      className={`w-full text-left rounded px-2 py-1.5 text-sm transition-colors ${selectedPassId === p.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      <span className="font-medium">{p.passNumber}</span>
                      <span className="ml-2 text-xs opacity-70">{p.vehiclePlate}</span>
                      {p.driverName && (
                        <span className="ml-2 text-xs opacity-60">{p.driverName}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bruto svars (t) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="28.540"
                  value={grossTonnes}
                  onChange={(e) => setGrossTonnes(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tara svars (t) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="14.200"
                  value={tareTonnes}
                  onChange={(e) => setTareTonnes(e.target.value)}
                />
              </div>
            </div>
            {grossTonnes && tareTonnes && !isNaN(netTonnesCalc) && netTonnesCalc > 0 && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
                <span className="text-emerald-700 font-medium">Neto svars: </span>
                <span className="text-emerald-800 font-bold">{netTonnesCalc.toFixed(3)} t</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Operatora vārds</Label>
                <Input
                  placeholder="Jānis Bērziņš"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Uzņēmums</Label>
                <Input
                  placeholder="SIA Svari"
                  value={operatorCompany}
                  onChange={(e) => setOperatorCompany(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Piezīmes</Label>
              <Input
                placeholder="Papildu komentāri..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
              Atcelt
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Saglabāt aktu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void dialog */}
      <Dialog open={Boolean(voidSlip)} onOpenChange={(v) => !v && setVoidSlip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anulēt svēršanas aktu {voidSlip?.slipNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Anulēšana ir neatgriezeniska. Neto svars ({voidSlip?.netTonnes.toFixed(3)} t) tiks
              norakstīts no caurlaides patēriņa.
            </p>
            <div className="space-y-1.5">
              <Label>Anulēšanas iemesls *</Label>
              <Input
                placeholder="Piemērs: Svēršanas kļūda"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidSlip(null)} disabled={voiding}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={voiding || !voidReason.trim()}
            >
              {voiding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Anulēt aktu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

function FieldOpsHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token: rawToken, isLoading } = useAuth();
  const token = rawToken ?? '';
  const tab = searchParams.get('tab') ?? 'fields';

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Lauka operācijas"
        description="B3 Field punkti, piekļuves caurlaides un svēršanas akti"
      />
      <Tabs value={tab} onValueChange={(t) => router.push(`?tab=${t}`)}>
        <TabsList>
          <TabsTrigger value="fields">B3 Fields</TabsTrigger>
          <TabsTrigger value="passes">Caurlaides</TabsTrigger>
          <TabsTrigger value="slips">Svēršanas akti</TabsTrigger>
        </TabsList>
        <TabsContent value="fields">
          <B3FieldsTab token={token} />
        </TabsContent>
        <TabsContent value="passes">
          <FieldPassesTab token={token} />
        </TabsContent>
        <TabsContent value="slips">
          <WeighingSlipsTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FieldOpsHubPage() {
  return (
    <Suspense>
      <FieldOpsHubContent />
    </Suspense>
  );
}
