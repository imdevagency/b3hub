/**
 * Admin Catalog hub — /dashboard/admin/catalog
 * Links to taxonomy catalogues + active materials view.
 */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Package,
  Search,
  CheckCircle,
  Ban,
  ExternalLink,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Recycle,
  ArrowUpDown,
  Star,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import {
  adminGetMaterials,
  adminSetMaterialActive,
  adminUpdateMaterialDetails,
  type AdminMaterial,
} from '@/lib/api/admin';

import { CATEGORY_LABELS } from '@b3hub/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSpinner } from '@/components/ui/page-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ─── Shared ───────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = { TONNE: 't', M3: 'm³', PIECE: 'gb.', LOAD: 'kravas' };
function euro(v: number, currency = 'EUR') {
  return v.toLocaleString('lv-LV', { style: 'currency', currency, minimumFractionDigits: 2 });
}
function catLabel(cat: string) {
  return (CATEGORY_LABELS as Record<string, string>)[cat] ?? cat;
}

// ─── Materials tab ────────────────────────────────────────────────────────────

type MatStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const MATERIAL_CATEGORIES = [
  'SAND',
  'GRAVEL',
  'STONE',
  'CONCRETE',
  'SOIL',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'ASPHALT',
  'CLAY',
  'OTHER',
] as const;

const UNIT_OPTIONS = ['TONNE', 'M3', 'PIECE', 'LOAD'] as const;

interface EditForm {
  name: string;
  category: string;
  subCategory: string;
  basePrice: string;
  unit: string;
  inStock: boolean;
  stockQty: string;
  featured: boolean;
}

function MaterialsTab({ token }: { token: string }) {
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<MatStatusFilter>('ALL');
  const [editTarget, setEditTarget] = useState<AdminMaterial | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setMaterials(await adminGetMaterials(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(id: string, active: boolean) {
    if (!token) return;
    setTogglingId(id);
    try {
      await adminSetMaterialActive(id, active, token);
      setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, active } : m)));
    } finally {
      setTogglingId(null);
    }
  }

  function openEdit(m: AdminMaterial) {
    setEditTarget(m);
    setSaveError(null);
    setEditForm({
      name: m.name,
      category: m.category,
      subCategory: m.subCategory ?? '',
      basePrice: String(m.basePrice),
      unit: m.unit,
      inStock: m.inStock,
      stockQty: m.stockQty != null ? String(m.stockQty) : '',
      featured: m.featured,
    });
  }

  function closeEdit() {
    setEditTarget(null);
    setEditForm(null);
    setSaveError(null);
  }

  async function handleSaveEdit() {
    if (!editTarget || !editForm || !token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const dto: Parameters<typeof adminUpdateMaterialDetails>[1] = {};
      if (editForm.name !== editTarget.name) dto.name = editForm.name;
      if (editForm.category !== editTarget.category) dto.category = editForm.category;
      if (editForm.subCategory !== (editTarget.subCategory ?? ''))
        dto.subCategory = editForm.subCategory || undefined;
      const newPrice = parseFloat(editForm.basePrice);
      if (!isNaN(newPrice) && newPrice !== editTarget.basePrice) dto.basePrice = newPrice;
      if (editForm.unit !== editTarget.unit) dto.unit = editForm.unit;
      if (editForm.inStock !== editTarget.inStock) dto.inStock = editForm.inStock;
      const newQty = editForm.stockQty !== '' ? parseInt(editForm.stockQty, 10) : null;
      if (newQty !== editTarget.stockQty) dto.stockQty = newQty ?? undefined;
      if (editForm.featured !== editTarget.featured) dto.featured = editForm.featured;
      const updated = await adminUpdateMaterialDetails(editTarget.id, dto, token);
      setMaterials((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      closeEdit();
    } catch {
      setSaveError('Saglabāšana neizdevās. Mēģini vēlreiz.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleFeatured(id: string, featured: boolean) {
    if (!token) return;
    try {
      const updated = await adminUpdateMaterialDetails(id, { featured }, token);
      setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
    } catch {
      // silently ignore — UI will revert on next load
    }
  }

  const allCategories = Array.from(new Set(materials.map((m) => m.category)));
  const filtered = materials.filter((m) => {
    if (catFilter !== 'ALL' && m.category !== catFilter) return false;
    if (statusFilter === 'ACTIVE' && !m.active) return false;
    if (statusFilter === 'INACTIVE' && m.active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !m.name.toLowerCase().includes(q) &&
        !m.supplier.name.toLowerCase().includes(q) &&
        !m.category.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
  const inactiveCount = materials.filter((m) => !m.active).length;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{materials.length} materiāli kopā</span>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          Atjaunot
        </button>
      </div>

      {inactiveCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Ban className="h-4 w-4 shrink-0" />
          <span>
            <strong>{inactiveCount}</strong> deaktivizēti materiāli netiek rādīti pircēju katalogā.
          </span>
          <button
            type="button"
            className="ml-auto text-xs underline underline-offset-2"
            onClick={() => setStatusFilter('INACTIVE')}
          >
            Skatīt
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Meklēt pēc nosaukuma vai piegādātāja..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Kategorija
          </label>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">Visas</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {catLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Statuss
          </label>
          <div className="flex gap-1.5">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as MatStatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${statusFilter === s ? 'bg-foreground text-background border-foreground' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
              >
                {s === 'ALL' ? 'Visi' : s === 'ACTIVE' ? 'Aktīvie' : 'Deaktivizētie'}
              </button>
            ))}
          </div>
        </div>
        <span className="text-sm text-muted-foreground pb-1.5">{filtered.length} ieraksti</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-r-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nav materiālu"
          description="Nekas neatbilst meklēšanas kritērijiem."
        />
      ) : (
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    'Nosaukums',
                    'Kategorija',
                    'Piegādātājs',
                    'Cena',
                    'Noliktava',
                    'Pasūtījumi',
                    'Statuss',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide ${h === 'Cena' || h === '' ? 'text-right' : h === 'Noliktava' || h === 'Pasūtījumi' || h === 'Statuss' ? 'text-center' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className={`transition-colors hover:bg-muted/20 ${!m.active ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{m.name}</p>
                        {m.subCategory && (
                          <p className="text-xs text-muted-foreground">{m.subCategory}</p>
                        )}
                        {m.isRecycled && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">
                            <Recycle className="h-2.5 w-2.5" />
                            Pārstrādāts
                            {m.recoveryRate != null ? ` · ${m.recoveryRate.toFixed(0)}%` : ''}
                          </span>
                        )}
                        {m.isRecycled && m.provenanceFacility && (
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            {m.provenanceFacility}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        {catLabel(m.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/dashboard/admin/companies?id=${m.supplier.id}`}
                          className="text-sm font-medium text-foreground hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {m.supplier.name}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Link>
                        {!m.supplier.verified && (
                          <span className="text-[10px] rounded px-1 py-0.5 bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                            Nav verif.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {euro(m.basePrice, m.currency)}
                      <span className="text-xs text-muted-foreground font-normal ml-0.5">
                        /{UNIT_LABELS[m.unit] ?? m.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.inStock ? (
                        <span className="text-xs text-emerald-700 font-medium">
                          {m.stockQty != null
                            ? `${m.stockQty.toLocaleString()} ${UNIT_LABELS[m.unit] ?? m.unit}`
                            : 'Ir'}
                        </span>
                      ) : (
                        <span className="text-xs text-red-600 font-medium">Nav</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`tabular-nums text-sm ${m._count.orderItems > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                      >
                        {m._count.orderItems}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                          <CheckCircle className="h-3 w-3" />
                          Aktīvs
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-semibold">
                          <Ban className="h-3 w-3" />
                          Deaktivizēts
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Featured star — quick toggle */}
                        <button
                          title={m.featured ? 'Noņemt no veicināšanas' : 'Veicināt katalogā'}
                          onClick={() => handleToggleFeatured(m.id, !m.featured)}
                          className={cn(
                            'p-1.5 rounded transition-colors',
                            m.featured
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-muted-foreground hover:text-amber-500',
                          )}
                        >
                          <Star className={cn('h-4 w-4', m.featured && 'fill-amber-400')} />
                        </button>
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(m)}
                          className="px-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {/* Active toggle */}
                        {m.active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={togglingId === m.id}
                            onClick={() => handleToggle(m.id, false)}
                            className="text-red-700 border-red-200 hover:bg-red-50"
                          >
                            {togglingId === m.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Deaktivizēt
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={togglingId === m.id}
                            onClick={() => handleToggle(m.id, true)}
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          >
                            {togglingId === m.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Aktivizēt
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Edit material dialog ──────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Rediģēt materiālu</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 pt-1">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nosaukums</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => f && { ...f, name: e.target.value })}
                />
              </div>
              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kategorija</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(v) => setEditForm((f) => f && { ...f, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {catLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sub">Apakškategorija</Label>
                  <Input
                    id="edit-sub"
                    placeholder="nav"
                    value={editForm.subCategory}
                    onChange={(e) => setEditForm((f) => f && { ...f, subCategory: e.target.value })}
                  />
                </div>
              </div>
              {/* Price + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-price">Bāzes cena (€)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={editForm.basePrice}
                    onChange={(e) => setEditForm((f) => f && { ...f, basePrice: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Vienība</Label>
                  <Select
                    value={editForm.unit}
                    onValueChange={(v) => setEditForm((f) => f && { ...f, unit: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {UNIT_LABELS[u] ?? u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Stock */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    id="edit-instock"
                    checked={editForm.inStock}
                    onCheckedChange={(v) => setEditForm((f) => f && { ...f, inStock: v })}
                  />
                  <Label htmlFor="edit-instock">Noliktavā</Label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-qty">Daudzums</Label>
                  <Input
                    id="edit-qty"
                    type="number"
                    min={0}
                    placeholder="nav norādīts"
                    value={editForm.stockQty}
                    onChange={(e) => setEditForm((f) => f && { ...f, stockQty: e.target.value })}
                  />
                </div>
              </div>
              {/* Featured */}
              <div className="flex items-center gap-2 rounded-lg border px-4 py-3 bg-amber-50 border-amber-200">
                <Switch
                  id="edit-featured"
                  checked={editForm.featured}
                  onCheckedChange={(v) => setEditForm((f) => f && { ...f, featured: v })}
                />
                <div>
                  <Label htmlFor="edit-featured" className="font-medium">
                    Veicināts katalogā
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Šis materiāls tiks rādīts augstāk katalogā
                  </p>
                </div>
                <Star
                  className={cn(
                    'h-4 w-4 ml-auto',
                    editForm.featured ? 'text-amber-500 fill-amber-400' : 'text-muted-foreground',
                  )}
                />
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              Atcelt
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Saglabāt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

const TAXONOMY_LINKS = [
  {
    href: '/dashboard/admin/catalog/material-categories',
    label: 'Materiālu kategorijas',
    description: 'Blīvums, mērvienība, ikona',
  },
  {
    href: '/dashboard/admin/catalog/material-fractions',
    label: 'Materiālu frakcijas',
    description: 'EU standartu frakcijas (55)',
  },
  {
    href: '/dashboard/admin/catalog/waste-types',
    label: 'Atkritumu veidi',
    description: 'Utilizācijas vedņa izvēle',
  },
  {
    href: '/dashboard/admin/catalog/vehicle-categories',
    label: 'Transportlīdzekļu kategorijas',
    description: 'Ietilpība, cenas, ikona',
  },
] as const;

function CatalogHubContent() {
  const { token: rawToken, isLoading } = useAuth();
  const token = rawToken ?? '';

  if (isLoading) return null;

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <PageHeader title="Katalogs" description="Materiālu un konteineru izmēru pārvaldība" />

      {/* Taxonomy catalogue links */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Taksonomijas katalogi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TAXONOMY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group block rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-accent transition-colors"
            >
              <div className="font-medium text-sm group-hover:text-primary transition-colors">
                {l.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{l.description}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Materials tab */}
      <MaterialsTab token={token} />
    </div>
  );
}

export default function CatalogHubPage() {
  return (
    <Suspense>
      <CatalogHubContent />
    </Suspense>
  );
}
