/**
 * MatStep1What — Materials order wizard step 1 (What: pick materials + quantities).
 * Presents a searchable mini-catalog; user selects items and adjusts quantities.
 * An initial materialId can be pre-selected when arriving from the catalog page.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getMaterials,
  type ApiMaterial,
  type MaterialCategory,
  type MaterialUnit,
} from '@/lib/api';
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Leaf,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORY_LABELS, UNIT_SHORT } from '@b3hub/shared';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABEL = CATEGORY_LABELS;

const UNIT_LABEL = UNIT_SHORT;

/** Bulk density t/m³ for volume → weight conversion */
const MATERIAL_DENSITY: Partial<Record<string, number>> = {
  SAND: 1.6,
  GRAVEL: 1.8,
  STONE: 2.7,
  CONCRETE: 2.4,
  SOIL: 1.7,
  RECYCLED_CONCRETE: 1.5,
  RECYCLED_SOIL: 1.5,
  ASPHALT: 2.3,
  CLAY: 1.8,
  OTHER: 1.7,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedItem {
  material: ApiMaterial;
  qty: number;
}

interface Props {
  /** materialId pre-selected when arriving from the catalog page */
  initialMaterialId?: string;
  items: SelectedItem[];
  onItemsChange: (items: SelectedItem[]) => void;
  onNext: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MatStep1What({ initialMaterialId, items, onItemsChange, onNext }: Props) {
  const { token } = useAuth();
  const [materials, setMaterials] = useState<ApiMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Inline qty-picker state
  const [activePick, setActivePick] = useState<ApiMaterial | null>(null);
  const [pickQty, setPickQty] = useState(1);
  const [didAutoSelect, setDidAutoSelect] = useState(false);

  // Calculator state (inside picker)
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcW, setCalcW] = useState('');
  const [calcL, setCalcL] = useState('');
  const [calcD, setCalcD] = useState('');

  // ── Data fetching ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMaterials(token, { search: search || undefined });
      setMaterials(data.filter((m) => m.inStock));
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Auto-open picker when arriving from catalog
  useEffect(() => {
    if (didAutoSelect || !initialMaterialId || materials.length === 0) return;
    const found = materials.find((m) => m.id === initialMaterialId);
    if (found) {
      openPicker(found);
      setDidAutoSelect(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMaterialId, materials]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getStep(m: ApiMaterial) {
    return m.unit === 'TONNE' || m.unit === 'M3' ? 0.5 : 1;
  }

  function openPicker(m: ApiMaterial) {
    const existing = items.find((i) => i.material.id === m.id);
    const s = getStep(m);
    setPickQty(existing?.qty ?? m.minOrder ?? s);
    setActivePick(m);
    setCalcOpen(false);
    setCalcW('');
    setCalcL('');
    setCalcD('');
  }

  function confirmPick() {
    if (!activePick) return;
    const existing = items.find((i) => i.material.id === activePick.id);
    if (existing) {
      onItemsChange(
        items.map((i) => (i.material.id === activePick.id ? { ...i, qty: pickQty } : i)),
      );
    } else {
      onItemsChange([...items, { material: activePick, qty: pickQty }]);
    }
    setActivePick(null);
  }

  function removeItem(id: string) {
    onItemsChange(items.filter((i) => i.material.id !== id));
  }

  const basketTotal = items.reduce((sum, i) => sum + i.material.basePrice * i.qty, 0);
  const step = activePick ? getStep(activePick) : 1;
  const min = activePick ? (activePick.minOrder ?? step) : step;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col space-y-4">
      <div>
        <h2 className="text-lg font-bold">Ko pasūtīt?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Izvēlieties materiālu un norādiet daudzumu
        </p>
      </div>

      {/* ── Basket ── */}
      {items.length > 0 && (
        <div className="rounded-2xl border bg-muted/30 overflow-hidden">
          <div className="px-4 py-2.5 bg-primary/10 flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              Pasūtījumā
            </span>
            <span className="text-xs font-bold text-primary">€{basketTotal.toFixed(2)} + PVN</span>
          </div>
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.material.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.material.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} {UNIT_LABEL[item.material.unit]} × €
                    {item.material.basePrice.toFixed(2)} ={' '}
                    <span className="font-medium text-foreground">
                      €{(item.qty * item.material.basePrice).toFixed(2)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => openPicker(item.material)}
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Mainīt
                </button>
                <button
                  onClick={() => removeItem(item.material.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  aria-label="Noņemt"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Meklēt materiālus..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-xl border bg-muted/30 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              setSearch('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Notīrīt meklēšanu"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ── Material list ── */}
      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : materials.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Nav atrastu materiālu</div>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => {
            const inBasket = items.find((i) => i.material.id === m.id);
            const catLabel = CATEGORY_LABEL[m.category] ?? m.category;
            return (
              <button
                key={m.id}
                onClick={() => openPicker(m)}
                className={`w-full text-left flex items-center gap-3 rounded-xl border px-3 py-3 transition-all hover:shadow-sm ${
                  inBasket
                    ? 'border-primary/40 bg-primary/5'
                    : 'bg-card hover:border-primary/20 hover:bg-muted/20'
                }`}
              >
                {/* Thumbnail */}
                <div className="size-10 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {m.images?.[0] ? (
                    <img src={m.images[0]} alt="" className="size-10 object-cover" />
                  ) : (
                    <Package className="size-5 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{m.name}</p>
                    {m.isRecycled && <Leaf className="size-3 text-green-600 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.supplier.name}
                    {m.supplier.city ? ` · ${m.supplier.city}` : ''}
                  </p>
                  <span className="inline-block mt-0.5 text-[10px] rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                    {catLabel}
                  </span>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">€{m.basePrice.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">/{UNIT_LABEL[m.unit]}</p>
                </div>

                {/* In-basket indicator */}
                {inBasket && (
                  <div className="size-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-white">✓</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Next button ── */}
      <div className="pt-2 pb-4">
        <button
          onClick={onNext}
          disabled={items.length === 0}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {items.length === 0
            ? 'Izvēlieties vismaz vienu materiālu'
            : `Tālāk — piegādes adrese (${items.length} prec${items.length === 1 ? 'e' : 'es'})`}
        </button>
      </div>

      {/* ── Qty-picker modal ── */}
      {activePick && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="w-full sm:max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-start justify-between p-5 pb-4 border-b">
              <div>
                <p className="font-bold text-lg leading-tight">{activePick.name}</p>
                <p className="text-sm text-muted-foreground">
                  {activePick.supplier.name} · €{activePick.basePrice.toFixed(2)} /{' '}
                  {UNIT_LABEL[activePick.unit]}
                </p>
              </div>
              <button
                onClick={() => setActivePick(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                aria-label="Aizvērt"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Daudzums ({UNIT_LABEL[activePick.unit]})
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setPickQty((q) => Math.max(min, parseFloat((q - step).toFixed(2))))
                    }
                    disabled={pickQty <= min}
                    className="rounded-xl border p-2.5 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    value={pickQty}
                    min={min}
                    step={step}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= min) setPickQty(parseFloat(v.toFixed(2)));
                    }}
                    className="flex-1 text-center rounded-xl border px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => setPickQty((q) => parseFloat((q + step).toFixed(2)))}
                    className="rounded-xl border p-2.5 hover:bg-muted transition-colors"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                {activePick.minOrder && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Min. {activePick.minOrder} {UNIT_LABEL[activePick.unit]}
                  </p>
                )}
              </div>

              {/* Line total */}
              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">Starpsumma</span>
                <span className="font-bold text-lg">
                  €{(pickQty * activePick.basePrice).toFixed(2)}
                </span>
              </div>

              {/* Calculator (only for weight/volume units) */}
              {(activePick.unit === 'TONNE' || activePick.unit === 'M3') &&
                (() => {
                  const w = parseFloat(calcW) || 0;
                  const l = parseFloat(calcL) || 0;
                  const d = parseFloat(calcD) || 0;
                  const m3 = w * l * d;
                  const density = MATERIAL_DENSITY[activePick.category] ?? 1.7;
                  const tonnes = m3 * density;
                  const hasResult = m3 > 0;
                  const resultValue = activePick.unit === 'TONNE' ? tonnes : m3;
                  return (
                    <div className="rounded-xl border bg-muted/20 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCalcOpen((o) => !o)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <Calculator className="size-4 text-muted-foreground" />
                        <span className="flex-1 text-sm text-muted-foreground font-medium">
                          Daudzuma kalkulators
                        </span>
                        {calcOpen ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      {calcOpen && (
                        <div className="px-4 pb-4 space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Ievadiet laukuma izmērus (metros), lai aprēķinātu nepieciešamo daudzumu.
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'Platums', value: calcW, set: setCalcW },
                              { label: 'Garums', value: calcL, set: setCalcL },
                              { label: 'Dziļums', value: calcD, set: setCalcD },
                            ].map(({ label, value, set }) => (
                              <div key={label}>
                                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                                  {label} (m)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={value}
                                  onChange={(e) => set(e.target.value)}
                                  placeholder="0"
                                  className="w-full rounded-lg border px-2 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                              </div>
                            ))}
                          </div>
                          {hasResult && (
                            <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2.5">
                              <div className="flex-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                                  Aptuveni nepieciešams
                                </p>
                                <p className="font-bold text-base mt-0.5">
                                  {resultValue.toFixed(1)} {UNIT_LABEL[activePick.unit]}
                                  {activePick.unit === 'TONNE' && (
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                      ({m3.toFixed(1)} m³)
                                    </span>
                                  )}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setPickQty(parseFloat(Math.ceil(resultValue).toFixed(2)));
                                  setCalcOpen(false);
                                }}
                                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors shrink-0"
                              >
                                Izmantot
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

              <button
                onClick={confirmPick}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
              >
                {items.find((i) => i.material.id === activePick.id)
                  ? 'Atjaunināt daudzumu'
                  : 'Pievienot pasūtījumam'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
