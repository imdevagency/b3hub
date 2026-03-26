/**
 * Container Fleet page — /dashboard/containers/fleet
 * Carrier view: manage own container inventory (skip-hire operators only).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type ApiContainer,
  type ContainerType,
  type ContainerSize,
  type CreateContainerInput,
  getMyFleetContainers,
  createContainer,
  updateContainer,
  deleteContainer,
} from '@/lib/api/containers';
import { Plus, Trash2, RefreshCw, Package, Pencil, X, Check } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const CONTAINER_TYPES: { value: ContainerType; label: string }[] = [
  { value: 'SKIP', label: 'Skip' },
  { value: 'ROLL_OFF', label: 'Roll-Off' },
  { value: 'COMPACTOR', label: 'Kompaktors' },
  { value: 'HOOKLOADER', label: 'Āķkrāvējs' },
  { value: 'FLATBED', label: 'Platforma' },
];

const CONTAINER_SIZES: { value: ContainerSize; label: string }[] = [
  { value: 'SMALL', label: 'Mazs' },
  { value: 'MEDIUM', label: 'Vidējs' },
  { value: 'LARGE', label: 'Liels' },
  { value: 'EXTRA_LARGE', label: 'Ļoti liels' },
];

// ─── Add Container Modal ─────────────────────────────────────────────────────

interface AddContainerModalProps {
  token: string;
  onClose: () => void;
  onSaved: () => void;
  editing?: ApiContainer | null;
}

function AddContainerModal({ token, onClose, onSaved, editing }: AddContainerModalProps) {
  const [form, setForm] = useState<Partial<CreateContainerInput>>({
    containerType: editing?.containerType ?? 'SKIP',
    size: editing?.size ?? 'SMALL',
    volume: editing?.volume ?? undefined,
    maxWeight: editing?.maxWeight ?? undefined,
    rentalPrice: editing?.rentalPrice ?? undefined,
    deliveryFee: editing?.deliveryFee ?? 0,
    pickupFee: editing?.pickupFee ?? 0,
    location: editing?.location ?? '',
    currency: editing?.currency ?? 'EUR',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CreateContainerInput, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const { containerType, size, volume, maxWeight, rentalPrice, deliveryFee, pickupFee } = form;
    if (
      !containerType ||
      !size ||
      !volume ||
      !maxWeight ||
      rentalPrice == null ||
      deliveryFee == null ||
      pickupFee == null
    )
      return;
    setSaving(true);
    try {
      if (editing) {
        await updateContainer(token, editing.id, form as Partial<CreateContainerInput>);
      } else {
        await createContainer(token, form as CreateContainerInput);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? 'Rediģēt konteineru' : 'Pievienot konteineru'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Container type */}
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Tips *</Label>
            <select
              className="w-full h-9 rounded-md border text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={form.containerType}
              onChange={(e) => set('containerType', e.target.value as ContainerType)}
            >
              {CONTAINER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Size */}
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Izmērs *</Label>
            <select
              className="w-full h-9 rounded-md border text-sm px-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={form.size}
              onChange={(e) => set('size', e.target.value as ContainerSize)}
            >
              {CONTAINER_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Volume */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tilpums (m³) *</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="6.0"
              className="h-9 text-sm"
              value={form.volume ?? ''}
              onChange={(e) => set('volume', parseFloat(e.target.value))}
            />
          </div>

          {/* Max weight */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Maks. svars (t) *</Label>
            <Input
              type="number"
              min="0.1"
              step="0.1"
              placeholder="5.0"
              className="h-9 text-sm"
              value={form.maxWeight ?? ''}
              onChange={(e) => set('maxWeight', parseFloat(e.target.value))}
            />
          </div>

          {/* Rental price */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Nomas cena / dienā (€) *
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="25.00"
              className="h-9 text-sm"
              value={form.rentalPrice ?? ''}
              onChange={(e) => set('rentalPrice', parseFloat(e.target.value))}
            />
          </div>

          {/* Delivery fee */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Piegādes maksa (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="h-9 text-sm"
              value={form.deliveryFee ?? ''}
              onChange={(e) => set('deliveryFee', parseFloat(e.target.value))}
            />
          </div>

          {/* Pickup fee */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Savākšanas maksa (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="h-9 text-sm"
              value={form.pickupFee ?? ''}
              onChange={(e) => set('pickupFee', parseFloat(e.target.value))}
            />
          </div>

          {/* Location */}
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Atrašanās vieta</Label>
            <Input
              placeholder="Rīga"
              className="h-9 text-sm"
              value={form.location ?? ''}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Atcelt
          </Button>
          <Button
            size="sm"
            disabled={saving || !form.containerType || !form.volume || form.rentalPrice == null}
            onClick={handleSubmit}
            className="gap-1.5"
          >
            {saving ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {editing ? 'Saglabāt' : 'Pievienot'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Fleet tab ───────────────────────────────────────────────────────────────

function FleetTab({ token }: { token: string }) {
  const [containers, setContainers] = useState<ApiContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingContainer, setEditingContainer] = useState<ApiContainer | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContainers(await getMyFleetContainers(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Dzēst šo konteineru no flotes?')) return;
    setDeletingId(id);
    try {
      await deleteContainer(token, id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const containerTypeLabel = (t: ContainerType) =>
    CONTAINER_TYPES.find((x) => x.value === t)?.label ?? t;
  const containerSizeLabel = (s: ContainerSize) =>
    CONTAINER_SIZES.find((x) => x.value === s)?.label ?? s;

  const statusColor: Record<string, string> = {
    AVAILABLE: 'bg-green-50 text-green-700 border-green-200',
    RENTED: 'bg-blue-50 text-blue-700 border-blue-200',
    MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-200',
    RETIRED: 'bg-gray-100 text-gray-400 border-gray-200',
  };
  const statusLabel: Record<string, string> = {
    AVAILABLE: 'Pieejams',
    RENTED: 'Iznomāts',
    MAINTENANCE: 'Remonts',
    RETIRED: 'Izslēgts',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{containers.length} konteineri flotē</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" />
          Pievienot konteineru
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : containers.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Flotē nav konteineru.</p>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            Pievienot pirmo konteineru
          </Button>
        </div>
      ) : (
        <div className="border rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 text-left">Tips / izmērs</th>
                <th className="px-5 py-3 text-left">Tilpums</th>
                <th className="px-5 py-3 text-left">Noma / dienā</th>
                <th className="px-5 py-3 text-left">Atrašanās</th>
                <th className="px-5 py-3 text-left">Statuss</th>
                <th className="px-5 py-3 text-right">Darbības</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-900">
                      {containerTypeLabel(c.containerType)}
                    </span>
                    <span className="text-muted-foreground"> · {containerSizeLabel(c.size)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.volume} m³</td>
                  <td className="px-5 py-3.5 font-semibold">€ {c.rentalPrice.toFixed(2)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.location || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${
                        statusColor[c.status] ?? 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {statusLabel[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingContainer(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-red-50"
                        disabled={deletingId === c.id}
                        onClick={() => handleDelete(c.id)}
                      >
                        {deletingId === c.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showAdd || editingContainer) && (
        <AddContainerModal
          token={token}
          editing={editingContainer}
          onClose={() => {
            setShowAdd(false);
            setEditingContainer(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditingContainer(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Orders tab ──────────────────────────────────────────────────────────────

// NOTE: A dedicated carrier-side "incoming rental orders" endpoint does not yet
// exist on the backend (GET /containers/orders returns the caller's own buyer
// orders). This tab is intentionally omitted until that endpoint is added.

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ContainerFleetPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  if (isLoading || !token) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konteineru flote"
        description="Pārvaldiet savus konteinerus — pievienojiet, rediģējiet vai deaktivizējiet"
      />
      <FleetTab token={token} />
    </div>
  );
}
