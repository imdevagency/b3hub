/**
 * Admin — Transport Job detail
 * /dashboard/admin/jobs/[id]
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  FileText,
  User,
  Building2,
  Car,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetTransportJobById,
  adminUpdateJobRate,
  adminReassignJob,
  type AdminTransportJobDetail,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { fmtDate } from '@/lib/format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  EN_ROUTE: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DISPUTED: 'bg-orange-100 text-orange-800',
};

const EXCEPTION_STATUS_COLOURS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
};

function euro(v: number, currency = 'EUR') {
  return v.toLocaleString('lv-LV', { style: 'currency', currency, minimumFractionDigits: 2 });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token: rawToken } = useAuth();
  const token = rawToken ?? '';

  const [job, setJob] = useState<AdminTransportJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rate edit
  const [rateEditing, setRateEditing] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);

  // Reassign dialog
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignDriverId, setReassignDriverId] = useState('');
  const [reassignNote, setReassignNote] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const j = await adminGetTransportJobById(id, token);
      setJob(j);
      setRateInput(String(j.rate));
    } catch {
      setError('Neizdevās ielādēt darba informāciju.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveRate() {
    if (!token || !job) return;
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate < 0) {
      setError('Nederīga likme.');
      return;
    }
    setRateSaving(true);
    try {
      const updated = await adminUpdateJobRate(job.id, { rate }, token);
      setJob((j) => (j ? { ...j, ...updated } : j));
      setRateEditing(false);
    } catch {
      setError('Neizdevās saglabāt likmi.');
    } finally {
      setRateSaving(false);
    }
  }

  async function handleReassign() {
    if (!token || !job || !reassignDriverId.trim()) return;
    setReassigning(true);
    try {
      await adminReassignJob(job.id, reassignDriverId.trim(), reassignNote.trim(), token);
      setReassignOpen(false);
      setReassignDriverId('');
      setReassignNote('');
      await load();
    } catch {
      setError('Neizdevās pārvietot darbu.');
    } finally {
      setReassigning(false);
    }
  }

  if (loading)
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (error || !job)
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Atpakaļ
        </Button>
        <p className="text-destructive">{error ?? 'Darbs nav atrasts.'}</p>
      </div>
    );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admin/jobs">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Transporta darbi
          </Link>
        </Button>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      <div className="flex items-start justify-between">
        <PageHeader
          title={job.jobNumber}
          description={`${job.jobType} · ${fmtDate(job.createdAt)}`}
        />
        <span
          className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOURS[job.status] ?? 'bg-muted text-foreground'}`}
        >
          {job.status}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Route & cargo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Maršruts un krava</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              No
            </p>
            {job.pickupCity ?? '—'}
            {job.pickupAddress && (
              <p className="text-xs text-muted-foreground mt-0.5">{job.pickupAddress}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Uz
            </p>
            {job.deliveryCity ?? '—'}
            {job.deliveryAddress && (
              <p className="text-xs text-muted-foreground mt-0.5">{job.deliveryAddress}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Krava
            </p>
            {job.cargoType ?? '—'}
            {job.cargoWeight && (
              <span className="ml-1 text-muted-foreground">({job.cargoWeight} t)</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Paņemšanas datums
            </p>
            {job.pickupDate ? fmtDate(job.pickupDate) : '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Piegādes datums
            </p>
            {job.deliveryDate ? fmtDate(job.deliveryDate) : '—'}
          </div>
          {job.notes && (
            <div className="col-span-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Piezīmes
              </p>
              {job.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Likme</CardTitle>
        </CardHeader>
        <CardContent>
          {rateEditing ? (
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-36"
              />
              <span className="text-sm text-muted-foreground">
                {job.currency}
                {job.pricePerTonne ? '/t' : ''}
              </span>
              <Button size="sm" onClick={saveRate} disabled={rateSaving}>
                Saglabāt
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRateEditing(false);
                  setRateInput(String(job.rate));
                }}
              >
                Atcelt
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold tabular-nums">
                {euro(job.rate, job.currency)}
              </span>
              {job.pricePerTonne && (
                <span className="text-sm text-muted-foreground">
                  {euro(job.pricePerTonne, job.currency)}/t
                </span>
              )}
              <Button size="sm" variant="outline" onClick={() => setRateEditing(true)}>
                Mainīt
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order link */}
      {job.order && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pasūtījums</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/admin/orders/${job.order.id}`}
              className="font-mono text-sm font-medium hover:underline flex items-center gap-1"
            >
              {(job.order as { orderNumber?: string }).orderNumber ?? job.order.id}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Driver & carrier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Vadītājs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {job.driver ? (
              <div className="space-y-1">
                <Link
                  href={`/dashboard/admin/users/${job.driver.id}`}
                  className="font-medium hover:underline flex items-center gap-1"
                >
                  {job.driver.firstName} {job.driver.lastName}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
                {job.driver.phone && (
                  <p className="text-xs text-muted-foreground">{job.driver.phone}</p>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">Nav piešķirts</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Pārvadātājs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {job.carrier ? (
              <Link
                href={`/dashboard/admin/companies/${job.carrier.id}`}
                className="font-medium hover:underline flex items-center gap-1"
              >
                {job.carrier.name}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>
            ) : (
              <span className="text-muted-foreground">Nav</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vehicle */}
      {job.vehicle && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              Transportlīdzeklis
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Numurs
              </p>
              {job.vehicle.licensePlate}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Marka
              </p>
              {job.vehicle.make} {job.vehicle.model}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exceptions */}
      {job.exceptions && job.exceptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Izņēmumi ({job.exceptions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {job.exceptions.map((ex) => (
                <div key={ex.id} className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {ex.type}
                      </Badge>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${EXCEPTION_STATUS_COLOURS[ex.status] ?? 'bg-muted text-foreground'}`}
                      >
                        {ex.status}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(ex.createdAt)}</span>
                  </div>
                  {ex.description && (
                    <p className="text-sm text-muted-foreground">{ex.description}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {job.documents && job.documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dokumenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {job.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {doc.documentType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(doc.createdAt)}</span>
                  </div>
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Skatīt
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Darbības</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
            Pārvietot pie vadītāja
          </Button>
        </CardContent>
      </Card>

      {/* Reassign dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pārvietot darbu {job.jobNumber}</DialogTitle>
            <DialogDescription>Ievadiet jaunā vadītāja ID un iemeslu.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="driver-id">Vadītāja ID</Label>
              <Input
                id="driver-id"
                value={reassignDriverId}
                onChange={(e) => setReassignDriverId(e.target.value)}
                placeholder="Vadītāja UUID..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reassign-note">Piezīme</Label>
              <Textarea
                id="reassign-note"
                value={reassignNote}
                onChange={(e) => setReassignNote(e.target.value)}
                rows={3}
                placeholder="Iemesls vai instrukcijas..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassignOpen(false)} disabled={reassigning}>
              Atcelt
            </Button>
            <Button onClick={handleReassign} disabled={reassigning || !reassignDriverId.trim()}>
              Pārvietot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
