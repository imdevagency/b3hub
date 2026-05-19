/**
 * Admin Material Catalog Moderation — /dashboard/admin/materials
 * Lists every supplier material listing. Admins can deactivate/reactivate
 * individual listings to remove bad entries from the buyer catalog.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { adminGetMaterials, adminSetMaterialActive, type AdminMaterial } from '@/lib/api/admin';
import { CATEGORY_LABELS } from '@b3hub/shared';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Package,
  Search,
  CheckCircle,
  Ban,
  ExternalLink,
  Recycle,
  ArrowDown,
  Factory,
  FileCheck2,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<string, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'kravas',
};

function euro(v: number, currency = 'EUR') {
  return v.toLocaleString('lv-LV', { style: 'currency', currency, minimumFractionDigits: 2 });
}

function catLabel(cat: string) {
  return (CATEGORY_LABELS as Record<string, string>)[cat] ?? cat;
}

// ─── status pill ─────────────────────────────────────────────────────────────

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
      <CheckCircle className="h-3 w-3" />
      Aktīvs
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-semibold">
      <Ban className="h-3 w-3" />
      Deaktivizēts
    </span>
  );
}

// ─── toggle button ────────────────────────────────────────────────────────────

function ToggleButton({
  material,
  onToggle,
  loading,
}: {
  material: AdminMaterial;
  onToggle: (id: string, active: boolean) => void;
  loading: boolean;
}) {
  return material.active ? (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => onToggle(material.id, false)}
      className="text-red-700 border-red-200 hover:bg-red-50 hover:border-red-300"
    >
      {loading ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Ban className="h-3.5 w-3.5 mr-1" />
      )}
      Deaktivizēt
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => onToggle(material.id, true)}
      className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
    >
      {loading ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCircle className="h-3.5 w-3.5 mr-1" />
      )}
      Aktivizēt
    </Button>
  );
}

// ─── provenance dialog ────────────────────────────────────────────────────────

function ProvenanceDialog({
  material,
  open,
  onClose,
}: {
  material: AdminMaterial | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!material) return null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5 text-emerald-600" />
            Pārstrādes ķēde
          </DialogTitle>
          <DialogDescription>
            Cirkulārās ekonomikas izsekojamība — {material.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Step 1 — Waste source */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Factory className="h-4 w-4 text-red-600" />
              </div>
              <div className="w-0.5 flex-1 bg-border mt-1" />
            </div>
            <div className="pb-4">
              <p className="text-sm font-semibold text-foreground">Izcelsmes atkritumu ieraksts</p>
              {material.wasteRecordId ? (
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  ID: {material.wasteRecordId}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Nav norādīts</p>
              )}
              {material.provenanceFacility && (
                <p className="text-xs text-emerald-700 mt-1 font-medium">
                  Iestāde: {material.provenanceFacility}
                </p>
              )}
            </div>
          </div>

          {/* Step 2 — Processing */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <Recycle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="w-0.5 flex-1 bg-border mt-1" />
            </div>
            <div className="pb-4">
              <p className="text-sm font-semibold text-foreground">Pārstrādes process</p>
              {material.recoveryRate != null ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atgūšanas koeficients:{' '}
                  <span className="font-semibold text-foreground">
                    {material.recoveryRate.toFixed(0)}%
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Atgūšanas koeficients: —</p>
              )}
            </div>
          </div>

          {/* Step 3 — Material listing */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="w-0.5 flex-1 bg-border mt-1" />
            </div>
            <div className="pb-4">
              <p className="text-sm font-semibold text-foreground">Materiāls katalogā</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {material.name} — {material.supplier.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pasūtījumi:{' '}
                <span className="font-semibold text-foreground">{material._count.orderItems}</span>
              </p>
            </div>
          </div>

          {/* Step 4 — Orders (summary count) */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <FileCheck2 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Iepirkumu pasūtījumi</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {material._count.orderItems > 0
                  ? `${material._count.orderItems} pasūtījumu pozīcijas no šī materiāla`
                  : 'Vēl nav pasūtījumu'}
              </p>
              {material.wasteRecordId && (
                <Link
                  href="/dashboard/recycling/waste-records"
                  className="text-xs text-blue-600 underline underline-offset-2 mt-1 inline-flex items-center gap-1"
                >
                  Skatīt atkritumu žurnālā
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function AdminMaterialsPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [materials, setMaterials] = useState<AdminMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [provenanceMaterial, setProvenanceMaterial] = useState<AdminMaterial | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetMaterials(token);
      setMaterials(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) load();
  }, [isLoading, token, load]);

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

  // Unique categories from actual data
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
    <div className="space-y-6">
      <PageHeader
        title="Materiālu Katalogs"
        description={`${materials.length} materiālu sarakstā`}
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Inactive warning banner */}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
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

        {/* Category */}
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

        {/* Status */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Statuss
          </label>
          <div className="flex gap-1.5">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  statusFilter === s
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'ALL' ? 'Visi' : s === 'ACTIVE' ? 'Aktīvie' : 'Deaktivizētie'}
              </button>
            ))}
          </div>
        </div>

        <span className="text-sm text-muted-foreground pb-1.5">{filtered.length} ieraksti</span>
      </div>

      {/* Table */}
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
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Nosaukums
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Kategorija
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Piegādātājs
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Cena
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Noliktava
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Pasūtījumi
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Darbības
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((m) => (
                  <tr
                    key={m.id}
                    className={`transition-colors hover:bg-muted/20 ${!m.active ? 'opacity-60' : ''}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{m.name}</p>
                        {m.subCategory && (
                          <p className="text-xs text-muted-foreground">{m.subCategory}</p>
                        )}
                        {m.isRecycled && (
                          <button
                            type="button"
                            onClick={() => setProvenanceMaterial(m)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5 hover:bg-emerald-100 transition-colors"
                            title="Skatīt pārstrādes ķēdi"
                          >
                            <Recycle className="h-2.5 w-2.5" />
                            Pārstrādāts
                            {m.recoveryRate != null ? ` · ${m.recoveryRate.toFixed(0)}%` : ''}
                          </button>
                        )}
                        {m.isRecycled && m.provenanceFacility && (
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            {m.provenanceFacility}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        {catLabel(m.category)}
                      </span>
                    </td>

                    {/* Supplier */}
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

                    {/* Price */}
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {euro(m.basePrice, m.currency)}
                      <span className="text-xs text-muted-foreground font-normal ml-0.5">
                        /{UNIT_LABELS[m.unit] ?? m.unit}
                      </span>
                    </td>

                    {/* Stock */}
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

                    {/* Order count */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`tabular-nums text-sm ${m._count.orderItems > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                      >
                        {m._count.orderItems}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <StatusPill active={m.active} />
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <ToggleButton
                        material={m}
                        onToggle={handleToggle}
                        loading={togglingId === m.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProvenanceDialog
        material={provenanceMaterial}
        open={provenanceMaterial !== null}
        onClose={() => setProvenanceMaterial(null)}
      />
    </div>
  );
}
