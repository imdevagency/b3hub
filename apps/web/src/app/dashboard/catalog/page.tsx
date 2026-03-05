'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import {
  getMaterials,
  getMaterialCategories,
  type ApiMaterial,
  type MaterialCategory,
  type MaterialUnit,
} from '@/lib/api';
import {
  ArrowRight,
  Check,
  Leaf,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Star,
  X,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  SAND: 'Smiltis',
  GRAVEL: 'Grants',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Augsne',
  RECYCLED_CONCRETE: 'Recikl. Betons',
  RECYCLED_SOIL: 'Recikl. Augsne',
  ASPHALT: 'Asfalts',
  CLAY: 'Māls',
  OTHER: 'Cits',
};

const UNIT_LABEL: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krāvums',
};

// ── Add-to-cart modal ─────────────────────────────────────────────────────────

function AddToCartModal({
  material,
  onClose,
  onAdded,
}: {
  material: ApiMaterial;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { addItem, items } = useCart();
  const existing = items.find((i) => i.material.id === material.id);
  const step = material.unit === 'TONNE' || material.unit === 'M3' ? 0.5 : 1;
  const min = material.minOrder ?? step;
  const [qty, setQty] = useState<number>(existing?.quantity ?? min);
  const [added, setAdded] = useState(false);

  function adjust(delta: number) {
    setQty((q) => Math.max(min, parseFloat((q + delta).toFixed(2))));
  }

  function handleAdd() {
    addItem(material, qty);
    setAdded(true);
    setTimeout(() => {
      onAdded();
      onClose();
    }, 800);
  }

  const lineTotal = qty * material.basePrice;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full sm:max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b">
          <div>
            <p className="font-bold text-lg leading-tight">{material.name}</p>
            <p className="text-sm text-muted-foreground">
              €{material.basePrice.toFixed(2)} / {UNIT_LABEL[material.unit]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Qty stepper */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Daudzums ({UNIT_LABEL[material.unit]})
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjust(-step)}
                disabled={qty <= min}
                className="rounded-xl border p-2.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                value={qty}
                min={min}
                step={step}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= min) setQty(parseFloat(v.toFixed(2)));
                }}
                className="flex-1 text-center rounded-xl border px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={() => adjust(step)}
                className="rounded-xl border p-2.5 hover:bg-muted transition-colors"
              >
                <Plus className="size-4" />
              </button>
            </div>
            {material.minOrder && (
              <p className="text-xs text-muted-foreground mt-1">
                Min. pasūtījums: {material.minOrder} {UNIT_LABEL[material.unit]}
              </p>
            )}
          </div>

          {/* Price preview */}
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Kopā</span>
            <span className="font-bold text-lg">€{lineTotal.toFixed(2)}</span>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={added}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white transition-all ${
              added ? 'bg-green-600' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <ShoppingCart className="size-4" />
            {added ? 'Pievienots!' : existing ? 'Atjaunināt grozu' : 'Pievienot grozam'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cart bar ───────────────────────────────────────────────────────────────────

function CartBar() {
  const { count, total } = useCart();
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-2xl bg-gray-900 text-white px-5 py-3 shadow-2xl text-sm whitespace-nowrap">
      <ShoppingCart className="size-4 shrink-0" />
      <span className="font-semibold">
        {count} prece{count !== 1 ? 's' : ''} grozā
      </span>
      <span className="text-gray-400">·</span>
      <span className="font-bold">€{total.toFixed(2)}</span>
      <Link
        href="/dashboard/checkout"
        className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-3 py-1.5 font-bold text-white transition-colors ml-2"
      >
        Norēķināties
        <ArrowRight className="size-3.5" />
      </Link>
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
  const { items } = useCart();
  const catLabel = CATEGORY_LABEL[material.category] ?? material.category;
  const cartQty = items.find((i) => i.material.id === material.id)?.quantity;

  return (
    <div className="flex flex-col rounded-2xl border bg-card hover:shadow-md transition-shadow overflow-hidden">
      {/* Image / placeholder */}
      {material.images?.[0] ? (
        <img src={material.images[0]} alt={material.name} className="h-36 w-full object-cover" />
      ) : (
        <div className="h-36 w-full bg-linear-to-br from-stone-100 to-stone-200 flex items-center justify-center">
          <Package className="size-12 text-stone-400" />
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
              {catLabel}
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
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-colors ${
                cartQty ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <ShoppingCart className="size-3.5" />
              {cartQty ? `Grozā ${cartQty}${UNIT_LABEL[material.unit]}` : 'Grozam'}
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
  const { token } = useAuth();
  const router = useRouter();

  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<MaterialCategory | ''>('');
  const [orderTarget, setOrderTarget] = useState<ApiMaterial | null>(null);

  useEffect(() => {
    if (!token) router.push('/');
  }, [token, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([
        getMaterials(token, {
          category: category || undefined,
          search: search || undefined,
        }),
        categories.length === 0 ? getMaterialCategories(token) : Promise.resolve(categories),
      ]);
      setMaterials(data);
      if (categories.length === 0) setCategories(cats);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, category, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 pb-24">
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
              {CATEGORY_LABEL[c] ?? c}
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

      {/* Add-to-cart modal */}
      {orderTarget && (
        <AddToCartModal
          material={orderTarget}
          onClose={() => setOrderTarget(null)}
          onAdded={() => setOrderTarget(null)}
        />
      )}

      {/* Cart bar */}
      <CartBar />
    </div>
  );
}
