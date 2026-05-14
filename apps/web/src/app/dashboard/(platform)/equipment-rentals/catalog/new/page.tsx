/**
 * Equipment Rental Listing — New Listing Wizard
 * /dashboard/equipment-rentals/catalog/new
 *
 * Multi-step wizard for rental providers to create a full listing with
 * add-ons, insurance options, delivery settings, and policies.
 */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { createRentalListing, type RentalServiceType, type CreateRentalListingPayload } from '@/lib/api/rentals';
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
  { n: 5, label: 'Politika & Publicēt' },
] as const;

type WizardStep = (typeof STEPS)[number]['n'];

// ── Spec row (key-value) ──────────────────────────────────────────────────────

interface SpecRow {
  key: string;
  value: string;
}

// ── Initial form state ────────────────────────────────────────────────────────

interface WizardState {
  // Step 1 — Basic info
  serviceType: RentalServiceType;
  subCategoryLabel: string;
  name: string;
  productCode: string;
  yearOfManufacture: string;
  description: string;
  specs: SpecRow[];
  imageUrls: string[];
  newImageUrl: string;

  // Step 2 — Pricing
  pricePerDay: string;
  vatRate: string;
  unitLabel: string;
  quantityTotal: string;
  minHireDays: string;
  maxHireDays: string;

  // Step 3 — Delivery
  coverageCities: string;
  deliveryRadiusKm: string;
  freeDeliveryRadiusKm: string;
  deliveryFeePerKm: string;
  selfCollectAvailable: boolean;
  selfCollectAddress: string;

  // Step 4 — Add-ons & Insurance
  addOns: AddOnDef[];
  newAddOn: Partial<AddOnDef>;
  insuranceOptions: InsuranceDef[];
  newInsurance: Partial<InsuranceDef>;
  insuranceRequired: boolean;
  depositAmount: string;
  depositMethod: string;

  // Step 5 — Policies
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

const INITIAL: WizardState = {
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

// ── Step indicator ────────────────────────────────────────────────────────────

function WizardStepIndicator({ current }: { current: WizardStep }) {
  return (
    <div className="flex lg:flex-col gap-3 lg:gap-0 lg:space-y-0 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.n}>
          <div
            className={cn(
              'flex items-center gap-3',
              current === s.n ? 'opacity-100' : current > s.n ? 'opacity-100' : 'opacity-60 grayscale-[50%]'
            )}
          >
            <span
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                current === s.n
                  ? 'bg-foreground text-background shadow-md'
                  : current > s.n
                    ? 'bg-foreground border-foreground text-background'
                    : 'bg-background border-2 border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {current > s.n ? <CheckCircle2 className="size-4" /> : s.n}
            </span>
            <span className={cn('whitespace-nowrap transition-colors', current === s.n ? 'text-foreground font-semibold' : 'text-foreground font-medium hidden lg:block')}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="hidden lg:block w-px h-6 ml-4 bg-border my-1" />
          )}
          {i < STEPS.length - 1 && (
            <div className="lg:hidden h-px w-6 bg-border mx-1 my-auto" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, hint, children, required }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-[15px] font-semibold tracking-tight text-foreground/90">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-2"><Info className="size-4 shrink-0" />{hint}</p>}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function NewListingWizardPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<WizardState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof WizardState>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setBool = <K extends keyof WizardState>(k: K) =>
    (v: boolean) =>
      setForm((f) => ({ ...f, [k]: v }));

  // ── Step 1 validation
  const step1Valid = !!form.name.trim() && !!form.serviceType;
  // ── Step 2 validation
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
    const { id, name, category, minQty, maxQty } = form.newAddOn;
    if (!id?.trim() || !name?.trim()) return;
    const def: AddOnDef = {
      id: id.trim(),
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
    const { id, name, description, pricePerDay } = form.newInsurance;
    if (!id?.trim() || !name?.trim() || description == null) return;
    const def: InsuranceDef = {
      id: id.trim(),
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
    if (!token) return;
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
      await createRentalListing(payload, token);
      router.push('/dashboard/equipment-rentals/catalog');
    } catch {
      setError('Publicēšana neizdevās. Pārbaudiet datus un mēģiniet vēlreiz.');
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] w-full">
      {/* Sidebar for Navigation and Summary */}
      <div className="w-full lg:w-[380px] xl:w-[440px] bg-muted/30 lg:border-r border-border flex flex-col p-6 lg:p-10 shrink-0">
        <div>
          <button
            onClick={() => router.push('/dashboard/equipment-rentals/catalog')}
            className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-8 transition-colors"
          >
            <ChevronLeft className="size-4" /> Atpakaļ
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Pievienot iekārtu</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10">
            Aizpildiet visus soļus, lai Jūsu iekārta būtu redzama pircējiem platformā.
          </p>
        </div>

        {/* Step indicator */}
        <WizardStepIndicator current={step} />
      </div>

      {/* Main Form Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="w-full max-w-3xl mx-auto px-6 py-8 lg:p-12 xl:p-16 flex flex-col flex-1">
          {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── STEP 1: Basic info ─────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-10">
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

          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="Apakškategorija" hint="piem. MINI EKSKAVATORS 1-3T">
              <Input placeholder="MINI EKSKAVATORS 1-3T" value={form.subCategoryLabel} onChange={set('subCategoryLabel')} />
            </Field>
            <Field label="Produkta kods" hint="Ražotāja modelis">
              <Input placeholder="CAT308CR" value={form.productCode} onChange={set('productCode')} />
            </Field>
          </div>

          <Field label="Ražošanas gads">
            <Input type="number" placeholder="2022" value={form.yearOfManufacture} onChange={set('yearOfManufacture')} min={1980} max={new Date().getFullYear()} />
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
          <div className="space-y-4">
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
          <div className="space-y-4">
            <Label className="text-sm font-medium">Fotoattēli (URL)</Label>
            {form.imageUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-muted-foreground truncate border border-border rounded-lg px-3 py-2 bg-muted/30">{url}</span>
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
        <div className="space-y-10">
          <SectionTitle>Cena un nomas periods</SectionTitle>

          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="Cena dienā (€)" required>
              <Input type="number" placeholder="150.00" value={form.pricePerDay} onChange={set('pricePerDay')} min={0} step={0.01} />
            </Field>
            <Field label="PVN likme (%)" hint="Parasti 21%">
              <Input type="number" placeholder="21" value={form.vatRate} onChange={set('vatRate')} min={0} max={100} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="Mērvienības apzīmējums" hint="piem. mašīna, vienība">
              <Input placeholder="mašīna" value={form.unitLabel} onChange={set('unitLabel')} />
            </Field>
            <Field label="Pieejamie daudzumi">
              <Input type="number" placeholder="1" value={form.quantityTotal} onChange={set('quantityTotal')} min={1} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
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
                  <span className="font-medium">
                    €{parseFloat(form.pricePerDay || '0').toFixed(2)}
                  </span>
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
        <div className="space-y-10">
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

          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="Bezmaksas piegādes rādiuss (km)" hint="Attālums, kur piegāde bez maksas">
              <Input type="number" placeholder="15" value={form.freeDeliveryRadiusKm} onChange={set('freeDeliveryRadiusKm')} min={0} />
            </Field>
            <Field label="Piegādes maksa par km (€)" hint="Ārpus bezmaksas rādiusa">
              <Input type="number" placeholder="1.50" value={form.deliveryFeePerKm} onChange={set('deliveryFeePerKm')} min={0} step={0.01} />
            </Field>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Pašizgādes iespēja</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Klients var paņemt iekārtu pats</p>
              </div>
              <Switch
                checked={form.selfCollectAvailable}
                onCheckedChange={setBool('selfCollectAvailable')}
              />
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
            <div className="grid sm:grid-cols-2 gap-6">
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

      {/* ── STEP 5: Policies & Publish ────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-10">
          <SectionTitle>Politika un publicēšana</SectionTitle>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Degvielas politika">
              <Select value={form.fuelPolicy || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, fuelPolicy: v === 'none' ? '' : v }))}>
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
              <Select value={form.cancellationPolicy || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, cancellationPolicy: v === 'none' ? '' : v }))}>
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
          <div className="space-y-4">
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
          <div className="space-y-4">
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
              <Label className="text-sm font-medium">Publicēt uzreiz</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Iekārta būs redzama pircējiem uzreiz pēc publicēšanas
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
      <div className="flex items-center justify-between pt-8 pb-4 mt-auto">
        <Button
          variant="outline"
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as WizardStep) : router.back())}
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
                <Loader2 className="size-4 mr-1.5 animate-spin" /> Publicē...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 mr-1.5" />
                {form.isActive ? 'Publicēt iekārtu' : 'Saglabāt melnrakstu'}
              </>
            )}
          </Button>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper sub-component ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold tracking-tight pb-4 mb-2 border-b border-border/50">{children}</h2>;
}
