/**
 * B3 Recycling — APUS (Atkritumu plūsmu uzskaites sistēma)
 * /dashboard/b3-recycling/apus
 *
 * APUS is Latvia's mandatory waste flow tracking system run by VVD (State
 * Environmental Service). As a licensed facility, B3 Recycling (Gulbene)
 * must report every waste intake/output movement.
 *
 * This page lets staff:
 *  – See all WasteRecord entries with their APUS submission status
 *  – Submit individual records or bulk-submit all pending records
 *  – Manually override status (e.g. after verifying in the VVD web portal)
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetApusStats,
  adminGetApusRecords,
  adminApusSubmitRecord,
  adminApusBulkSubmit,
  adminApusSetStatus,
  adminGetRecyclingCenters,
  type ApusStats,
  type ApusWasteRecord,
  type ApusStatus,
  type AdminRecyclingCenter,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  UploadCloud,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_TYPE_LV: Record<string, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Augsne',
  MIXED: 'Jaukti',
  HAZARDOUS: 'Bīstami',
};

const STATUS_CONFIG: Record<
  ApusStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: React.ElementType;
  }
> = {
  NOT_REQUIRED: { label: 'Nav nepiec.', variant: 'secondary', icon: AlertCircle },
  PENDING: { label: 'Gaida', variant: 'outline', icon: Clock },
  SUBMITTED: { label: 'Iesniegts', variant: 'default', icon: Send },
  ACCEPTED: { label: 'Apstiprināts', variant: 'default', icon: CheckCircle2 },
  REJECTED: { label: 'Noraidīts', variant: 'destructive', icon: XCircle },
};

function ApusStatusBadge({ status }: { status: ApusStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <Badge
      variant={cfg.variant}
      className={`flex items-center gap-1 ${status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function fmt(n: number) {
  return `${n.toLocaleString('lv-LV')} kg`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApusPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [stats, setStats] = useState<ApusStats | null>(null);
  const [records, setRecords] = useState<ApusWasteRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [centerFilter, setCenterFilter] = useState<string>('');
  const [centers, setCenters] = useState<AdminRecyclingCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null); // wasteRecordId being submitted
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Override dialog state
  const [overrideRecord, setOverrideRecord] = useState<ApusWasteRecord | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<ApusStatus>('ACCEPTED');
  const [overrideNote, setOverrideNote] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);

  const limit = 50;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statsData, recordsData, centersData] = await Promise.all([
        adminGetApusStats(token, centerFilter || undefined),
        adminGetApusRecords(token, {
          page,
          limit,
          centerId: centerFilter || undefined,
          status: statusFilter || undefined,
        }),
        centers.length === 0 ? adminGetRecyclingCenters(token) : Promise.resolve(null),
      ]);
      setStats(statsData);
      setRecords(recordsData.data);
      setTotal(recordsData.total);
      if (centersData) setCenters(centersData);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, centerFilter, centers.length]);

  useEffect(() => {
    if (!authLoading && token) load();
  }, [authLoading, token, load]);

  async function handleSubmitOne(id: string) {
    setSubmitting(id);
    try {
      await adminApusSubmitRecord(token, id);
      await load();
    } finally {
      setSubmitting(null);
    }
  }

  async function handleBulkSubmit() {
    if (!centerFilter) return;
    setBulkSubmitting(true);
    try {
      await adminApusBulkSubmit(token, centerFilter);
      await load();
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleOverrideSave() {
    if (!overrideRecord) return;
    setOverrideSaving(true);
    try {
      await adminApusSetStatus(token, overrideRecord.id, overrideStatus, overrideNote || undefined);
      setOverrideRecord(null);
      setOverrideNote('');
      await load();
    } finally {
      setOverrideSaving(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="APUS ziņojumi"
        description="Atkritumu plūsmu uzskaites sistēma — VVD obligātā ziņošana"
        action={
          <div className="flex items-center gap-2">
            {centerFilter && (
              <Button
                variant="default"
                size="sm"
                disabled={bulkSubmitting || !stats?.pending}
                onClick={handleBulkSubmit}
              >
                <UploadCloud className="h-4 w-4 mr-1.5" />
                {bulkSubmitting ? 'Iesniedz...' : `Iesniegt visus (${stats?.pending ?? 0})`}
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(
            [
              { key: 'pending', label: 'Gaida', color: 'text-amber-600' },
              { key: 'submitted', label: 'Iesniegts', color: 'text-blue-600' },
              { key: 'accepted', label: 'Apstiprināts', color: 'text-emerald-600' },
              { key: 'rejected', label: 'Noraidīts', color: 'text-red-600' },
              { key: 'notRequired', label: 'Nav nepiec.', color: 'text-gray-400' },
            ] as const
          ).map(({ key, label, color }) => (
            <Card key={key}>
              <CardContent className="p-4 flex flex-col">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>
                  {stats[key as keyof ApusStats]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={centerFilter}
          onValueChange={(v) => {
            setCenterFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Visas atrašanās vietas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visas atrašanās vietas</SelectItem>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} — {c.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Visi statusi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi statusi</SelectItem>
            <SelectItem value="PENDING">Gaida</SelectItem>
            <SelectItem value="SUBMITTED">Iesniegts</SelectItem>
            <SelectItem value="ACCEPTED">Apstiprināts</SelectItem>
            <SelectItem value="REJECTED">Noraidīts</SelectItem>
            <SelectItem value="NOT_REQUIRED">Nav nepiec.</SelectItem>
          </SelectContent>
        </Select>

        {(centerFilter || statusFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCenterFilter('');
              setStatusFilter('');
              setPage(1);
            }}
          >
            Notīrīt
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">{total} ieraksti</span>
      </div>

      {/* Records table */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nav ierakstu"
          description="Nav neviena atkritumu ieraksta atbilstoši izvēlētajiem filtriem"
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datums</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead>Svars</TableHead>
                  <TableHead>BIS nr.</TableHead>
                  <TableHead>Pasūtījums</TableHead>
                  <TableHead>Objekts</TableHead>
                  <TableHead>APUS statuss</TableHead>
                  <TableHead>Iesniegts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => {
                  const sourceOrder = r.order ?? r.containerOrder?.order ?? null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm tabular-nums whitespace-nowrap">
                        {r.processedDate
                          ? format(new Date(r.processedDate), 'dd.MM.yyyy')
                          : format(new Date(r.createdAt), 'dd.MM.yyyy')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {WASTE_TYPE_LV[r.wasteType] ?? r.wasteType}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{fmt(r.weight)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {r.bisNumber ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {sourceOrder?.orderNumber ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.recyclingCenter.name}
                        {r.recyclingCenter.licensed && (
                          <span className="ml-1 text-xs text-emerald-600">(lic.)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ApusStatusBadge status={r.apusStatus} />
                        {r.apusNote && (
                          <p
                            className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate"
                            title={r.apusNote}
                          >
                            {r.apusNote}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums whitespace-nowrap">
                        {r.apusSubmittedAt ? (
                          format(new Date(r.apusSubmittedAt), 'dd.MM.yy HH:mm')
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {r.apusSubmissionId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {r.apusSubmissionId}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(r.apusStatus === 'PENDING' || r.apusStatus === 'REJECTED') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2"
                              disabled={submitting === r.id}
                              onClick={() => handleSubmitOne(r.id)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {submitting === r.id ? '...' : 'Iesniegt'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setOverrideRecord(r);
                              setOverrideStatus(
                                r.apusStatus === 'SUBMITTED' ? 'ACCEPTED' : 'ACCEPTED',
                              );
                              setOverrideNote('');
                            }}
                          >
                            Mainīt
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
              <span>
                Lapa {page} no {Math.ceil(total / limit)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Iepriekšējā
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * limit >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Nākamā
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* VVD integration note */}
      <Card>
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            <strong>Integrācijas statuss:</strong> APUS API savienojums vēl nav aktivizēts — tiek
            gaids VVD piekļuves apstiprinājums. Ierakstu iesniegšana tiek simulēta lokāli. Pēc API
            atslēgas saņemšanas iestatiet{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">APUS_API_KEY</code> un{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">APUS_FACILITY_ID</code> vides
            mainīgos.
          </p>
        </CardContent>
      </Card>

      {/* Manual override dialog */}
      {overrideRecord && (
        <Dialog open onOpenChange={() => setOverrideRecord(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mainīt APUS statusu</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Ieraksts</Label>
                <p className="text-sm text-muted-foreground">
                  {WASTE_TYPE_LV[overrideRecord.wasteType] ?? overrideRecord.wasteType} —{' '}
                  {fmt(overrideRecord.weight)} —{' '}
                  {format(new Date(overrideRecord.createdAt), 'dd.MM.yyyy')}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Jaunais statuss</Label>
                <Select
                  value={overrideStatus}
                  onValueChange={(v) => setOverrideStatus(v as ApusStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Gaida</SelectItem>
                    <SelectItem value="SUBMITTED">Iesniegts</SelectItem>
                    <SelectItem value="ACCEPTED">Apstiprināts</SelectItem>
                    <SelectItem value="REJECTED">Noraidīts</SelectItem>
                    <SelectItem value="NOT_REQUIRED">Nav nepiec.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Piezīme (neobligāti)</Label>
                <Textarea
                  placeholder="Noraidījuma iemesls vai komentārs..."
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideRecord(null)}>
                Atcelt
              </Button>
              <Button onClick={handleOverrideSave} disabled={overrideSaving}>
                {overrideSaving ? 'Saglabā...' : 'Saglabāt'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
