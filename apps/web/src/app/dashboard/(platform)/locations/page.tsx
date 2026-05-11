/**
 * Supplier Locations management page — /dashboard/locations
 * Allows approved sellers to manage their quarry / loading sites.
 * Each location can then be selected per material listing.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getMySupplierLocations,
  createSupplierLocation,
  updateSupplierLocation,
  deleteSupplierLocation,
  type ApiSupplierLocation,
  type CreateSupplierLocationInput,
} from '@/lib/api';
import { MapPin, Pencil, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageSpinner } from '@/components/ui/page-spinner';

// ── Form ──────────────────────────────────────────────────────────────────────

interface LocationFormValues {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  lat: string;
  lng: string;
}

const EMPTY_FORM: LocationFormValues = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'LV',
  lat: '',
  lng: '',
};

function locationToForm(loc: ApiSupplierLocation): LocationFormValues {
  return {
    name: loc.name,
    address: loc.address,
    city: loc.city ?? '',
    postalCode: loc.postalCode ?? '',
    country: loc.country,
    lat: loc.lat != null ? String(loc.lat) : '',
    lng: loc.lng != null ? String(loc.lng) : '',
  };
}

function LocationFormSheet({
  open,
  token,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  token: string;
  editing: ApiSupplierLocation | null;
  onClose: () => void;
  onSaved: (loc: ApiSupplierLocation) => void;
}) {
  const [form, setForm] = useState<LocationFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(editing ? locationToForm(editing) : EMPTY_FORM);
      setError('');
    }
  }, [open, editing]);

  const set = (k: keyof LocationFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Lūdzu ievadiet nosaukumu.');
      return;
    }
    if (!form.address.trim()) {
      setError('Lūdzu ievadiet adresi.');
      return;
    }

    const input: CreateSupplierLocationInput = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      country: form.country.trim() || 'LV',
      lat: form.lat ? parseFloat(form.lat) : undefined,
      lng: form.lng ? parseFloat(form.lng) : undefined,
    };

    setSaving(true);
    setError('');
    try {
      const result = editing
        ? await updateSupplierLocation(editing.id, input, token)
        : await createSupplierLocation(input, token);
      onSaved(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda saglabājot atrašanās vietu.');
    } finally {
      setSaving(false);
    }
  }

  const inputClasses =
    'bg-muted/40 border-0 shadow-none h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-[15px] transition-colors mt-1.5';

  return (
    <Sheet open={open} onOpenChange={(o) => (!o && !saving ? onClose() : null)}>
      <SheetContent className="sm:max-w-lg w-full overflow-hidden p-0 flex flex-col border-l shadow-2xl">
        <div className="px-6 pt-8 pb-4">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold tracking-tight">
              {editing ? 'Rediģēt karjeru' : 'Pievienot karjeru'}
            </SheetTitle>
            <p className="text-[15px] text-muted-foreground leading-relaxed pt-1">
              Norādiet karjera / iekraušanas vietas informāciju. Pēc tam to varēsiet piesaistīt
              konkrētiem materiālu sludinājumiem.
            </p>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 px-6 space-y-5 overflow-y-auto pb-32">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <Label className="text-sm font-medium ml-1">Nosaukums *</Label>
              <Input
                placeholder="piem. Jaunbemberi"
                value={form.name}
                onChange={set('name')}
                required
                className={inputClasses}
              />
            </div>

            <div>
              <Label className="text-sm font-medium ml-1">Pilna adrese *</Label>
              <Input
                placeholder={`piem. "Bačas", Salgales pagasts, Jelgavas novads`}
                value={form.address}
                onChange={set('address')}
                required
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium ml-1">Pilsēta / pagasts</Label>
                <Input
                  placeholder="piem. Iecava"
                  value={form.city}
                  onChange={set('city')}
                  className={inputClasses}
                />
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">Pasta indekss</Label>
                <Input
                  placeholder="piem. LV-3913"
                  value={form.postalCode}
                  onChange={set('postalCode')}
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium ml-1">Valsts</Label>
              <Input
                placeholder="LV"
                value={form.country}
                onChange={set('country')}
                maxLength={5}
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium ml-1">Platums (lat)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="piem. 56.842"
                  value={form.lat}
                  onChange={set('lat')}
                  className={inputClasses}
                />
              </div>
              <div>
                <Label className="text-sm font-medium ml-1">Garums (lng)</Label>
                <Input
                  type="number"
                  step="0.000001"
                  placeholder="piem. 24.605"
                  value={form.lng}
                  onChange={set('lng')}
                  className={inputClasses}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3 ml-1">
              Koordinātes izmanto attāluma aprēķinam katalogā. Varat pievienot vēlāk.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-background flex gap-3 mt-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 rounded-xl"
              onClick={onClose}
              disabled={saving}
            >
              Atcelt
            </Button>
            <Button type="submit" className="flex-1 h-12 rounded-xl" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {editing ? 'Saglabāt izmaiņas' : 'Pievienot karjeru'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupplierLocationsPage() {
  const { token } = useAuth();
  const accessToken = token ?? '';

  const [locations, setLocations] = useState<ApiSupplierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ApiSupplierLocation | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getMySupplierLocations(accessToken);
      setLocations(data);
    } catch {
      // handled silently — empty state shown
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(loc: ApiSupplierLocation) {
    setEditing(loc);
    setSheetOpen(true);
  }
  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  function handleSaved(loc: ApiSupplierLocation) {
    setLocations((prev) =>
      editing ? prev.map((l) => (l.id === loc.id ? loc : l)) : [...prev, loc],
    );
    closeSheet();
  }

  async function handleDelete(id: string) {
    if (!confirm('Dzēst šo atrašanās vietu? Materiālu saites tiks saglabātas.')) return;
    setDeletingId(id);
    try {
      await deleteSupplierLocation(id, accessToken);
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch {
      alert('Neizdevās dzēst atrašanās vietu.');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Karjeri un iekraušanas vietas"
        description="Pārvaldiet visas iekraušanas vietas. Piesaistiet tās materiāliem, lai pircēji redzētu precīzu kravu izcelsmes punktu."
        action={
          <Button onClick={openCreate} className="gap-2 rounded-xl h-10 px-5">
            <Plus className="size-4" />
            Pievienot karjeru
          </Button>
        }
      />

      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nav pievienotu vietu"
          description="Pievienojiet karjerus un iekraušanas vietas, lai materiālu sludinājumos varētu norādīt precīzu kraušanas punktu."
          action={
            <Button onClick={openCreate} variant="outline" className="gap-2 mt-4 rounded-xl">
              <Plus className="size-4" />
              Pievienot pirmo karjeru
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-start gap-4 bg-card border border-border rounded-2xl px-5 py-4"
            >
              <div className="mt-0.5 size-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="size-4 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] leading-tight">{loc.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{loc.address}</p>
                {(loc.city || loc.postalCode) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[loc.city, loc.postalCode, loc.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {loc.lat != null && loc.lng != null && (
                  <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                    {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  </p>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-lg"
                  onClick={() => openEdit(loc)}
                  aria-label="Rediģēt"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(loc.id)}
                  disabled={deletingId === loc.id}
                  aria-label="Dzēst"
                >
                  {deletingId === loc.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LocationFormSheet
        open={sheetOpen}
        token={accessToken}
        editing={editing}
        onClose={closeSheet}
        onSaved={handleSaved}
      />
    </div>
  );
}
