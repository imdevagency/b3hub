/**
 * Supplier materials page — /dashboard/materials
 * Create, edit, and delete the supplier's own material listings.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getMyMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  type ApiMaterial,
  type MaterialCategory,
  type MaterialUnit,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from '@/lib/api';
import { Check, Loader2, Package, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
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

const CATEGORIES: { value: MaterialCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'SAND', label: 'Smiltis', icon: <Waves className="w-4 h-4" /> },
  { value: 'GRAVEL', label: 'Grants', icon: <Grid3X3 className="w-4 h-4" /> },
  { value: 'STONE', label: 'Akmens', icon: <Mountain className="w-4 h-4" /> },
  { value: 'CONCRETE', label: 'Betons', icon: <Box className="w-4 h-4" /> },
  { value: 'SOIL', label: 'Augsne', icon: <Leaf className="w-4 h-4" /> },
  { value: 'RECYCLED_CONCRETE', label: 'Recikl. Betons', icon: <Recycle className="w-4 h-4" /> },
  { value: 'RECYCLED_SOIL', label: 'Recikl. Augsne', icon: <Recycle className="w-4 h-4" /> },
  { value: 'ASPHALT', label: 'Asfalts', icon: <Map className="w-4 h-4" /> },
  { value: 'CLAY', label: 'Māls', icon: <Wind className="w-4 h-4" /> },
  { value: 'OTHER', label: 'Cits', icon: <Box className="w-4 h-4" /> },
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

  // Update form when editing changes or sheet opens
  useEffect(() => {
    if (open) {
      setForm(editing ? materialToForm(editing) : EMPTY_FORM);
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
          inStock: form.inStock,
          isRecycled: form.isRecycled,
          quality: form.quality.trim() || undefined,
          supplierId,
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

            {/* Min / Max order */}
            <div className="grid grid-cols-2 gap-4">
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

// ── Delete confirm ─────────────────────────────────────────────────────────────

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

  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiMaterial | null>(null);
  const [deleting, setDeleting] = useState<ApiMaterial | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
  }, [token, isLoading, router]);

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
