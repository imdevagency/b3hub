/**
 * Admin Catalog hub — /dashboard/admin/catalog
 * Tabbed hub: Materiāli · Skip izmēri
 */
'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  ArrowUpDown,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetMaterials, adminSetMaterialActive, type AdminMaterial } from '@/lib/api/admin';
import {
  adminListSkipSizes,
  adminUpsertSkipSize,
  adminDeleteSkipSize,
  type SkipSizeDefinition,
  type SkipCategory,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

function MaterialsTab({ token }: { token: string }) {
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<MatStatusFilter>('ALL');

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
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 mt-0.5">
                            Pārstrādāts
                          </span>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skip sizes tab ───────────────────────────────────────────────────────────

const SKIP_CATEGORY_LABELS: Record<SkipCategory, string> = {
  SKIP: 'Open Skip',
  BIG_BAG: 'Big Bag',
  CONTAINER: 'Container',
};
const SKIP_CATEGORY_COLOURS: Record<SkipCategory, string> = {
  SKIP: 'bg-blue-100 text-blue-800',
  BIG_BAG: 'bg-amber-100 text-amber-800',
  CONTAINER: 'bg-purple-100 text-purple-800',
};

type FormState = {
  code: string;
  label: string;
  labelLv: string;
  volumeM3: string;
  category: SkipCategory;
  description: string;
  descriptionLv: string;
  heightPct: string;
  basePrice: string;
  isActive: boolean;
  sortOrder: string;
};
const EMPTY_FORM: FormState = {
  code: '',
  label: '',
  labelLv: '',
  volumeM3: '',
  category: 'SKIP',
  description: '',
  descriptionLv: '',
  heightPct: '0.5',
  basePrice: '',
  isActive: true,
  sortOrder: '0',
};
function sizeToForm(s: SkipSizeDefinition): FormState {
  return {
    code: s.code,
    label: s.label,
    labelLv: s.labelLv ?? '',
    volumeM3: String(s.volumeM3),
    category: s.category,
    description: s.description ?? '',
    descriptionLv: s.descriptionLv ?? '',
    heightPct: String(s.heightPct),
    basePrice: s.basePrice != null ? String(s.basePrice) : '',
    isActive: s.isActive,
    sortOrder: String(s.sortOrder),
  };
}

function SkipSizesTab({ token }: { token: string }) {
  const [sizes, setSizes] = useState<SkipSizeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setSizes(await adminListSkipSizes(token));
    } catch {
      setError('Neizdevās ielādēt izmērus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleActive(size: SkipSizeDefinition) {
    try {
      const updated = await adminUpsertSkipSize(size.code, { isActive: !size.isActive }, token);
      setSizes((prev) => prev.map((s) => (s.code === updated.code ? updated : s)));
    } catch {
      setError('Neizdevās atjaunināt statusu.');
    }
  }

  function openNew() {
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }
  function openEdit(size: SkipSizeDefinition) {
    setEditingCode(size.code);
    setForm(sizeToForm(size));
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.code.trim()) {
      setFormError('Kods ir obligāts.');
      return;
    }
    if (!form.label.trim()) {
      setFormError('Nosaukums ir obligāts.');
      return;
    }
    const vol = parseFloat(form.volumeM3);
    if (isNaN(vol) || vol <= 0) {
      setFormError('Tilpumam jābūt pozitīvam skaitlim.');
      return;
    }
    try {
      setSaving(true);
      const updated = await adminUpsertSkipSize(
        form.code.trim().toUpperCase(),
        {
          label: form.label.trim(),
          labelLv: form.labelLv.trim() || undefined,
          volumeM3: vol,
          category: form.category,
          description: form.description.trim() || undefined,
          descriptionLv: form.descriptionLv.trim() || undefined,
          heightPct: parseFloat(form.heightPct) || 0.5,
          basePrice: form.basePrice ? parseFloat(form.basePrice) : undefined,
          isActive: form.isActive,
          sortOrder: parseInt(form.sortOrder) || 0,
        },
        token,
      );
      setSizes((prev) => {
        const i = prev.findIndex((s) => s.code === updated.code);
        if (i >= 0) {
          const next = [...prev];
          next[i] = updated;
          return next.sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return [...prev, updated].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      setDialogOpen(false);
    } catch {
      setFormError('Neizdevās saglabāt izmēru.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`Dzēst izmēru "${code}"?`)) return;
    try {
      await adminDeleteSkipSize(code, token);
      setSizes((prev) => prev.filter((s) => s.code !== code));
    } catch {
      setError('Neizdevās dzēst izmēru.');
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1.5" />
          Jauns izmērs
        </Button>
      </div>

      {sizes.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nav izmēru"
          description="Pievienojiet pirmo izmēru, lai tas parādītos mobilajā lietotnē."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" />
              Pievienot izmēru
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              {sizes.length} izmērs(-i) — sakārtots pēc secības
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="divide-y divide-border">
              {sizes.map((size) => (
                <div key={size.code} className="flex items-center gap-4 py-3">
                  <span className="w-6 text-center text-xs font-mono text-muted-foreground">
                    {size.sortOrder}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      SKIP_CATEGORY_COLOURS[size.category],
                    )}
                  >
                    {SKIP_CATEGORY_LABELS[size.category]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold">{size.code}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {size.label}
                      {size.labelLv && (
                        <span className="ml-2 text-muted-foreground/60">/ {size.labelLv}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground w-16 text-right">
                    {size.volumeM3} m³
                  </span>
                  <span className="text-sm tabular-nums font-medium w-20 text-right">
                    {size.basePrice != null ? `€${size.basePrice}` : '—'}
                  </span>
                  <Switch
                    checked={size.isActive}
                    onCheckedChange={() => handleToggleActive(size)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(size)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rediģēt
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(size.code)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Dzēst
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? `Rediģēt: ${editingCode}` : 'Jauns konteinera izmērs'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sz-code">Kods *</Label>
              <Input
                id="sz-code"
                placeholder="piem. BIG_BAG_2M3"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                disabled={!!editingCode}
              />
              <p className="text-xs text-muted-foreground">
                Unikāls identifikators. Nevar mainīt pēc izveides.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sz-label">Nosaukums (EN) *</Label>
                <Input
                  id="sz-label"
                  placeholder="Midi Skip (4 m³)"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sz-label-lv">Nosaukums (LV)</Label>
                <Input
                  id="sz-label-lv"
                  placeholder="Midi konteiners (4 m³)"
                  value={form.labelLv}
                  onChange={(e) => setForm((f) => ({ ...f, labelLv: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sz-vol">Tilpums (m³) *</Label>
                <Input
                  id="sz-vol"
                  type="number"
                  min="0.1"
                  step="0.5"
                  placeholder="4"
                  value={form.volumeM3}
                  onChange={(e) => setForm((f) => ({ ...f, volumeM3: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Kategorija</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v as SkipCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SKIP">Open Skip</SelectItem>
                    <SelectItem value="BIG_BAG">Big Bag</SelectItem>
                    <SelectItem value="CONTAINER">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sz-price">Bāzes cena (EUR)</Label>
                <Input
                  id="sz-price"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="129"
                  value={form.basePrice}
                  onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sz-sort">Secība</Label>
                <Input
                  id="sz-sort"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="2"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sz-height">Vizuālā proporcija (0–1)</Label>
              <Input
                id="sz-height"
                type="number"
                min="0"
                max="1"
                step="0.05"
                placeholder="0.5"
                value={form.heightPct}
                onChange={(e) => setForm((f) => ({ ...f, heightPct: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="sz-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="sz-active">Aktīvs (redzams mobilajā lietotnē)</Label>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Atcelt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saglabā...' : 'Saglabāt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

function CatalogHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token: rawToken, isLoading } = useAuth();
  const token = rawToken ?? '';
  const tab = searchParams.get('tab') ?? 'materials';

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <PageHeader title="Katalogs" description="Materiālu un konteineru izmēru pārvaldība" />
      <Tabs value={tab} onValueChange={(t) => router.push(`?tab=${t}`)}>
        <TabsList>
          <TabsTrigger value="materials">Materiāli</TabsTrigger>
          <TabsTrigger value="skip-sizes">Skip izmēri</TabsTrigger>
        </TabsList>
        <TabsContent value="materials">
          <MaterialsTab token={token} />
        </TabsContent>
        <TabsContent value="skip-sizes">
          <SkipSizesTab token={token} />
        </TabsContent>
      </Tabs>
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
