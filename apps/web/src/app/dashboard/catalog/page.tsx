'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getMaterials,
  createMaterialOrder,
  type ApiMaterial,
  type MaterialCategory,
  type MaterialUnit,
} from '@/lib/api';
import {
  ArrowRight,
  Check,
  Leaf,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  Star,
  X,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<MaterialCategory, { label: string; emoji: string }> = {
  SAND: { label: 'Smiltis', emoji: '🟡' },
  GRAVEL: { label: 'Grants', emoji: '⚫' },
  STONE: { label: 'Akmens', emoji: '🪨' },
  CONCRETE: { label: 'Betons', emoji: '🔲' },
  SOIL: { label: 'Augsne', emoji: '🟫' },
  RECYCLED_CONCRETE: { label: 'Recikl. Betons', emoji: '♻️' },
  RECYCLED_SOIL: { label: 'Recikl. Augsne', emoji: '♻️' },
  ASPHALT: { label: 'Asfalts', emoji: '🛣️' },
  CLAY: { label: 'Māls', emoji: '🏺' },
  OTHER: { label: 'Cits', emoji: '📦' },
};

const UNIT_LABEL: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krāvums',
};

// ── Order modal ────────────────────────────────────────────────────────────────

interface OrderForm {
  quantity: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal: string;
  deliveryDate: string;
  notes: string;
}

function OrderModal({
  material,
  companyId,
  token,
  onClose,
  onSuccess,
}: {
  material: ApiMaterial;
  companyId: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<OrderForm>({
    quantity: String(material.minOrder ?? 1),
    deliveryAddress: '',
    deliveryCity: '',
    deliveryPostal: '',
    deliveryDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const qty = parseFloat(form.quantity) || 0;
  const subtotal = qty * material.basePrice;
  const vat = subtotal * 0.21;
  const total = subtotal + vat;

  const set =
    (k: keyof OrderForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      setError('Jūsu konts nav saistīts ar uzņēmumu — sazinieties ar B3Hub atbalstu.');
      return;
    }
    if (qty <= 0) {
      setError('Lūdzu ievadiet daudzumu.');
      return;
    }
    if (!form.deliveryAddress || !form.deliveryCity) {
      setError('Lūdzu norādiet piegādes adresi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createMaterialOrder(
        {
          materialId: material.id,
          quantity: qty,
          unit: material.unit,
          unitPrice: material.basePrice,
          deliveryAddress: form.deliveryAddress,
          deliveryCity: form.deliveryCity,
          deliveryPostal: form.deliveryPostal || '0000',
          deliveryDate: form.deliveryDate || undefined,
          notes: form.notes || undefined,
          buyerId: companyId,
        },
        token,
      );
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? 'Kļūda veicot pasūtījumu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">{material.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              €{material.basePrice.toFixed(2)} / {UNIT_LABEL[material.unit]} ·{' '}
              {material.supplier.name}
              {material.supplier.city ? `, ${material.supplier.city}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Daudzums ({UNIT_LABEL[material.unit]})
            </label>
            <input
              type="number"
              min={material.minOrder ?? 1}
              max={material.maxOrder ?? undefined}
              step="0.5"
              value={form.quantity}
              onChange={set('quantity')}
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            {material.minOrder && (
              <p className="text-xs text-muted-foreground mt-1">
                Minimālais pasūtījums: {material.minOrder} {UNIT_LABEL[material.unit]}
              </p>
            )}
          </div>

          {/* Delivery address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Piegādes adrese
              </label>
              <input
                type="text"
                placeholder="Iela, mājas numurs"
                value={form.deliveryAddress}
                onChange={set('deliveryAddress')}
                className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Pilsēta
              </label>
              <input
                type="text"
                placeholder="Rīga"
                value={form.deliveryCity}
                onChange={set('deliveryCity')}
                className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Pasta indekss
              </label>
              <input
                type="text"
                placeholder="LV-1001"
                value={form.deliveryPostal}
                onChange={set('deliveryPostal')}
                className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Vēlamais piegādes datums
            </label>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={set('deliveryDate')}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Piezīmes
            </label>
            <textarea
              rows={2}
              placeholder="Piegādes instrukcijas, kontaktpersona..."
              value={form.notes}
              onChange={set('notes')}
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Price summary */}
          <div className="rounded-xl bg-muted/40 border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {qty > 0
                  ? `${qty} ${UNIT_LABEL[material.unit]} × €${material.basePrice.toFixed(2)}`
                  : 'Daudzums'}
              </span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>PVN 21%</span>
              <span>€{vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t">
              <span>Kopā</span>
              <span className="text-red-600">€{total.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            Pasūtīt
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Success toast ──────────────────────────────────────────────────────────────

function SuccessToast({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-green-600 text-white px-5 py-3 shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4">
      <Check className="size-4" />
      Pasūtījums veiksmīgi iesniegts!
    </div>
  );
}

// ── Material card ──────────────────────────────────────────────────────────────

function MaterialCard({
  material,
  onOrder,
}: {
  material: ApiMaterial;
  onOrder: (m: ApiMaterial) => void;
}) {
  const cat = CATEGORY_META[material.category] ?? { label: material.category, emoji: '📦' };

  return (
    <div className="flex flex-col rounded-2xl border bg-card hover:shadow-md transition-shadow overflow-hidden">
      {/* Image / placeholder */}
      {material.images?.[0] ? (
        <img src={material.images[0]} alt={material.name} className="h-36 w-full object-cover" />
      ) : (
        <div className="h-36 w-full bg-linear-to-br from-stone-100 to-stone-200 flex items-center justify-center text-4xl">
          {cat.emoji}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold leading-tight">{material.name}</p>
            {material.subCategory && (
              <p className="text-xs text-muted-foreground mt-0.5">{material.subCategory}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs rounded-full bg-muted px-2 py-0.5 font-medium whitespace-nowrap">
              {cat.label}
            </span>
            {material.isRecycled && (
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                <Leaf className="size-3" />
                Recikl.
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {material.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{material.description}</p>
        )}

        {/* Supplier row */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="size-3 shrink-0" />
          <span className="truncate">{material.supplier.name}</span>
          {material.supplier.city && <span>· {material.supplier.city}</span>}
          {material.supplier.rating && (
            <span className="ml-auto flex items-center gap-0.5 text-amber-600">
              <Star className="size-3" />
              {material.supplier.rating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Min order */}
        {material.minOrder && (
          <p className="text-xs text-muted-foreground">
            Min. {material.minOrder} {UNIT_LABEL[material.unit]}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t">
          <div>
            <span className="text-lg font-bold">€{material.basePrice.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground"> / {UNIT_LABEL[material.unit]}</span>
          </div>
          {material.inStock ? (
            <button
              onClick={() => onOrder(material)}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors"
            >
              <ShoppingCart className="size-3.5" />
              Pasūtīt
            </button>
          ) : (
            <span className="text-xs text-muted-foreground border rounded-xl px-3 py-2">
              Nav pieejams
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<MaterialCategory | ''>('');
  const [orderTarget, setOrderTarget] = useState<ApiMaterial | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!token) router.push('/');
  }, [token, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMaterials(token, {
        category: category || undefined,
        search: search || undefined,
      });
      setMaterials(data);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token, category, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const categories = Object.keys(CATEGORY_META) as MaterialCategory[];

  const companyId = user?.company?.id ?? '';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="size-6 text-red-600" />
          Materiālu Katalogs
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Smiltis, grants, akmens un citi celtniecības materiāli — pasūtini ar pāris klikšķiem
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Meklēt materiālus..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl border bg-muted/30 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setCategory('')}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              category === ''
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            Visi
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c === category ? '' : c)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                category === c
                  ? 'bg-red-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-24 text-center flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Ielādē materiālus...</p>
        </div>
      ) : materials.length === 0 ? (
        <div className="py-24 text-center space-y-3">
          <Package className="mx-auto size-12 text-muted-foreground/30" />
          <p className="font-semibold text-muted-foreground">Nav atrastu materiālu</p>
          {(search || category) && (
            <button
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setCategory('');
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Notīrīt filtrus
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mt-3">
            {materials.length} materiāl{materials.length === 1 ? 's' : 'i'}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {materials.map((m) => (
              <MaterialCard key={m.id} material={m} onOrder={setOrderTarget} />
            ))}
          </div>
        </>
      )}

      {/* Order modal */}
      {orderTarget && (
        <OrderModal
          material={orderTarget}
          companyId={companyId}
          token={token!}
          onClose={() => setOrderTarget(null)}
          onSuccess={() => {
            setOrderTarget(null);
            setShowSuccess(true);
          }}
        />
      )}

      {/* Success toast */}
      {showSuccess && <SuccessToast onClose={() => setShowSuccess(false)} />}
    </div>
  );
}
