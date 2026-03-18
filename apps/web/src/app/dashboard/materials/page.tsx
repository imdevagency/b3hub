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

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES: { value: MaterialCategory; label: string; emoji: string }[] = [
  { value: 'SAND', label: 'Smiltis', emoji: '🟡' },
  { value: 'GRAVEL', label: 'Grants', emoji: '⚫' },
  { value: 'STONE', label: 'Akmens', emoji: '🪨' },
  { value: 'CONCRETE', label: 'Betons', emoji: '🔲' },
  { value: 'SOIL', label: 'Augsne', emoji: '🟫' },
  { value: 'RECYCLED_CONCRETE', label: 'Recikl. Betons', emoji: '♻️' },
  { value: 'RECYCLED_SOIL', label: 'Recikl. Augsne', emoji: '♻️' },
  { value: 'ASPHALT', label: 'Asfalts', emoji: '🛣️' },
  { value: 'CLAY', label: 'Māls', emoji: '🏺' },
  { value: 'OTHER', label: 'Cits', emoji: '📦' },
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
  supplierId,
  token,
  editing,
  onClose,
  onSaved,
}: {
  supplierId: string;
  token: string;
  editing: ApiMaterial | null;
  onClose: () => void;
  onSaved: (m: ApiMaterial) => void;
}) {
  const [form, setForm] = useState<MaterialFormValues>(
    editing ? materialToForm(editing) : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set =
    (k: keyof MaterialFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggle = (k: 'inStock' | 'isRecycled') => () => setForm((f) => ({ ...f, [k]: !f[k] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full sm:max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="font-bold text-lg">
            {editing ? 'Rediģēt materiālu' : 'Pievienot materiālu'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Nosaukums *</label>
              <input
                type="text"
                placeholder="piem. Kvarca smiltis 0/2"
                value={form.name}
                onChange={set('name')}
                required
                className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Category + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Kategorija *</label>
                <select
                  value={form.category}
                  onChange={set('category')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Mērvienība *</label>
                <select
                  value={form.unit}
                  onChange={set('unit')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Cena (€ / {UNIT_SHORT[form.unit]}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.basePrice}
                  onChange={set('basePrice')}
                  required
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Apakškatgorija</label>
                <input
                  type="text"
                  placeholder="piem. 0/2 mm"
                  value={form.subCategory}
                  onChange={set('subCategory')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Min / Max order */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Min. pasūtījums ({UNIT_SHORT[form.unit]})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="—"
                  value={form.minOrder}
                  onChange={set('minOrder')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Maks. pasūtījums ({UNIT_SHORT[form.unit]})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="—"
                  value={form.maxOrder}
                  onChange={set('maxOrder')}
                  className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Apraksts</label>
              <textarea
                rows={2}
                placeholder="Papildu informācija par materiālu..."
                value={form.description}
                onChange={set('description')}
                className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            {/* Quality */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Kvalitāte / sertifikāts</label>
              <input
                type="text"
                placeholder="piem. A klase, ISO 1234"
                value={form.quality}
                onChange={set('quality')}
                className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Toggles */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={toggle('inStock')}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  form.inStock
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {form.inStock ? <Check className="size-4" /> : <X className="size-4" />}
                {form.inStock ? 'Pieejams' : 'Nav pieejams'}
              </button>
              <button
                type="button"
                onClick={toggle('isRecycled')}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  form.isRecycled
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {form.isRecycled ? <Check className="size-4" /> : <X className="size-4" />}
                Reciklēts
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              Atcelt
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editing ? 'Saglabāt' : 'Pievienot'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-red-100 p-2 shrink-0">
            <Trash2 className="size-5 text-red-600" />
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
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white text-sm font-bold px-4 py-2.5 hover:bg-red-700 disabled:opacity-50 transition-colors"
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

  const CATEGORY_EMOJI: Partial<Record<MaterialCategory, string>> = {
    SAND: '🟡',
    GRAVEL: '⚫',
    STONE: '🪨',
    CONCRETE: '🔲',
    SOIL: '🟫',
    RECYCLED_CONCRETE: '♻️',
    RECYCLED_SOIL: '♻️',
    ASPHALT: '🛣️',
    CLAY: '🏺',
    OTHER: '📦',
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="size-6 text-red-600" />
            Mani Materiāli
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pārvaldiet savas cenas un pieejamību — pircēji redzēs šo informāciju katalogā
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-bold hover:bg-red-700 transition-colors"
          >
            <Plus className="size-4" />
            Pievienot
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-24 text-center flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ielādē materiālus...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="py-24 text-center space-y-4">
          <Package className="mx-auto size-14 text-muted-foreground/30" />
          <div>
            <p className="font-semibold text-muted-foreground">Vēl nav materiālu</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pievienojiet pirmo materiālu, lai pircēji varētu to redzēt un pasūtīt
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 text-white px-5 py-2.5 text-sm font-bold hover:bg-red-700 transition-colors"
          >
            <Plus className="size-4" />
            Pievienot materiālu
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mt-3">
            {materials.length} materiāl{materials.length === 1 ? 's' : 'i'}
          </p>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Materiāls</th>
                  <th className="text-left px-5 py-3 font-medium">Cena</th>
                  <th className="text-left px-5 py-3 font-medium">Min. pasūt.</th>
                  <th className="text-center px-5 py-3 font-medium">Pieejams</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {materials.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{CATEGORY_EMOJI[m.category] ?? '📦'}</span>
                        <div>
                          <p className="font-semibold">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORIES.find((c) => c.value === m.category)?.label}
                            {m.subCategory ? ` · ${m.subCategory}` : ''}
                            {m.isRecycled ? ' · ♻️ Recikl.' : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-base">€{m.basePrice.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground"> /{UNIT_SHORT[m.unit]}</span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {m.minOrder ? `${m.minOrder} ${UNIT_SHORT[m.unit]}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => toggleStock(m)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          m.inStock
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {m.inStock ? <Check className="size-3" /> : <X className="size-3" />}
                        {m.inStock ? 'Jā' : 'Nē'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditing(m);
                            setShowForm(true);
                          }}
                          className="rounded-lg border p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(m)}
                          className="rounded-lg border p-1.5 hover:bg-red-50 hover:border-red-200 transition-colors text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {materials.map((m) => (
              <div key={m.id} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{CATEGORY_EMOJI[m.category] ?? '📦'}</span>
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORIES.find((c) => c.value === m.category)?.label}
                        {m.subCategory ? ` · ${m.subCategory}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleStock(m)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 ${
                      m.inStock ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {m.inStock ? <Check className="size-3" /> : <X className="size-3" />}
                    {m.inStock ? 'Pieejams' : 'Nav'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-lg">€{m.basePrice.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground"> /{UNIT_SHORT[m.unit]}</span>
                    {m.minOrder && (
                      <p className="text-xs text-muted-foreground">
                        Min. {m.minOrder} {UNIT_SHORT[m.unit]}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditing(m);
                        setShowForm(true);
                      }}
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-1"
                    >
                      <Pencil className="size-3.5" />
                      Rediģēt
                    </button>
                    <button
                      onClick={() => setDeleting(m)}
                      className="rounded-lg border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {showForm && (
        <MaterialFormModal
          supplierId={supplierId}
          token={token!}
          editing={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
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
