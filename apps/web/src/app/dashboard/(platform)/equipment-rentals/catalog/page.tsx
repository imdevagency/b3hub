/**
 * Rental provider catalog — /dashboard/equipment-rentals/catalog
 *
 * Wolt "restaurant menu" — rental providers manage their own fleet listings.
 * Create/edit navigates to the full 5-step wizard (catalog/new and catalog/[id]/edit).
 * The sidesheet is intentionally removed — the wizard handles all 40+ fields safely.
 *
 * Guards: user must have canRent: true and companyId.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getMyRentalListings,
  updateRentalListing,
  deleteRentalListing,
  getRentalListingAvailability,
  setListingBlockedDates,
  type RentalListing,
  type RentalServiceType,
} from '@/lib/api/rentals';
import {
  CalendarDays,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PageSpinner } from '@/components/ui/page-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

// ── Service type labels ───────────────────────────────────────────────────────

const SERVICE_TYPE_LABELS: Record<RentalServiceType, string> = {
  MINI_EXCAVATOR: 'Mini ekskavators',
  EXCAVATOR: 'Ekskavators',
  DUMPER: 'Dempera pašizgāzējs',
  COMPACTOR: 'Kompaktors / rullītis',
  TELEHANDLER: 'Teleskopiskā iekrāvējs',
  AERIAL_PLATFORM: 'Pacēlājs / platforma',
  SCAFFOLDING: 'Sastatnes',
  TEMP_FENCING: 'Pagaidu žogs',
  SITE_OFFICE: 'Mobilā būvnieku mājiņa',
  GENERATOR: 'Ģenerators',
  LIGHTING_TOWER: 'Apgaismojuma tornis',
  WATER_BOWSER: 'Ūdens cisternas',
  AIR_COMPRESSOR: 'Gaisa kompresors',
  POWER_TOOLS: 'Elektroinstrumenti',
  WELDER: 'Metināšanas iekārta',
  HEATER: 'Sildītājs',
  CONCRETE_EQUIPMENT: 'Betona iekārtas',
  REBAR_EQUIPMENT: 'Armatūras iekārtas',
  ALUMINUM_TOWER: 'Alumīnija tornis',
};

// ── Availability calendar dialog ─────────────────────────────────────────────

function AvailabilityDialog({
  listing,
  token,
  onClose,
}: {
  listing: RentalListing;
  token: string;
  onClose: () => void;
}) {
  const [blocked, setBlocked] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getRentalListingAvailability(listing.id)
      .then((res) => {
        setBlocked(res.blockedDates.map((d) => new Date(d + 'T00:00:00')));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [listing.id]);

  function toggleDate(date: Date) {
    const key = date.toISOString().slice(0, 10);
    setBlocked((prev) => {
      const exists = prev.some((d) => d.toISOString().slice(0, 10) === key);
      return exists ? prev.filter((d) => d.toISOString().slice(0, 10) !== key) : [...prev, date];
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setListingBlockedDates(
        listing.id,
        blocked.map((d) => d.toISOString().slice(0, 10)),
        token,
      );
      onClose();
    } catch {
      /* silent */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pieejamība — {listing.name}</DialogTitle>
          <DialogDescription>
            Noklikšķiniet uz datuma, lai to bloķētu vai atbloķētu. Bloķētie datumi netiks piedāvāti
            pircējiem.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            <Calendar
              mode="multiple"
              selected={blocked}
              onDayClick={toggleDate}
              disabled={{ before: new Date() }}
              modifiers={{ booked: blocked }}
              modifiersClassNames={{
                booked: 'bg-destructive/20 text-destructive font-bold rounded-md',
              }}
              className="rounded-xl border border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              {blocked.length > 0
                ? `${blocked.length} datums(-i) bloķēts(-i)`
                : 'Nav bloķētu datumu — iekārta pieejama visās dienās'}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : 'Saglabāt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Listing row ───────────────────────────────────────────────────────────────

function ListingRow({
  listing,
  onEdit,
  onToggle,
  onDelete,
  onAvailability,
}: {
  listing: RentalListing;
  onEdit: (l: RentalListing) => void;
  onToggle: (l: RentalListing) => void;
  onDelete: (l: RentalListing) => void;
  onAvailability: (l: RentalListing) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      {/* Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Wrench className="size-5 text-muted-foreground" strokeWidth={1.5} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-foreground truncate">{listing.name}</p>
          <Badge variant={listing.isActive ? 'default' : 'secondary'} className="text-xs">
            {listing.isActive ? 'Aktīvs' : 'Deaktivizēts'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {SERVICE_TYPE_LABELS[listing.serviceType] ?? listing.serviceType} ·{' '}
          {listing.quantityTotal} {listing.unitLabel}
          {listing.coverageCities.length > 0 && ` · ${listing.coverageCities.join(', ')}`}
        </p>
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-foreground">
          €{listing.pricePerDay.toFixed(2)}
          <span className="text-xs font-normal text-muted-foreground">/{listing.unitLabel}/d.</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onAvailability(listing)}
          className="rounded-lg"
          title="Pārvaldīt pieejamību"
        >
          <CalendarDays className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggle(listing)}
          className="rounded-lg"
          title={listing.isActive ? 'Deaktivizēt' : 'Aktivizēt'}
        >
          {listing.isActive ? (
            <ToggleRight className="size-4 text-green-600" />
          ) : (
            <ToggleLeft className="size-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(listing)}
          className="rounded-lg"
          title="Rediģēt"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(listing)}
          className="rounded-lg text-destructive hover:text-destructive"
          title="Dzēst"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RentalCatalogPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [listings, setListings] = useState<RentalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RentalListing | null>(null);
  const [availabilityTarget, setAvailabilityTarget] = useState<RentalListing | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !token) router.push('/');
    if (!isLoading && user && !user.canRent) router.push('/dashboard');
  }, [token, isLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getMyRentalListings(token);
      setListings(data);
    } catch {
      setError('Neizdevās ielādēt sarakstu.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(listing: RentalListing) {
    if (!token) return;
    try {
      const updated = await updateRentalListing(listing.id, { isActive: !listing.isActive }, token);
      setListings((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch {
      /* silent */
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRentalListing(deleteTarget.id, token);
      setListings((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError('Dzēšana neizdevās.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mans katalogs"
        description="Pārvaldiet savu tehnikas sarakstu — pircēji redzēs jūsu iekārtas platformas katalogā"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={load}
              disabled={loading}
              className="rounded-xl"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              className="rounded-xl"
              onClick={() => router.push('/dashboard/equipment-rentals/catalog/new')}
            >
              <Plus className="size-4 mr-1.5" />
              Pievienot iekārtu
            </Button>
          </div>
        }
      />

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <PageSpinner />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Katalogs ir tukšs"
          description="Pievienojiet pirmo iekārtu, lai pircēji to varētu atrast un pasūtīt"
          action={
            <Button
              className="rounded-xl"
              onClick={() => router.push('/dashboard/equipment-rentals/catalog/new')}
            >
              <Plus className="size-4 mr-1.5" />
              Pievienot iekārtu
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {listings.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                onEdit={(l) => router.push(`/dashboard/equipment-rentals/catalog/${l.id}/edit`)}
                onToggle={handleToggle}
                onDelete={setDeleteTarget}
                onAvailability={setAvailabilityTarget}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Availability calendar dialog */}
      {availabilityTarget && (
        <AvailabilityDialog
          listing={availabilityTarget}
          token={token ?? ''}
          onClose={() => setAvailabilityTarget(null)}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dzēst iekārtu?</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> tiks neatgriezeniski noņemts no jūsu kataloga.
              Esošie pasūtījumi netiks ietekmēti.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : 'Dzēst'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
