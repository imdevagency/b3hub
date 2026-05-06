/**
 * Admin recycling centers page — /dashboard/admin/recycling-centers
 * Platform-wide view of all registered waste processing facilities.
 * Admin can activate / deactivate centers and review throughput (waste records).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetRecyclingCenters,
  adminToggleRecyclingCenter,
  adminCreateRecyclingCenter,
  adminGetCompanies,
  adminGetPricingRules,
  adminUpsertPricingRule,
  adminDeletePricingRule,
  type AdminRecyclingCenter,
  type AdminCompany,
  type CreateRecyclingCenterInput,
  type AdminPricingRule,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Recycle,
  Search,
  CheckCircle2,
  XCircle,
  Trash2,
  Receipt,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Grunts',
  MIXED: 'Jaukti',
  HAZARDOUS: 'Bīstami',
  ASPHALT: 'Asfalta',
  GREEN_WASTE: 'Zaļais atkritums',
  WEEE: 'Elektronikas atkritumi',
  OIL_WASTE: 'Eļļas atkritumi',
  TIRES: 'Riepas',
  PACKAGING_WASTE: 'Iepakojuma atkritumi',
};

const ALL_WASTE_TYPES = Object.entries(WASTE_LABELS).map(([value, label]) => ({ value, label }));

const DAYS = [
  { key: 'monday', label: 'Pirmdiena' },
  { key: 'tuesday', label: 'Otrdiena' },
  { key: 'wednesday', label: 'Trešdiena' },
  { key: 'thursday', label: 'Ceturtdiena' },
  { key: 'friday', label: 'Piektdiena' },
  { key: 'saturday', label: 'Sestdiena' },
  { key: 'sunday', label: 'Svētdiena' },
];

const DEFAULT_HOURS: Record<string, { open: string; close: string } | null> = {
  monday: { open: '08:00', close: '17:00' },
  tuesday: { open: '08:00', close: '17:00' },
  wednesday: { open: '08:00', close: '17:00' },
  thursday: { open: '08:00', close: '17:00' },
  friday: { open: '08:00', close: '17:00' },
  saturday: null,
  sunday: null,
};

type OperatingHours = Record<string, { open: string; close: string } | null>;

// ─── Add Center Dialog ───────────────────────────────────────────────────────

function AddCenterDialog({
  open,
  onClose,
  companies,
  onCreated,
  token,
}: {
  open: boolean;
  onClose: () => void;
  companies: AdminCompany[];
  onCreated: (center: AdminRecyclingCenter) => void;
  token: string;
}) {
  const [companyId, setCompanyId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [capacity, setCapacity] = useState('');
  const [certifications, setCertifications] = useState('');
  const [licensed, setLicensed] = useState(false);
  const [licenceNumber, setLicenceNumber] = useState('');
  const [apusRegistrationId, setApusRegistrationId] = useState('');
  const [hours, setHours] = useState<OperatingHours>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showHours, setShowHours] = useState(false);

  const reset = () => {
    setCompanyId('');
    setName('');
    setAddress('');
    setCity('');
    setState('');
    setPostalCode('');
    setSelectedTypes([]);
    setCapacity('');
    setCertifications('');
    setLicensed(false);
    setLicenceNumber('');
    setApusRegistrationId('');
    setHours(DEFAULT_HOURS);
    setSaving(false);
    setErrors({});
    setShowHours(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleType = (type: string) =>
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );

  const toggleDay = (key: string) =>
    setHours((prev) => ({
      ...prev,
      [key]: prev[key] ? null : { open: '08:00', close: '17:00' },
    }));

  const setDayHour = (key: string, field: 'open' | 'close', value: string) =>
    setHours((prev) => ({
      ...prev,
      [key]: prev[key]
        ? { ...(prev[key] as { open: string; close: string }), [field]: value }
        : { open: '08:00', close: '17:00', [field]: value },
    }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!companyId) e.companyId = 'Izvēlieties uzņēmumu';
    if (name.trim().length < 2) e.name = 'Ievadiet nosaukumu';
    if (address.trim().length < 2) e.address = 'Ievadiet adresi';
    if (city.trim().length < 2) e.city = 'Ievadiet pilsētu';
    if (state.trim().length < 2) e.state = 'Ievadiet reģionu';
    if (postalCode.trim().length < 2) e.postalCode = 'Ievadiet pasta indeksu';
    if (selectedTypes.length === 0) e.types = 'Izvēlieties vismaz vienu atkritumu veidu';
    if (!capacity || isNaN(Number(capacity)) || Number(capacity) <= 0)
      e.capacity = 'Ievadiet jaudu (t/dienā)';
    if (licensed && !licenceNumber.trim()) e.licenceNumber = 'Ievadiet licences numuru';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: CreateRecyclingCenterInput = {
        companyId,
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        acceptedWasteTypes: selectedTypes,
        capacity: Number(capacity),
        certifications: certifications.trim()
          ? certifications
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        operatingHours: hours,
        licensed,
        licenceNumber: licensed && licenceNumber.trim() ? licenceNumber.trim() : undefined,
        apusRegistrationId:
          licensed && apusRegistrationId.trim() ? apusRegistrationId.trim() : undefined,
      };
      const created = await adminCreateRecyclingCenter(payload, token);
      onCreated(created);
      handleClose();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Neizdevās pievienot centru' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pievienot atkritumu partneri</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Uzņēmums *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Izvēlieties uzņēmumu..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.companyId && <p className="text-xs text-destructive">{errors.companyId}</p>}
          </div>

          <div className="space-y-1">
            <Label>Centra nosaukums *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="SIA Eko Centrs — Rīga"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Adrese *</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Brīvības iela 1"
              />
              {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
            </div>
            <div className="space-y-1">
              <Label>Pilsēta *</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Rīga" />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
            <div className="space-y-1">
              <Label>Reģions *</Label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Rīgas reģions"
              />
              {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
            </div>
            <div className="space-y-1">
              <Label>Pasta indekss *</Label>
              <Input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="LV-1001"
              />
              {errors.postalCode && <p className="text-xs text-destructive">{errors.postalCode}</p>}
            </div>
            <div className="space-y-1">
              <Label>Jauda (t/dienā) *</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="50"
              />
              {errors.capacity && <p className="text-xs text-destructive">{errors.capacity}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pieņemamie atkritumu veidi *</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_WASTE_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleType(value)}
                  className={[
                    'px-3 py-1 rounded-full text-sm border transition-colors',
                    selectedTypes.includes(value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.types && <p className="text-xs text-destructive">{errors.types}</p>}
          </div>

          <div className="space-y-1">
            <Label>
              Sertifikāti{' '}
              <span className="text-muted-foreground text-xs">(neobligāts, komatatdalīts)</span>
            </Label>
            <Input
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="ISO 14001, EN 12350"
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Switch checked={licensed} onCheckedChange={setLicensed} id="licensed-toggle" />
            <Label htmlFor="licensed-toggle" className="cursor-pointer">
              VVD licencēts pārstrādes uzņēmums
            </Label>
          </div>

          {licensed && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Licences numurs *</Label>
                <Input
                  value={licenceNumber}
                  onChange={(e) => setLicenceNumber(e.target.value)}
                  placeholder="VVD/RA/4-04/315"
                />
                {errors.licenceNumber && (
                  <p className="text-xs text-destructive">{errors.licenceNumber}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>
                  APUS reģistrācijas ID{' '}
                  <span className="text-muted-foreground text-xs">(neobligāts)</span>
                </Label>
                <Input
                  value={apusRegistrationId}
                  onChange={(e) => setApusRegistrationId(e.target.value)}
                  placeholder="APUS-12345"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowHours((v) => !v)}
          >
            {showHours ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Darba laiks {showHours ? '(paslēpt)' : '(rediģēt)'}
          </button>

          {showHours && (
            <div className="space-y-2 border rounded-lg p-3">
              {DAYS.map(({ key, label }) => {
                const dayVal = hours[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDay(key)}
                      className={[
                        'w-28 text-xs px-2 py-1 rounded border transition-colors text-left',
                        dayVal
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-border text-muted-foreground',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                    {dayVal ? (
                      <>
                        <Input
                          type="time"
                          value={dayVal.open}
                          onChange={(e) => setDayHour(key, 'open', e.target.value)}
                          className="w-32 text-sm"
                        />
                        <span className="text-muted-foreground text-sm">—</span>
                        <Input
                          type="time"
                          value={dayVal.close}
                          onChange={(e) => setDayHour(key, 'close', e.target.value)}
                          className="w-32 text-sm"
                        />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Slēgts</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {errors.submit && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              {errors.submit}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saglabā...' : 'Pievienot centru'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pricing Sheet ───────────────────────────────────────────────────────────

function PricingSheet({
  center,
  token,
  open,
  onClose,
}: {
  center: AdminRecyclingCenter;
  token: string;
  open: boolean;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<AdminPricingRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [form, setForm] = useState<{
    wasteType: string;
    pricePerTonne: string;
    minimumWeight: string;
    minimumFee: string;
    notes: string;
    accepted: boolean;
  }>({
    wasteType: '',
    pricePerTonne: '',
    minimumWeight: '',
    minimumFee: '',
    notes: '',
    accepted: true,
  });
  const [saving, setSaving] = useState(false);
  const [deletingType, setDeletingType] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open || !token) return;
    setLoadingRules(true);
    adminGetPricingRules(center.id, token)
      .then(setRules)
      .finally(() => setLoadingRules(false));
  }, [open, center.id, token]);

  const handleSave = async () => {
    const price = Number(form.pricePerTonne);
    if (!form.wasteType || !form.pricePerTonne || isNaN(price) || price < 0) {
      setFormError('Izvēlieties atkritumu veidu un ievadiet derīgu cenu');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const rule = await adminUpsertPricingRule(
        center.id,
        {
          wasteType: form.wasteType,
          pricePerTonne: price,
          minimumWeight: form.minimumWeight ? Number(form.minimumWeight) : undefined,
          minimumFee: form.minimumFee ? Number(form.minimumFee) : undefined,
          notes: form.notes.trim() || undefined,
          accepted: form.accepted,
        },
        token,
      );
      setRules((prev) => {
        const idx = prev.findIndex((r) => r.wasteType === rule.wasteType);
        return idx >= 0 ? prev.map((r, i) => (i === idx ? rule : r)) : [...prev, rule];
      });
      setForm({
        wasteType: '',
        pricePerTonne: '',
        minimumWeight: '',
        minimumFee: '',
        notes: '',
        accepted: true,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Neizdevās saglabāt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (wasteType: string) => {
    setDeletingType(wasteType);
    try {
      await adminDeletePricingRule(center.id, wasteType, token);
      setRules((prev) => prev.filter((r) => r.wasteType !== wasteType));
    } finally {
      setDeletingType(null);
    }
  };

  const availableTypes = ALL_WASTE_TYPES.filter((t) => center.acceptedWasteTypes.includes(t.value));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Tarifu pārvaldīšana — {center.name}</SheetTitle>
        </SheetHeader>

        {loadingRules ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-6">Nav pievienotu tarifu.</p>
        ) : (
          <div className="mb-6 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Atkritumu veids</TableHead>
                  <TableHead className="text-xs text-right">€/t</TableHead>
                  <TableHead className="text-xs text-right">Min. krava (t)</TableHead>
                  <TableHead className="text-xs text-right">Min. maksa (€)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.wasteType} className={!r.accepted ? 'opacity-50' : ''}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        {WASTE_LABELS[r.wasteType] ?? r.wasteType}
                        {!r.accepted && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1 py-0 text-red-500 border-red-300"
                          >
                            Nepieņem
                          </Badge>
                        )}
                      </div>
                      {r.notes && <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {r.pricePerTonne.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-right">{r.minimumWeight ?? '—'}</TableCell>
                    <TableCell className="text-sm text-right">
                      {r.minimumFee != null ? r.minimumFee.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        disabled={deletingType === r.wasteType}
                        onClick={() => handleDelete(r.wasteType)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add / edit form */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
          <p className="text-sm font-medium">Pievienot / rediģēt tarifu</p>
          <div className="space-y-1">
            <Label className="text-xs">Atkritumu veids *</Label>
            <Select
              value={form.wasteType}
              onValueChange={(v) => setForm((f) => ({ ...f, wasteType: v }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Izvēlieties..." />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cena (€/t) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-sm"
                value={form.pricePerTonne}
                onChange={(e) => setForm((f) => ({ ...f, pricePerTonne: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min. krava (t)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                className="h-8 text-sm"
                value={form.minimumWeight}
                onChange={(e) => setForm((f) => ({ ...f, minimumWeight: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min. maksa (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="h-8 text-sm"
                value={form.minimumFee}
                onChange={(e) => setForm((f) => ({ ...f, minimumFee: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div className="space-y-1 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={form.accepted}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, accepted: v }))}
                />
                <span className="text-xs text-muted-foreground">Pieņem šo veidu</span>
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Piezīmes</Label>
            <Input
              className="h-8 text-sm"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Piemēram: Keramika nav pieņemta"
            />
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saglabā...' : 'Saglabāt tarifu'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function CenterRow({
  center,
  token,
  onToggled,
  onTarifi,
}: {
  center: AdminRecyclingCenter;
  token: string;
  onToggled: (id: string, active: boolean) => void;
  onTarifi: (center: AdminRecyclingCenter) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await adminToggleRecyclingCenter(center.id, !center.active, token);
      onToggled(center.id, !center.active);
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          {center.active ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{center.name}</p>
              {center.licensed && (
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0 border-green-500 text-green-700"
                >
                  VVD
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {center.address}, {center.city}
            </p>
            {center.licenceNumber && (
              <p className="text-xs text-muted-foreground">Lic: {center.licenceNumber}</p>
            )}
            {center.apusRegistrationId && (
              <p className="text-xs text-muted-foreground">APUS: {center.apusRegistrationId}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm">{center.company.name}</p>
        <p className="text-xs text-muted-foreground">{center.company.city}</p>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 max-w-55">
          {center.acceptedWasteTypes.slice(0, 4).map((wt) => (
            <Badge key={wt} variant="outline" className="text-xs px-1.5 py-0">
              {WASTE_LABELS[wt] ?? wt}
            </Badge>
          ))}
          {center.acceptedWasteTypes.length > 4 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              +{center.acceptedWasteTypes.length - 4}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-right">
        {center.capacity.toLocaleString('lv-LV')} t/d
      </TableCell>
      <TableCell className="text-sm text-right font-medium">
        {center._count.wasteRecords.toLocaleString('lv-LV')}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => onTarifi(center)}
          >
            <Receipt className="h-3.5 w-3.5 mr-1" />
            Tarifi
          </Button>
          <span className="text-xs text-muted-foreground">
            {center.active ? 'Aktīvs' : 'Neaktīvs'}
          </span>
          <Switch
            checked={center.active}
            onCheckedChange={toggle}
            disabled={busy}
            aria-label="Toggle recycling center active"
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRecyclingCentersPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [rows, setRows] = useState<AdminRecyclingCenter[]>([]);
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hideInactive, setHideInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pricingCenter, setPricingCenter] = useState<AdminRecyclingCenter | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [data, comps] = await Promise.all([
        adminGetRecyclingCenters(token),
        adminGetCompanies(token),
      ]);
      setRows(data);
      setCompanies(comps);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const filtered = rows.filter((r) => {
    if (hideInactive && !r.active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.company.name.toLowerCase().includes(q)
    );
  });

  const total = rows.length;
  const active = rows.filter((r) => r.active).length;
  const totalCapacity = rows.filter((r) => r.active).reduce((s, r) => s + r.capacity, 0);
  const totalRecords = rows.reduce((s, r) => s + r._count.wasteRecords, 0);

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizācijas centri"
        description="Atkritumu pieņemšanas un apstrādes centri. Pievieno, aktivizē, deaktivizē objektus."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot partneri
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Kopā centri', value: total, color: 'text-foreground' },
          { label: 'Aktīvi', value: active, color: 'text-green-600' },
          {
            label: 'Jauda (aktīvi)',
            value: `${totalCapacity.toLocaleString('lv-LV')} t/d`,
            color: 'text-blue-600',
          },
          {
            label: 'Atkritumu ieraksti',
            value: totalRecords.toLocaleString('lv-LV'),
            color: 'text-purple-600',
          },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Meklēt nosaukumu, pilsētu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Switch
            checked={hideInactive}
            onCheckedChange={setHideInactive}
            aria-label="Hide inactive centers"
          />
          Slēpt neaktīvos
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Recycle}
          title="Nav utilizācijas centru"
          description="Pievienojiet pirmo atkritumu partneri, noklikšķinot uz 'Pievienot partneri'."
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centrs</TableHead>
                <TableHead>Uzņēmums</TableHead>
                <TableHead>Pieņemtie atkritumi</TableHead>
                <TableHead className="text-right">Jauda</TableHead>
                <TableHead className="text-right">Ieraksti</TableHead>
                <TableHead className="text-right">Darbības</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((center) => (
                <CenterRow
                  key={center.id}
                  center={center}
                  token={token}
                  onToggled={(id, active) =>
                    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)))
                  }
                  onTarifi={setPricingCenter}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AddCenterDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        companies={companies}
        onCreated={(center) => setRows((prev) => [center, ...prev])}
        token={token}
      />
      {pricingCenter && (
        <PricingSheet
          center={pricingCenter}
          token={token}
          open={!!pricingCenter}
          onClose={() => setPricingCenter(null)}
        />
      )}
    </div>
  );
}
