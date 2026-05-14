/**
 * Equipment Rental Listing — Edit Wizard
 * /dashboard/equipment-rentals/catalog/[id]/edit
 *
 * Loads an existing listing, pre-fills the same 5-step wizard used for creation,
 * and calls updateRentalListing on submit.
 *
 * This prevents data loss from the old 8-field sidesheet which wiped all
 * rich fields (add-ons, insurance, specs, policies) on every save.
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getRentalListing,
  updateRentalListing,
  type RentalListing,
  type RentalServiceType,
  type CreateRentalListingPayload,
} from '@/lib/api/rentals';
import type { AddOnDef, InsuranceDef, DocumentUrls, RequiredDocuments } from '@/lib/api/rentals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { PageSpinner } from '@/components/ui/page-spinner';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<RentalServiceType, string> = {
  MINI_EXCAVATOR: 'Mini ekskavators',
  EXCAVATOR: 'Ekskavators',
  DUMPER: 'Dempera pašizgāzējs',
  COMPACTOR: 'Kompaktors / rullītis',
  TELEHANDLER: 'Teleskopiskā iekrāvējs',
  AERIAL_PLATFORM: 'Pacēlājs / platforma',
  SCAFFOLDING: 'Sastatnes',
  TEMP_FENCING: 'Pagaidu žogs',
  SITE_OFFICE: 'Mobilā büvnieku mājiņa',
  GENERATOR: 'Ģenerators',
  LIGHTING_TOWER: 'Apgaismojuma tornis',
  WATER_BOWSER: 'Ūdens cisternas',
  AIR_COMPRESSOR: 'Gaisa kompresors',
  POWER_TOOLS: 'Elektroinstrumenti',
  WELDER: 'Metināšanas iekārta',
  HEATER: 'Sildītājs',
  CONCRETE_EQUIPMENT: 'Betona iekārtas',
  REBAR_EQUIPMENT: 'Armatūras iekārtas',
  ALUMINUM_TOWER: 'Alumīnija tornis',
};

const FUEL_POLICY_OPTIONS = [
  { value: 'FULL_TO_FULL', label: 'Pilns-uz-pilnu' },
  { value: 'INCLUDED', label: 'Degviela iekļauta cenā' },
  { value: 'CHARGED_ON_RETURN', label: 'Maksājums pēc atgriešanas' },
];

const CANCEL_POLICY_OPTIONS = [
  { value: 'FREE_UNTIL_48H', label: 'Bezmaksas atcelšana līdz 48h pirms piegādes' },
  { value: 'FREE_UNTIL_24H', label: 'Bezmaksas atcelšana līdz 24h pirms piegādes' },
  { value: 'NON_REFUNDABLE', label: 'Neatmaksājama rezervācija' },
];

const DEPOSIT_METHOD_OPTIONS = [
  { value: 'ONLINE_BEFORE', label: 'Maksājams online pirms piegādes' },
  { value: 'ON_DELIVERY', label: 'Maksājams piegādes brīdī' },
  { value: 'NONE', label: 'Nav depozīta' },
];

const ADDON_CATEGORIES = [
  { value: 'ACCESSORY', label: 'Piederumi' },
  { value: 'OPERATOR', label: 'Operators' },
  { value: 'TRANSPORT', label: 'Transports' },
  { value: 'FUEL', label: 'Degviela' },
  { value: 'OTHER', label: 'Cits' },
] as const;

// ── Wizard steps ──────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Pamata info' },
  { n: 2, label: 'Cena & noma' },
  { n: 3, label: 'Piegāde' },
  { n: 4, label: 'Papildinājumi' },
  { n: 5, label: 'Politika & Saglabāt' },
] as const;

type WizardStep = (typeof STEPS)[number]['n'];

// ── Spec row ──────────────────────────────────────────────────────────────────

interface SpecRow {
  key: string;
  value: string;
}

// ── Wizard state ──────────────────────────────────────────────────────────────

interface WizardState {
  serviceType: RentalServiceType;
  subCategoryLabel: string;
  name: string;
  productCode: string;
  yearOfManufacture: string;
  description: string;
  specs: SpecRow[];
  imageUrls: string[];
  newImageUrl: string;
  pricePerDay: string;
  vatRate: string;
  unitLabel: string;
  quantityTotal: string;
  minHireDays: string;
  maxHireDays: string;
  coverageCities: string;
  deliveryRadiusKm: string;
  freeDeliveryRadiusKm: string;
  deliveryFeePerKm: string;
  selfCollectAvailable: boolean;
  selfCollectAddress: string;
  addOns: AddOnDef[];
  newAddOn: Partial<AddOnDef>;
  insuranceOptions: InsuranceDef[];
  newInsurance: Partial<InsuranceDef>;
  insuranceRequired: boolean;
  depositAmount: string;
  depositMethod: string;
  fuelPolicy: string;
  cancellationPolicy: string;
  lateReturnFeePerDay: string;
  requiredLicenseType: string;
  ownInsuranceRequired: boolean;
  siteInductionRequired: boolean;
  docCe: string;
  docInspection: string;
  docManual: string;
  isActive: boolean;
}

const EMPTY: WizardState = {
  serviceType: 'MINI_EXCAVATOR',
  subCategoryLabel: '',
  name: '',
  productCode: '',
  yearOfManufacture: '',
  description: '',
  specs: [],
  imageUrls: [],
  newImageUrl: '',
  pricePerDay: '',
  vatRate: '21',
  unitLabel: 'mašīna',
  quantityTotal: '1',
  minHireDays: '1',
  maxHireDays: '30',
  coverageCities: '',
  deliveryRadiusKm: '',
  freeDeliveryRadiusKm: '',
  deliveryFeePerKm: '',
  selfCollectAvailable: false,
  selfCollectAddress: '',
  addOns: [],
  newAddOn: { category: 'ACCESSORY', minQty: 0, maxQty: 1 },
  insuranceOptions: [],
  newInsurance: { pricePerDay: 0, excess: 0, coversTheft: false, coversThirdParty: false },
  insuranceRequired: false,
  depositAmount: '',
  depositMethod: 'NONE',
  fuelPolicy: '',
  cancellationPolicy: '',
  lateReturnFeePerDay: '',
  requiredLicenseType: '',
  ownInsuranceRequired: false,
  siteInductionRequired: false,
  docCe: '',
  docInspection: '',
  docManual: '',
  isActive: true,
};

function listingToState(l: RentalListing): WizardState {
  const specs: SpecRow[] = l.specs
    ? Object.entries(l.specs as Record<string, string>).map(([key, value]) => ({ key, value }))
    : [];

  return {
    ...EMPTY,
    serviceType: l.serviceType,
    subCategoryLabel: l.subCategoryLabel ?? '',
    name: l.name,
    productCode: l.productCode ?? '',
    yearOfManufacture: l.yearOfManufacture ? String(l.yearOfManufacture) : '',
    description: l.description ?? '',
    specs,
    imageUrls: l.imageUrls ?? [],
    pricePerDay: String(l.pricePerDay),
    vatRate: l.vatRate != null ? String(l.vatRate) : '21',
    unitLabel: l.unitLabel,
    quantityTotal: String(l.quantityTotal),
    minHireDays: l.minHireDays != null ? String(l.minHireDays) : '1',
    maxHireDays: l.maxHireDays != null ? String(l.maxHireDays) : '',
    coverageCities: l.coverageCities.join(', '),
    deliveryRadiusKm: l.deliveryRadiusKm != null ? String(l.deliveryRadiusKm) : '',
    freeDeliveryRadiusKm: l.freeDeliveryRadiusKm != null ? String(l.freeDeliveryRadiusKm) : '',
    deliveryFeePerKm: l.deliveryFeePerKm != null ? String(l.deliveryFeePerKm) : '',
    selfCollectAvailable: l.selfCollectAvailable ?? false,
    selfCollectAddress: l.selfCollectAddress ?? '',
    addOns: l.addOns ?? [],
    insuranceOptions: l.insuranceOptions ?? [],
    insuranceRequired: l.insuranceRequired ?? false,
    depositAmount: l.depositAmount != null ? String(l.depositAmount) : '',
    depositMethod: l.depositMethod ?? 'NONE',
    fuelPolicy: l.fuelPolicy ?? '',
    cancellationPolicy: l.cancellationPolicy ?? '',
    lateReturnFeePerDay: l.lateReturnFeePerDay != null ? String(l.lateReturnFeePerDay) : '',
    requiredLicenseType: l.requiredDocuments?.licenseType ?? '',
    ownInsuranceRequired: l.requiredDocuments?.ownInsuranceRequired ?? false,
    siteInductionRequired: l.requiredDocuments?.siteInductionRequired ?? false,
    docCe: l.documentUrls?.ce ?? '',
    docInspection: l.documentUrls?.inspection ?? '',
    docManual: l.documentUrls?.manual ?? '',
    isActive: l.isActive,
  };
}

// ── Step indicator ────────────────────────────────────────────────────────────

function WizardStepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center gap-0 flex-wrap gap-y-2">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.n}>
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium',
              current === s.n
                ? 'text-foreground'
                : current > s.n
                  ? 'text-primary'
                  : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border shrink-0',
                current === s.n
                  ? 'bg-primary border-primary text-primary-foreground'
                  : current > s.n
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted border-border text-muted-foreground',
              )}
            >
              {current > s.n ? <CheckCircle2 className="size-3.5" /> : s.n}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn('h-px w-8 mx-2', current > s.n ? 'bg-primary/40' : 'bg-border')} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, hint, children, required }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Info className="size-3 shrink-0 mt-0.5" />{hint}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold tracking-tight">{children}</h2>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EditListingWizardPage() {
  const { id } = useParams<{ id: string }>();
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<WizardState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load existing listing and pre-fill form
  useEffect(() => {
    if (!id) return;
    getRentalListing(id)
      .then((listing) => setForm(listingToState(listing)))
      .catch(() => setFetchError('Neizdevās ielādēt iekārtas datus.'))
      .finally(() => setFetchLoading(false));
  }, [id]);

  useEffect(() => {
    if (!authLoading && !token) router.push('/');
  }, [token, authLoading, router]);

  const set = <K extends keyof WizardState>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setBool = <K extends keyof WizardState>(k: K) =>
    (v: boolean) =>
      setForm((f) => ({ ...f, [k]: v }));

  const step1Valid = !!form.name.trim() && !!form.serviceType;
  const priceNum = parseFloat(form.pricePerDay);
  const step2Valid = !isNaN(priceNum) && priceNum > 0;

  // ── Spec rows ─────────────────────────────────────────────────────────────

  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  function addSpec() {
    if (!newSpecKey.trim()) return;
    setForm((f) => ({ ...f, specs: [...f.specs, { key: newSpecKey.trim(), value: newSpecVal.trim() }] }));
    setNewSpecKey('');
    setNewSpecVal('');
  }

  function removeSpec(i: number) {
    setForm((f) => ({ ...f, specs: f.specs.filter((_, idx) => idx !== i) }));
  }

  // ── Image URLs ────────────────────────────────────────────────────────────

  function addImage() {
    const url = form.newImageUrl.trim();
    if (!url) return;
    setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, url], newImageUrl: '' }));
  }

  function removeImage(i: number) {
    setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((_, idx) => idx !== i) }));
  }

  // ── Add-ons ───────────────────────────────────────────────────────────────

  function addAddOn() {
    const { id: aId, name, category, minQty, maxQty } = form.newAddOn;
    if (!aId?.trim() || !name?.trim()) return;
    const def: AddOnDef = {
      id: aId.trim(),
      name: name.trim(),
      description: form.newAddOn.description,
      category: category ?? 'ACCESSORY',
      minQty: minQty ?? 0,
      maxQty: maxQty ?? 1,
      pricePerDay: form.newAddOn.pricePerDay,
      priceFlat: form.newAddOn.priceFlat,
    };
    setForm((f) => ({
      ...f,
      addOns: [...f.addOns, def],
      newAddOn: { category: 'ACCESSORY', minQty: 0, maxQty: 1 },
    }));
  }

  function removeAddOn(i: number) {
    setForm((f) => ({ ...f, addOns: f.addOns.filter((_, idx) => idx !== i) }));
  }

  // ── Insurance ─────────────────────────────────────────────────────────────

  function addInsurance() {
    const { id: iId, name, description, pricePerDay } = form.newInsurance;
    if (!iId?.trim() || !name?.trim() || description == null) return;
    const def: InsuranceDef = {
      id: iId.trim(),
      name: name.trim(),
      description: description ?? '',
      pricePerDay: pricePerDay ?? 0,
      excess: form.newInsurance.excess ?? 0,
      coversTheft: form.newInsurance.coversTheft ?? false,
      coversThirdParty: form.newInsurance.coversThirdParty ?? false,
    };
    setForm((f) => ({
      ...f,
      insuranceOptions: [...f.insuranceOptions, def],
      newInsurance: { pricePerDay: 0, excess: 0, coversTheft: false, coversThirdParty: false },
    }));
  }

  function removeInsurance(i: number) {
    setForm((f) => ({ ...f, insuranceOptions: f.insuranceOptions.filter((_, idx) => idx !== i) }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!token || !id) return;
    setSubmitting(true);
    setError('');

    const specs: Record<string, string> = {};
    for (const row of form.specs) {
      if (row.key) specs[row.key] = row.value;
    }

    const docUrls: DocumentUrls = {};
    if (form.docCe) docUrls.ce = form.docCe;
    if (form.docInspection) docUrls.inspection = form.docInspection;
    if (form.docManual) docUrls.manual = form.docManual;

    const requiredDocs: RequiredDocuments = {};
    if (form.requiredLicenseType) requiredDocs.licenseType = form.requiredLicenseType;
    if (form.ownInsuranceRequired) requiredDocs.ownInsuranceRequired = true;
    if (form.siteInductionRequired) requiredDocs.siteInductionRequired = true;

    const payload: CreateRentalListingPayload = {
      serviceType: form.serviceType,
      name: form.name.trim(),
      subCategoryLabel: form.subCategoryLabel.trim() || undefined,
      productCode: form.productCode.trim() || undefined,
      yearOfManufacture: form.yearOfManufacture ? parseInt(form.yearOfManufacture) : undefined,
      description: form.description.trim() || undefined,
      specs: Object.keys(specs).length > 0 ? specs : undefined,
      imageUrls: form.imageUrls.length > 0 ? form.imageUrls : undefined,
      documentUrls: Object.keys(docUrls).length > 0 ? docUrls : undefined,
      pricePerDay: parseFloat(form.pricePerDay),
      vatRate: parseFloat(form.vatRate) || 21,
      unitLabel: form.unitLabel.trim() || 'mašīna',
      quantityTotal: parseInt(form.quantityTotal) || 1,
      minHireDays: parseInt(form.minHireDays) || 1,
      maxHireDays: form.maxHireDays ? parseInt(form.maxHireDays) : undefined,
      coverageCities: form.coverageCities.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean),
      deliveryRadiusKm: form.deliveryRadiusKm ? parseFloat(form.deliveryRadiusKm) : undefined,
      freeDeliveryRadiusKm: form.freeDeliveryRadiusKm ? parseFloat(form.freeDeliveryRadiusKm) : undefined,
      deliveryFeePerKm: form.deliveryFeePerKm ? parseFloat(form.deliveryFeePerKm) : undefined,
      selfCollectAvailable: form.selfCollectAvailable,
      selfCollectAddress: form.selfCollectAvailable && form.selfCollectAddress ? form.selfCollectAddress : undefined,
      addOns: form.addOns.length > 0 ? form.addOns : undefined,
      insuranceOptions: form.insuranceOptions.length > 0 ? form.insuranceOptions : undefined,
      insuranceRequired: form.insuranceRequired,
      depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : undefined,
      depositMethod: form.depositMethod !== 'NONE' ? form.depositMethod : undefined,
      fuelPolicy: form.fuelPolicy || undefined,
      cancellationPolicy: form.cancellationPolicy || undefined,
      lateReturnFeePerDay: form.lateReturnFeePerDay ? parseFloat(form.lateReturnFeePerDay) : undefined,
      requiredDocuments: Object.keys(requiredDocs).length > 0 ? requiredDocs : undefined,
      isActive: form.isActive,
    };

    try {
      await updateRentalListing(id, payload, token);
      router.push('/dashboard/equipment-rentals/catalog');
    } catch {
      setError('Saglabāšana neizdevās. Pārbaudiet datus un mēģiniet vēlreiz.');
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (fetchLoading) return <PageSpinner />;

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {fetchError}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/equipment-rentals/catalog')}>
          <ChevronLeft className="size-4 mr-1" /> Atpakaļ
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/dashboard/equipment-rentals/catalog')}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
        >
          <ChevronLeft className="size-4" /> Atpakaļ uz katalogu
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight">Rediģēt iekārtu</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rediģējiet iekārtas datus — visas izmaiņas tiks saglabātas pēc publicēšanas.
        </p>
      </div>

      {/* Step indicator */}
      <WizardStepIndicator current={step} />

      <Separator />

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── STEP 1: Basic info ─────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <SectionTitle>Iekārtas identitāte</SectionTitle>

          <Field label="Iekārtas tips" required>
            <Select
              value={form.serviceType}
              onValueChange={(v) => setForm((f) => ({ ...f, serviceType: v as RentalServiceType }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SERVICE_TYPE_LABELS) as [RentalServiceType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Sludinājuma nosaukums" required hint="piem. CAT 308 CR Mini Excavator 2022 | Riga">
            <Input placeholder="CAT 308 CR Mini Excavator" value={form.name} onChange={set('name')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Apakškategorija" hint="piem. MINI EKSKAVATORS 1-3T">
              <Input placeholder="MINI EKSKAVATORS 1-3T" value={form.subCategoryLabel} onChange={set('subCategoryLabel')} />
            </Field>
            <Field label="Produkta kods" hint="Ražotāja modelis">
              <Input placeholder="CAT308CR" value={form.productCode} onChange={set('productCode')} />
            </Field>
          </div>

          <Field label="Ražošanas gads">
            <Input
              type="number"
              placeholder="2022"
              value={form.yearOfManufacture}
              onChange={set('yearOfManufacture')}
              min={1980}
              max={new Date().getFullYear()}
            />
          </Field>

          <Field label="Apraksts">
            <Textarea
              placeholder="Aprakstiet iekārtas stāvokli, iespējas, pielietojumu..."
              rows={4}
              value={form.description}
              onChange={set('description')}
            />
          </Field>

          {/* Specs builder */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tehniskie parametri</Label>
            {form.specs.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {form.specs.map((s, i) => (
                      <tr key={i} className="even:bg-muted/20">
                        <th className="px-4 py-2.5 font-medium text-left w-2/5">{s.key}</th>
                        <td className="px-4 py-2.5 text-muted-foreground">{s.value}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => removeSpec(i)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Parametrs (piem. Jauda)"
                value={newSpecKey}
                onChange={(e) => setNewSpecKey(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Vērtība (piem. 38 kW)"
                value={newSpecVal}
                onChange={(e) => setNewSpecVal(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={addSpec}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {/* Image URLs */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Fotoattēli (URL)</Label>
            {form.imageUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground truncate border border-border rounded-lg px-3 py-2 bg-muted/30">
                  {url}
                </span>
                <button onClick={() => removeImage(i)} className="text-destructive shrink-0">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/image.jpg"
                value={form.newImageUrl}
                onChange={(e) => setForm((f) => ({ ...f, newImageUrl: e.target.value }))}
                className="flex-1"
              />
              <Button variant="outline" onClick={addImage} disabled={!form.newImageUrl.trim()}>
                <Plus className="size-4 mr-1.5" /> Pievienot
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: Pricing ─────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <SectionTitle>Cena un nomas periods</SectionTitle>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cena dienā (€)" required>
              <Input type="number" placeholder="150.00" value={form.pricePerDay} onChange={set('pricePerDay')} min={0} step={0.01} />
            </Field>
            <Field label="PVN likme (%)" hint="Parasti 21%">
              <Input type="number" placeholder="21" value={form.vatRate} onChange={set('vatRate')} min={0} max={100} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mērvienības apzīmējums" hint="piem. mašīna, vienība">
              <Input placeholder="mašīna" value={form.unitLabel} onChange={set('unitLabel')} />
            </Field>
            <Field label="Pieejamie daudzumi">
              <Input type="number" placeholder="1" value={form.quantityTotal} onChange={set('quantityTotal')} min={1} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Min. nomas dienas" hint="Minimālais nomas periods">
              <Input type="number" placeholder="1" value={form.minHireDays} onChange={set('minHireDays')} min={1} />
            </Field>
            <Field label="Maks. nomas dienas" hint="Atstāj tukšu = neierobežots">
              <Input type="number" placeholder="30" value={form.maxHireDays} onChange={set('maxHireDays')} min={1} />
            </Field>
          </div>

          {/* Price preview */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cena dienā (bez PVN)</span>
                  <span className="font-medium">€{parseFloat(form.pricePerDay || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PVN {form.vatRate}%</span>
                  <span className="font-medium">
                    €{(parseFloat(form.pricePerDay || '0') * parseFloat(form.vatRate || '0') / 100).toFixed(2)}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-sm font-bold">
                  <span>Kopā ar PVN / dienā</span>
                  <span>
                    €{(parseFloat(form.pricePerDay || '0') * (1 + parseFloat(form.vatRate || '0') / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── STEP 3: Delivery ─────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <SectionTitle>Piegāde un seguma zona</SectionTitle>

          <Field label="Piegādes pilsētas" hint="Komatatdalīts saraksts (piem. riga, jelgava, ogre)">
            <Textarea
              placeholder="riga, jelgava, ogre"
              rows={2}
              value={form.coverageCities}
              onChange={set('coverageCities')}
            />
          </Field>

          <Field label="Piegādes rādiuss (km)" hint="Maksimālais attālums no Jūsu bāzes">
            <Input type="number" placeholder="50" value={form.deliveryRadiusKm} onChange={set('deliveryRadiusKm')} min={0} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Bezmaksas piegādes rādiuss (km)" hint="Attālums, kur piegāde bez maksas">
              <Input type="number" placeholder="15" value={form.freeDeliveryRadiusKm} onChange={set('freeDeliveryRadiusKm')} min={0} />
            </Field>
            <Field label="Piegādes maksa par km (€)" hint="Ārpus bezmaksas rādiusa">
              <Input type="number" placeholder="1.50" value={form.deliveryFeePerKm} onChange={set('deliveryFeePerKm')} min={0} step={0.01} />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Pašizgādes iespēja</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Klients var paņemt iekārtu pats</p>
              </div>
              <Switch checked={form.selfCollectAvailable} onCheckedChange={setBool('selfCollectAvailable')} />
            </div>
            {form.selfCollectAvailable && (
              <Field label="Pašizgādes adrese">
                <Input
                  placeholder="piem. Brīvības iela 1, Rīga"
                  value={form.selfCollectAddress}
                  onChange={set('selfCollectAddress')}
                />
              </Field>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 4: Add-ons & Insurance ───────────────────────────── */}
      {step === 4 && (
        <div className="space-y-8">
          {/* Add-ons */}
          <div className="space-y-4">
            <SectionTitle>Papildinājumi (Add-ons)</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Pievienojiet papildaprīkojumu vai pakalpojumus, ko pircējs var izvēlēties rezervācijas laikā.
            </p>

            {form.addOns.length > 0 && (
              <div className="space-y-2">
                {form.addOns.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.pricePerDay != null ? `€${a.pricePerDay}/d.` : a.priceFlat != null ? `€${a.priceFlat}` : 'Iekļauts'} ·{' '}
                        {ADDON_CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category}
                      </p>
                    </div>
                    <button onClick={() => removeAddOn(i)} className="text-destructive shrink-0">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New add-on form */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pievienot papildinājumu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID (unikāls)" required>
                    <Input
                      placeholder="operator-included"
                      value={form.newAddOn.id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, newAddOn: { ...f.newAddOn, id: e.target.value } }))}
                    />
                  </Field>
                  <Field label="Nosaukums" required>
                    <Input
                      placeholder="Operators iekļauts"
                      value={form.newAddOn.name ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, newAddOn: { ...f.newAddOn, name: e.target.value } }))}
                    />
                  </Field>
                </div>

                <Field label="Apraksts">
                  <Input
                    placeholder="Īss skaidrojums"
                    value={form.newAddOn.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, newAddOn: { ...f.newAddOn, description: e.target.value } }))}
                  />
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Kategorija">
                    <Select
                      value={form.newAddOn.category ?? 'ACCESSORY'}
                      onValueChange={(v) => setForm((f) => ({ ...f, newAddOn: { ...f.newAddOn, category: v as AddOnDef['category'] } }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDON_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cena/dienā (€)" hint="vai tukšs">
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.newAddOn.pricePerDay ?? ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        newAddOn: { ...f.newAddOn, pricePerDay: e.target.value ? parseFloat(e.target.value) : undefined },
                      }))}
                    />
                  </Field>
                  <Field label="Vienreizēja cena (€)">
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.newAddOn.priceFlat ?? ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        newAddOn: { ...f.newAddOn, priceFlat: e.target.value ? parseFloat(e.target.value) : undefined },
                      }))}
                    />
                  </Field>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAddOn}
                  disabled={!form.newAddOn.id?.trim() || !form.newAddOn.name?.trim()}
                >
                  <Plus className="size-3.5 mr-1.5" /> Pievienot papildinājumu
                </Button>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Insurance */}
          <div className="space-y-4">
            <SectionTitle>Apdrošināšanas plāni</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Norādiet apdrošināšanas iespējas, ko pircējs var izvēlēties. Bez plāniem apdrošināšana netiks piedāvāta.
            </p>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Apdrošināšana obligāta</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Pircējs nevar rezervēt bez apdrošināšanas</p>
              </div>
              <Switch checked={form.insuranceRequired} onCheckedChange={setBool('insuranceRequired')} />
            </div>

            {form.insuranceOptions.length > 0 && (
              <div className="space-y-2">
                {form.insuranceOptions.map((ins, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{ins.name}</p>
                      <p className="text-xs text-muted-foreground">
                        €{ins.pricePerDay}/d. · Pašrisks: {ins.excess != null ? `€${ins.excess}` : '—'}
                        {ins.coversTheft && ' · Zādzības segums'}
                        {ins.coversThirdParty && ' · 3. puses atbildība'}
                      </p>
                    </div>
                    <button onClick={() => removeInsurance(i)} className="text-destructive shrink-0">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pievienot apdrošināšanas plānu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ID (unikāls)" required>
                    <Input
                      placeholder="basic-insurance"
                      value={form.newInsurance.id ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, newInsurance: { ...f.newInsurance, id: e.target.value } }))}
                    />
                  </Field>
                  <Field label="Nosaukums" required>
                    <Input
                      placeholder="Pamata apdrošināšana"
                      value={form.newInsurance.name ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, newInsurance: { ...f.newInsurance, name: e.target.value } }))}
                    />
                  </Field>
                </div>
                <Field label="Apraksts" required>
                  <Input
                    placeholder="Sedz bojājumus līdz €5000"
                    value={form.newInsurance.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, newInsurance: { ...f.newInsurance, description: e.target.value } }))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cena/dienā (€)" required>
                    <Input
                      type="number"
                      placeholder="15.00"
                      value={form.newInsurance.pricePerDay ?? ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        newInsurance: { ...f.newInsurance, pricePerDay: parseFloat(e.target.value) || 0 },
                      }))}
                    />
                  </Field>
                  <Field label="Pašrisks (€)">
                    <Input
                      type="number"
                      placeholder="500"
                      value={form.newInsurance.excess ?? ''}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        newInsurance: { ...f.newInsurance, excess: e.target.value ? parseFloat(e.target.value) : undefined },
                      }))}
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={form.newInsurance.coversTheft ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, newInsurance: { ...f.newInsurance, coversTheft: v } }))}
                    />
                    Zādzības segums
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={form.newInsurance.coversThirdParty ?? false}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, newInsurance: { ...f.newInsurance, coversThirdParty: v } }))}
                    />
                    Trešo personu atbildība
                  </label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addInsurance}
                  disabled={!form.newInsurance.id?.trim() || !form.newInsurance.name?.trim() || !form.newInsurance.description?.trim()}
                >
                  <Plus className="size-3.5 mr-1.5" /> Pievienot plānu
                </Button>
              </CardContent>
            </Card>

            {/* Deposit */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Drošības depozīts (€)" hint="0 = nav depozīta">
                <Input type="number" placeholder="500" value={form.depositAmount} onChange={set('depositAmount')} min={0} step={0.01} />
              </Field>
              <Field label="Depozīta apmaksas veids">
                <Select value={form.depositMethod} onValueChange={(v) => setForm((f) => ({ ...f, depositMethod: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPOSIT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5: Policies & Save ───────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-6">
          <SectionTitle>Politika un saglabāšana</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Degvielas politika">
              <Select
                value={form.fuelPolicy || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, fuelPolicy: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlieties..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nav norādīts —</SelectItem>
                  {FUEL_POLICY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Atcelšanas politika">
              <Select
                value={form.cancellationPolicy || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, cancellationPolicy: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlieties..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nav norādīts —</SelectItem>
                  {CANCEL_POLICY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Vēlīnas atgriešanas maksa (€/dienā)" hint="Maksa par katru papildu dienu">
            <Input type="number" placeholder="50" value={form.lateReturnFeePerDay} onChange={set('lateReturnFeePerDay')} min={0} step={0.01} />
          </Field>

          {/* Required documents */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Nepieciešamie dokumenti no pircēja</Label>
            <Field label="Nepieciešama licence (tips)" hint="piem. B kategorija, C kategorija — atstāj tukšu ja nav">
              <Input placeholder="C kategorija" value={form.requiredLicenseType} onChange={set('requiredLicenseType')} />
            </Field>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <Switch checked={form.ownInsuranceRequired} onCheckedChange={setBool('ownInsuranceRequired')} />
                Pircēja pašu atbildības apdrošināšana nepieciešama
              </label>
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <Switch checked={form.siteInductionRequired} onCheckedChange={setBool('siteInductionRequired')} />
                Objekta instruktāža nepieciešama
              </label>
            </div>
          </div>

          {/* Document URLs */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Dokumentu URL saites</Label>
            <Field label="CE deklarācija (URL)">
              <Input placeholder="https://..." value={form.docCe} onChange={set('docCe')} />
            </Field>
            <Field label="Tehniskā pārbaude (URL)">
              <Input placeholder="https://..." value={form.docInspection} onChange={set('docInspection')} />
            </Field>
            <Field label="Lietošanas rokasgrāmata (URL)">
              <Input placeholder="https://..." value={form.docManual} onChange={set('docManual')} />
            </Field>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 border border-border rounded-xl bg-muted/20">
            <div>
              <Label className="text-sm font-medium">Aktīvs (redzams katalogā)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deaktivizēta iekārta netiek rādīta pircējiem
              </p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={setBool('isActive')} />
          </div>

          {/* Summary preview */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nosaukums</span>
                <span className="font-semibold text-right max-w-56 truncate">{form.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tips</span>
                <span className="font-medium">{SERVICE_TYPE_LABELS[form.serviceType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cena</span>
                <span className="font-medium">€{parseFloat(form.pricePerDay || '0').toFixed(2)}/d.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Papildinājumi</span>
                <Badge variant="secondary">{form.addOns.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apdrošināšanas plāni</span>
                <Badge variant="secondary">{form.insuranceOptions.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Statuss</span>
                <Badge variant={form.isActive ? 'default' : 'secondary'}>
                  {form.isActive ? 'Aktīvs' : 'Deaktivizēts'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as WizardStep) : router.push('/dashboard/equipment-rentals/catalog'))}
          disabled={submitting}
        >
          <ChevronLeft className="size-4 mr-1" />
          {step === 1 ? 'Atcelt' : 'Atpakaļ'}
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep((s) => (s + 1) as WizardStep)}
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid)
            }
          >
            Turpināt <ChevronRight className="size-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" /> Saglabā...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 mr-1.5" /> Saglabāt izmaiņas
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
