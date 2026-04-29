'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  adminListSkipSizes,
  adminUpsertSkipSize,
  adminDeleteSkipSize,
  type SkipSizeDefinition,
  type SkipCategory,
} from '@/lib/api/admin';
import { Package, Plus, MoreHorizontal, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<SkipCategory, string> = {
  SKIP: 'Open Skip',
  BIG_BAG: 'Big Bag',
  CONTAINER: 'Container',
};

const CATEGORY_COLOURS: Record<SkipCategory, string> = {
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

export default function SkipSizesPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [sizes, setSizes] = useState<SkipSizeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null); // null = new
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await adminListSkipSizes(token);
      setSizes(data);
    } catch {
      setError('Neizdevās ielādēt izmērus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) load();
  }, [authLoading, token, load]);

  // ── Toggle active via inline switch ──────────────────────────────────────
  async function handleToggleActive(size: SkipSizeDefinition) {
    try {
      const updated = await adminUpsertSkipSize(size.code, { isActive: !size.isActive }, token);
      setSizes((prev) => prev.map((s) => (s.code === updated.code ? updated : s)));
    } catch {
      setError('Neizdevās atjaunināt statusu.');
    }
  }

  // ── Open dialog ───────────────────────────────────────────────────────────
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

  // ── Save form ─────────────────────────────────────────────────────────────
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
        const existing = prev.findIndex((s) => s.code === updated.code);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = updated;
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

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(code: string) {
    if (
      !confirm(`Dzēst izmēru "${code}"? Aktīvie pasūtījumi, kas izmanto šo kodu, netiks ietekmēti.`)
    )
      return;
    try {
      await adminDeleteSkipSize(code, token);
      setSizes((prev) => prev.filter((s) => s.code !== code));
    } catch {
      setError('Neizdevās dzēst izmēru.');
    }
  }

  if (authLoading || loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konteineru izmēri"
        description="Pārvaldiet konteineru izmēru katalogu — to nosaukumi, tilpumi un cenas ir redzami mobilajā lietotnē."
        action={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            Jauns izmērs
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

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
                  {/* Sort order pill */}
                  <span className="w-6 text-center text-xs font-mono text-muted-foreground">
                    {size.sortOrder}
                  </span>

                  {/* Category badge */}
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      CATEGORY_COLOURS[size.category],
                    )}
                  >
                    {CATEGORY_LABELS[size.category]}
                  </span>

                  {/* Code + labels */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold">{size.code}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {size.label}
                      {size.labelLv && (
                        <span className="ml-2 text-muted-foreground/60">/ {size.labelLv}</span>
                      )}
                    </p>
                  </div>

                  {/* Volume */}
                  <span className="text-sm tabular-nums text-muted-foreground w-16 text-right">
                    {size.volumeM3} m³
                  </span>

                  {/* Base price */}
                  <span className="text-sm tabular-nums font-medium w-20 text-right">
                    {size.basePrice != null ? `€${size.basePrice}` : '—'}
                  </span>

                  {/* Active toggle */}
                  <Switch
                    checked={size.isActive}
                    onCheckedChange={() => handleToggleActive(size)}
                    aria-label={`Toggle ${size.code}`}
                  />

                  {/* Actions menu */}
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

      {/* ── Create / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? `Rediģēt: ${editingCode}` : 'Jauns konteinera izmērs'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Code — only editable when creating */}
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
                Unikāls identifikators (lielie burti + apakšsvītra). Nevar mainīt pēc izveides.
              </p>
            </div>

            {/* Label EN + LV */}
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

            {/* Volume + Category */}
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

            {/* Base price + Sort order */}
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

            {/* Height pct (visual proportion) */}
            <div className="grid gap-1.5">
              <Label htmlFor="sz-height">
                Vizuālā proporcija (0–1)
                <span className="text-xs text-muted-foreground ml-2">
                  — konteinera augstuma attēlojums mobilajā lietotnē
                </span>
              </Label>
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

            {/* Active */}
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
