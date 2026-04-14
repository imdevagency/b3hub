/**
 * Supplier materials page — /dashboard/materials
 * Create, edit, and delete the supplier's own material listings.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getMyMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getMaterialTiers,
  setMaterialTiers,
  uploadMaterialImage,
  uploadMaterialDocument,
  removeMaterialDocument,
  getMaterialAvailability,
  addMaterialAvailabilityBlock,
  removeMaterialAvailabilityBlock,
  type PriceTier,
  type AvailabilityBlock,
  type ApiMaterial,
  type MaterialCategory,
  type MaterialUnit,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from '@/lib/api';
import {
  Check,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  AlertTriangle,
  ImagePlus,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/page-spinner';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Constants ─────────────────────────────────────────────────────────────────
import { Building2, Box, Mountain, Grid3X3, Waves, Leaf, Recycle, Map, Wind } from 'lucide-react';

import { CATEGORY_LABELS } from '@b3hub/shared';

const CATEGORIES: { value: MaterialCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'SAND', label: CATEGORY_LABELS.SAND, icon: <Waves className="w-4 h-4" /> },
  { value: 'GRAVEL', label: CATEGORY_LABELS.GRAVEL, icon: <Grid3X3 className="w-4 h-4" /> },
  { value: 'STONE', label: CATEGORY_LABELS.STONE, icon: <Mountain className="w-4 h-4" /> },
  { value: 'CONCRETE', label: CATEGORY_LABELS.CONCRETE, icon: <Box className="w-4 h-4" /> },
  { value: 'SOIL', label: CATEGORY_LABELS.SOIL, icon: <Leaf className="w-4 h-4" /> },
  {
    value: 'RECYCLED_CONCRETE',
    label: CATEGORY_LABELS.RECYCLED_CONCRETE,
    icon: <Recycle className="w-4 h-4" />,
  },
  {
    value: 'RECYCLED_SOIL',
    label: CATEGORY_LABELS.RECYCLED_SOIL,
    icon: <Recycle className="w-4 h-4" />,
  },
  { value: 'ASPHALT', label: CATEGORY_LABELS.ASPHALT, icon: <Map className="w-4 h-4" /> },
  { value: 'CLAY', label: CATEGORY_LABELS.CLAY, icon: <Wind className="w-4 h-4" /> },
  { value: 'OTHER', label: CATEGORY_LABELS.OTHER, icon: <Box className="w-4 h-4" /> },
];

const UNITS: { value: MaterialUnit; label: string }[] = [
  { value: 'TONNE', label: 'Tonne (t)' },
  { value: 'M3', label: 'Kubikmetrs (m³)' },
  { value: 'PIECE', label: 'Gabals (gb.)' },
  { value: 'LOAD', label: 'Krāvums' },
];

const UNIT_SHORT: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krāv.',
};

// ── Form ──────────────────────────────────────────────────────────────────────

interface MaterialFormValues {
  name: string;
  description: string;
  category: MaterialCategory;
  subCategory: string;
  basePrice: string;
  unit: MaterialUnit;
  minOrder: string;
  maxOrder: string;
  deliveryRadiusKm: string;
  stockQty: string;
  inStock: boolean;
  isRecycled: boolean;
  quality: string;
}

const EMPTY_FORM: MaterialFormValues = {
  name: '',
  description: '',
  category: 'SAND',
  subCategory: '',
  basePrice: '',
  unit: 'TONNE',
  minOrder: '',
  maxOrder: '',
  deliveryRadiusKm: '100',
  stockQty: '',
  inStock: true,
  isRecycled: false,
  quality: '',
};

function materialToForm(m: ApiMaterial): MaterialFormValues {
  return {
    name: m.name,
    description: m.description ?? '',
    category: m.category,
    subCategory: m.subCategory ?? '',
    basePrice: String(m.basePrice),
    unit: m.unit,
    minOrder: m.minOrder ? String(m.minOrder) : '',
    maxOrder: m.maxOrder ? String(m.maxOrder) : '',
    deliveryRadiusKm: m.deliveryRadiusKm != null ? String(m.deliveryRadiusKm) : '100',
    stockQty: m.stockQty != null ? String(m.stockQty) : '',
    inStock: m.inStock,
    isRecycled: m.isRecycled,
    quality: m.quality ?? '',
  };
}

function MaterialFormModal({
  open,
  supplierId,
  token,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  supplierId: string;
  token: string;
  editing: ApiMaterial | null;
  onClose: () => void;
  onSaved: (m: ApiMaterial) => void;
}) {
  const [form, setForm] = useState<MaterialFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [certs, setCerts] = useState<string[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Update form when editing changes or sheet opens
  useEffect(() => {
    if (open) {
      setForm(editing ? materialToForm(editing) : EMPTY_FORM);
      setImages(editing?.images ?? []);
      setCerts(editing?.certificates ?? []);
      setError('');
    }
  }, [open, editing]);

  const set =
    (k: keyof MaterialFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const setSelect = (k: keyof MaterialFormValues, value: string) => {
    setForm((f) => ({ ...f, [k]: value }));
  };

  const toggle = (k: 'inStock' | 'isRecycled') => () => setForm((f) => ({ ...f, [k]: !f[k] }));

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing?.id) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';
      setUploadingImage(true);
      try {
        const result = await uploadMaterialImage(editing.id, base64, mimeType, token);
        setImages(result.images);
      } catch {
        setError('Neizdevās augšupielādēt attēlu.');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing?.id) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setUploadingDoc(true);
      try {
        const result = await uploadMaterialDocument(editing.id, base64, 'application/pdf', token);
        setCerts(result.certificates);
      } catch {
        setError('Neizdevās augšupielādēt dokumentu.');
      } finally {
        setUploadingDoc(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleDocRemove(url: string) {
    if (!editing?.id) return;
    try {
      const result = await removeMaterialDocument(editing.id, url, token);
      setCerts(result.certificates);
    } catch {
      setError('Neizdevās dzēst dokumentu.');
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      setError('Lūdzu ievadiet nosaukumu.');
      return;
    }
    const price = parseFloat(form.basePrice);
    if (isNaN(price) || price <= 0) {
      setError('Lūdzu ievadiet derīgu cenu.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let result: ApiMaterial;
      if (editing) {
        const input: UpdateMaterialInput = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
          subCategory: form.subCategory.trim() || undefined,
          basePrice: price,
          unit: form.unit,
          minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
          maxOrder: form.maxOrder ? parseFloat(form.maxOrder) : undefined,
          deliveryRadiusKm: form.deliveryRadiusKm ? parseInt(form.deliveryRadiusKm, 10) : undefined,
          stockQty: form.stockQty !== '' ? parseFloat(form.stockQty) : null,
          inStock: form.inStock,
          isRecycled: form.isRecycled,
          quality: form.quality.trim() || undefined,
        };
        result = await updateMaterial(editing.id, input, token);
      } else {
        const input: CreateMaterialInput = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
          subCategory: form.subCategory.trim() || undefined,
          basePrice: price,
          unit: form.unit,
          minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
          maxOrder: form.maxOrder ? parseFloat(form.maxOrder) : undefined,
          deliveryRadiusKm: form.deliveryRadiusKm ? parseInt(form.deliveryRadiusKm, 10) : undefined,
          inStock: form.inStock,
          isRecycled: form.isRecycled,
          quality: form.quality.trim() || undefined,
          supplierId,
          ...(form.stockQty !== '' && { stockQty: parseFloat(form.stockQty) }),
        };
        result = await createMaterial(input, token);
      }
      onSaved(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda saglabājot materiālu.');
    } finally {
      setSaving(false);
    }
  }

  const inputClasses =
    'bg-muted/40 border-0 shadow-none h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-[15px] transition-colors mt-1.5 focus:ring-1 focus:ring-primary/30';

  return (
    <Sheet open={open} onOpenChange={(o) => (!o && !saving ? onClose() : null)}>
      <SheetContent className="sm:max-w-xl w-full overflow-hidden p-0 flex flex-col border-l shadow-2xl">
        <div className="px-6 pt-8 pb-4">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold tracking-tight">
              {editing ? 'Rediģēt materiālu' : 'Pievienot materiālu'}
            </SheetTitle>
            <p className="text-[15px] text-muted-foreground leading-relaxed pt-1">
              Aizpildiet informāciju par materiālu, lai pircēji to redzētu jūsu katalogā.
            </p>
          </SheetHeader>
        </div>

        <div className="flex-1 px-6 space-y-6 overflow-y-auto pb-32">
          {error && (
            <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Name */}
            <div>
              <Label className="text-sm font-medium ml-1">Nosaukums *</Label>
              <Input
                placeholder="piem. Kvarca smiltis 0/2"
                value={form.name}
                onChange={set('name')}
                required
                className={inputClasses}
              />
            </div>

            {/* Category + Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium ml-1">Kategorija *</Label>
                <Select value={form.category} onValueChange={(v) => setSelect('category', v)}>
                  <SelectTrigger className={`w-full ${inputClasses}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-lg">
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{c.icon}</span>
                          <span>{c.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">Mērvienība *</Label>
                <Select value={form.unit} onValueChange={(v) => setSelect('unit', v)}>
                  <SelectTrigger className={`w-full ${inputClasses}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-lg">
                    {UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value} className="rounded-lg">
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium ml-1">
                  Cena (€ / {UNIT_SHORT[form.unit]}) *
                </Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.basePrice}
                  onChange={set('basePrice')}
                  required
                  className={inputClasses}
                />
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">Apakškategorija</Label>
                <Input
                  placeholder="piem. 0/2 mm"
                  value={form.subCategory}
                  onChange={set('subCategory')}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Min / Max order + Stock Qty */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium ml-1">
                  Min. pasūtījums ({UNIT_SHORT[form.unit]})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="—"
                  value={form.minOrder}
                  onChange={set('minOrder')}
                  className={inputClasses}
                />
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">
                  Maks. pasūtījums ({UNIT_SHORT[form.unit]})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="—"
                  value={form.maxOrder}
                  onChange={set('maxOrder')}
                  className={inputClasses}
                />
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">
                  Krājums ({UNIT_SHORT[form.unit]})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Nav izsekots"
                  value={form.stockQty}
                  onChange={set('stockQty')}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Delivery radius */}
            <div>
              <Label className="text-sm font-medium ml-1">Piegādes rādiuss (km)</Label>
              <Input
                type="number"
                min="10"
                max="2000"
                step="10"
                placeholder="100"
                value={form.deliveryRadiusKm}
                onChange={set('deliveryRadiusKm')}
                className={inputClasses}
              />
              <p className="text-xs text-muted-foreground mt-1 ml-1">
                Pircēji ārpus šī rādiusa neredzēs šo piedāvājumu.
              </p>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium ml-1">Apraksts</Label>
              <Textarea
                rows={3}
                placeholder="Papildu informācija par materiālu..."
                value={form.description}
                onChange={set('description')}
                className="mt-1.5 bg-muted/40 border-0 shadow-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 p-4 text-[15px] resize-none transition-colors"
              />
            </div>

            {/* Quality */}
            <div>
              <Label className="text-sm font-medium ml-1">Kvalitāte / sertifikāts</Label>
              <Input
                placeholder="piem. A klase, ISO 1234"
                value={form.quality}
                onChange={set('quality')}
                className={inputClasses}
              />
            </div>

            {/* Product photos */}
            <div>
              <Label className="text-sm font-medium ml-1">Produkta bildes</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`Bilde ${i + 1}`}
                    className="w-20 h-20 object-cover rounded-xl border border-border"
                  />
                ))}
                {editing?.id ? (
                  <label
                    className={`w-20 h-20 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {uploadingImage ? (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    ) : (
                      <ImagePlus className="size-5 text-muted-foreground" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handleImageChange}
                      disabled={uploadingImage}
                    />
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground self-center">
                    Saglabājiet materiālu, lai pievienotu bildes.
                  </p>
                )}
              </div>
            </div>

            {/* Specification / certificate documents */}
            <div>
              <Label className="text-sm font-medium ml-1">
                Specifikācijas un sertifikāti (PDF)
              </Label>
              <div className="mt-2 space-y-2">
                {certs.map((url, i) => {
                  const filename = url.split('/').pop() ?? `Dokuments ${i + 1}`;
                  return (
                    <div
                      key={url}
                      className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5"
                    >
                      <FileText className="size-4 text-muted-foreground shrink-0" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm text-primary truncate hover:underline"
                      >
                        {filename}
                      </a>
                      {editing?.id && (
                        <button
                          type="button"
                          onClick={() => handleDocRemove(url)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Dzēst dokumentu"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {editing?.id ? (
                  <label
                    className={`flex items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-3 cursor-pointer hover:bg-muted/70 transition-colors ${
                      uploadingDoc ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    {uploadingDoc ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <FileText className="size-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {uploadingDoc ? 'Augšupielādē...' : 'Pievienot PDF dokumentu'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={handleDocChange}
                      disabled={uploadingDoc}
                    />
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Saglabājiet materiālu, lai pievienotu dokumentus.
                  </p>
                )}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={toggle('inStock')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl h-12 text-[15px] font-semibold transition-all ${
                  form.inStock ? 'bg-green-100 text-green-700' : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                {form.inStock ? <Check className="size-4" /> : <X className="size-4" />}
                {form.inStock ? 'Pieejams' : 'Nav pieejams'}
              </button>
              <button
                type="button"
                onClick={toggle('isRecycled')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl h-12 text-[15px] font-semibold transition-all ${
                  form.isRecycled
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted/60 text-muted-foreground'
                }`}
              >
                {form.isRecycled ? <Check className="size-4" /> : <X className="size-4" />}
                Reciklēts
              </button>
            </div>

            {/* Price tiers — only shown when editing an existing material */}
            {editing && (
              <PriceTiersSection materialId={editing.id} unit={form.unit} token={token} />
            )}

            {/* Availability blocks — only shown when editing an existing material */}
            {editing && <AvailabilitySection materialId={editing.id} token={token} />}
          </div>
        </div>

        {/* Fixed Footer with Uber-like button */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-background/90 backdrop-blur-xl border-t border-border/50">
          <Button
            className="w-full h-14 rounded-2xl text-[16px] font-semibold bg-foreground hover:bg-foreground/90 text-background shadow-lg transition-all"
            onClick={() => handleSubmit()}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
            {saving ? 'Saglabā...' : editing ? 'Saglabāt izmaiņas' : 'Pievienot materiālu'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Price tiers section ───────────────────────────────────────────────────────

function PriceTiersSection({
  materialId,
  unit,
  token,
}: {
  materialId: string;
  unit: MaterialUnit;
  token: string;
}) {
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [newMinQty, setNewMinQty] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');

  useEffect(() => {
    setLoading(true);
    getMaterialTiers(materialId, token)
      .then((t) => setTiers([...t].sort((a, b) => a.minQty - b.minQty)))
      .catch(() => setTiers([]))
      .finally(() => setLoading(false));
  }, [materialId, token]);

  const unitShort: Record<MaterialUnit, string> = {
    TONNE: 't',
    M3: 'm³',
    PIECE: 'gb.',
    LOAD: 'krāv.',
  };

  async function handleSave(updated: PriceTier[]) {
    setSaving(true);
    setSaveError('');
    try {
      const saved = await setMaterialTiers(
        materialId,
        updated.map(({ minQty, unitPrice }) => ({ minQty, unitPrice })),
        token,
      );
      setTiers([...saved].sort((a, b) => a.minQty - b.minQty));
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Kļūda saglabājot.');
    } finally {
      setSaving(false);
    }
  }

  function addTier() {
    const qty = parseFloat(newMinQty);
    const price = parseFloat(newUnitPrice);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) return;
    const updated = [
      ...tiers.filter((t) => t.minQty !== qty),
      { minQty: qty, unitPrice: price },
    ].sort((a, b) => a.minQty - b.minQty);
    handleSave(updated);
    setNewMinQty('');
    setNewUnitPrice('');
  }

  function removeTier(minQty: number) {
    handleSave(tiers.filter((t) => t.minQty !== minQty));
  }

  return (
    <div className="pt-4 border-t border-border/60">
      <p className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wide">
        Apjoma atlaides
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Ielādē...
        </div>
      ) : (
        <div className="space-y-2">
          {tiers.length === 0 && (
            <p className="text-sm text-muted-foreground">Nav pievienotu apjoma atlaižu.</p>
          )}
          {tiers.map((tier) => (
            <div
              key={tier.minQty}
              className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2"
            >
              <span className="text-sm font-medium">
                ≥ {tier.minQty} {unitShort[unit]} → €{tier.unitPrice.toFixed(2)} / {unitShort[unit]}
              </span>
              <button
                type="button"
                onClick={() => removeTier(tier.minQty)}
                disabled={saving}
                className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          {saveError && <p className="text-xs text-destructive">{saveError}</p>}

          {/* Add new tier row */}
          <div className="flex gap-2 pt-1">
            <Input
              type="number"
              min="0.01"
              step="0.5"
              placeholder={`No (${unitShort[unit]})`}
              value={newMinQty}
              onChange={(e) => setNewMinQty(e.target.value)}
              className="h-9 text-sm bg-muted/40 border-0 shadow-none rounded-xl"
            />
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="€ / vienībai"
              value={newUnitPrice}
              onChange={(e) => setNewUnitPrice(e.target.value)}
              className="h-9 text-sm bg-muted/40 border-0 shadow-none rounded-xl"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addTier}
              disabled={saving || !newMinQty || !newUnitPrice}
              className="h-9 px-3 rounded-xl shrink-0"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Availability blocks section ───────────────────────────────────────────────

function AvailabilitySection({ materialId, token }: { materialId: string; token: string }) {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMaterialAvailability(token, materialId)
      .then(setBlocks)
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }, [materialId, token]);

  async function handleAdd() {
    if (!startDate || !endDate) return;
    setSaving(true);
    setError('');
    try {
      const block = await addMaterialAvailabilityBlock(token, materialId, {
        startDate,
        endDate,
        note: note.trim() || undefined,
      });
      setBlocks((prev) => [...prev, block].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setStartDate('');
      setEndDate('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kļūda pievienojot periodu');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(blockId: string) {
    try {
      await removeMaterialAvailabilityBlock(token, materialId, blockId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch {
      // silently ignore — block stays in list
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('lv-LV', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div className="mt-6 space-y-3">
      <Label className="text-sm font-semibold ml-1">Nepieejamības periodi</Label>
      <p className="text-xs text-muted-foreground ml-1">
        Norādiet datumus, kad materiāls nav pieejams (atvaļinājums, plānotā apkope u.c.).
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
          <Loader2 className="size-4 animate-spin" /> Ielādē...
        </div>
      ) : (
        <div className="space-y-2">
          {blocks.length === 0 && (
            <p className="text-xs text-muted-foreground ml-1">Nav neviena perioda.</p>
          )}
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="font-medium">
                {fmtDate(block.startDate)} – {fmtDate(block.endDate)}
              </span>
              {block.note && (
                <span className="text-muted-foreground truncate max-w-30">{block.note}</span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(block.id)}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label="Dzēst periodu"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs ml-1">No</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 text-sm bg-muted/40 border-0 shadow-none rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs ml-1">Līdz</Label>
          <Input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 text-sm bg-muted/40 border-0 shadow-none rounded-xl"
          />
        </div>
      </div>
      <Input
        placeholder="Piezīme (neobligāta)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-9 text-sm bg-muted/40 border-0 shadow-none rounded-xl"
      />
      {error && <p className="text-xs text-destructive ml-1">{error}</p>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleAdd}
        disabled={saving || !startDate || !endDate}
        className="h-9 w-full rounded-xl text-sm"
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin mr-1" />
        ) : (
          <Plus className="size-4 mr-1" />
        )}
        Pievienot periodu
      </Button>
    </div>
  );
}

function DeleteConfirm({
  material,
  token,
  onClose,
  onDeleted,
}: {
  material: ApiMaterial;
  token: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMaterial(material.id, token);
      onDeleted(material.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda dzēšot materiālu.');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-[24px] bg-card border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0">
            <Trash2 className="size-5 text-destructive" />
          </div>
          <div>
            <p className="font-bold">Dzēst materiālu?</p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium">{material.name}</span> tiks neatgriezeniski dzēsts.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Atcelt
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold px-4 py-2.5 hover:bg-destructive/90 disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Dzēst
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MyMaterialsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(() => searchParams.get('new') === 'true');
  const [editing, setEditing] = useState<ApiMaterial | null>(null);
  const [deleting, setDeleting] = useState<ApiMaterial | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
    else if (!isLoading && user && !user.canSell) router.push('/dashboard');
  }, [token, isLoading, user, router]);

  const supplierId = user?.company?.id ?? '';

  const load = useCallback(async () => {
    if (!token) return;
    if (!supplierId) {
      setLoading(false); // user has no company — stop spinner, show empty state
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getMyMaterials(token, supplierId);
      setMaterials(data);
    } catch {
      setError('Neizdevās ielādēt materiālus.');
    } finally {
      setLoading(false);
    }
  }, [token, supplierId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved(m: ApiMaterial) {
    setMaterials((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = m;
        return next;
      }
      return [m, ...prev];
    });
    setShowForm(false);
    setEditing(null);
  }

  async function toggleStock(m: ApiMaterial) {
    if (!token) return;
    try {
      const updated = await updateMaterial(m.id, { inStock: !m.inStock }, token);
      setMaterials((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      /* silent */
    }
  }

  const CATEGORY_MAP: Record<MaterialCategory | 'OTHER', React.ReactNode> = {
    SAND: <Mountain className="size-5 text-amber-500" />,
    GRAVEL: <Grid3X3 className="size-5 text-zinc-600" />,
    STONE: <Box className="size-5 text-stone-600" />,
    CONCRETE: <Building2 className="size-5 text-neutral-400" />,
    SOIL: <Leaf className="size-5 text-amber-800" />,
    RECYCLED_CONCRETE: <Building2 className="size-5 text-green-600" />,
    RECYCLED_SOIL: <Leaf className="size-5 text-green-600" />,
    ASPHALT: <Box className="size-5 text-gray-800" />,
    CLAY: <Box className="size-5 text-orange-600" />,
    OTHER: <Box className="size-5 text-blue-500" />,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader
        title="Mani Materiāli"
        description="Pārvaldiet savas cenas un pieejamību — pircēji redzēs šo informāciju katalogā"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={load}
              disabled={loading}
              className="rounded-xl"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              className="rounded-xl"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="size-4 mr-1.5" />
              Pievienot
            </Button>
          </div>
        }
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <PageSpinner />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Vēl nav materiālu"
          description="Pievienojiet pirmo materiālu, lai pircēji varētu to redzet un pasūtīt"
          action={
            <Button
              className="rounded-xl"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
            >
              <Plus className="size-4 mr-1.5" />
              Pievienot materiālu
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mt-3">
            {materials.length} materiāl{materials.length === 1 ? 's' : 'i'}
          </p>

          {/* Materials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {materials.map((m) => (
              <div
                key={m.id}
                className="group relative rounded-2xl border bg-card p-5 hover:border-foreground/20 hover:shadow-lg transition-all flex flex-col justify-between h-full"
              >
                {/* Header: Icon, Title, and Status inside to right */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 size-12 rounded-xl bg-muted/50 border flex items-center justify-center">
                      {CATEGORY_MAP[m.category] ?? CATEGORY_MAP.OTHER}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[16px] leading-tight text-foreground line-clamp-2 pr-2">
                        {m.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {CATEGORIES.find((c) => c.value === m.category)?.label}
                        {m.subCategory ? ` · ${m.subCategory}` : ''}
                      </p>
                      {m.stockQty != null && m.stockQty < 10 && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                          <AlertTriangle className="size-3" />
                          Maz krājumu ({m.stockQty} {UNIT_SHORT[m.unit]})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Toggle Button overlaying top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStock(m);
                    }}
                    className={`shrink-0 inline-flex items-center justify-center size-8 rounded-full transition-colors ${
                      m.inStock
                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    title={m.inStock ? 'Pieejams' : 'Nav pieejams'}
                  >
                    {m.inStock ? <Check className="size-4" /> : <X className="size-4" />}
                  </button>
                </div>

                {/* Footer specs & Actions */}
                <div className="mt-auto space-y-4">
                  {/* Price and Min Order */}
                  <div className="flex items-end justify-between bg-muted/40 rounded-xl p-3">
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Cena
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-xl leading-none">
                          €{m.basePrice.toFixed(2)}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">
                          /{UNIT_SHORT[m.unit]}
                        </span>
                      </div>
                    </div>
                    {m.minOrder && (
                      <div className="text-right">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                          Min. P.
                        </p>
                        <span className="font-semibold text-sm">
                          {m.minOrder} {UNIT_SHORT[m.unit]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 rounded-xl border-border bg-background hover:bg-muted font-medium transition-colors"
                      onClick={() => {
                        setEditing(m);
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="size-4 mr-2" />
                      Rediģēt
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-10 w-10 border-border rounded-xl bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                      onClick={() => setDeleting(m)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <MaterialFormModal
        open={showForm}
        supplierId={supplierId}
        token={token!}
        editing={editing}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
      {deleting && (
        <DeleteConfirm
          material={deleting}
          token={token!}
          onClose={() => setDeleting(null)}
          onDeleted={(id) => {
            setMaterials((prev) => prev.filter((m) => m.id !== id));
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
