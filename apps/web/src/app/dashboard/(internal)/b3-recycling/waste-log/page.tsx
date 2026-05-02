/**
 * B3 Recycling — Atkritumu žurnāls (Waste Log)
 * /dashboard/b3-recycling/waste-log
 *
 * Lists all WasteRecord entries processed at the Gulbene recycling facility.
 * Shows waste type, weight, recycling rate, and certificate availability.
 * Staff can manually log walk-in weigh-ins via the "Reģistrēt" dialog.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetRecyclingWasteRecords,
  adminCreateWasteRecord,
  adminGetRecyclingCenters,
  type RecyclingWasteRecord,
  type AdminRecyclingCenter,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { RefreshCw, FileText, Recycle, Plus } from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_TYPE_OPTIONS = [
  { value: 'CONCRETE', label: 'Betons' },
  { value: 'BRICK', label: 'Ķieģeļi' },
  { value: 'WOOD', label: 'Koksne' },
  { value: 'METAL', label: 'Metāls' },
  { value: 'PLASTIC', label: 'Plastmasa' },
  { value: 'SOIL', label: 'Grunts' },
  { value: 'MIXED', label: 'Jaukti' },
  { value: 'HAZARDOUS', label: 'Bīstami' },
];

const WASTE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WASTE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

function formatTonnes(kg: number | null): string {
  if (kg === null) return '—';
  return `${kg.toFixed(2)} t`;
}

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${rate.toFixed(1)}%`;
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ records }: { records: RecyclingWasteRecord[] }) {
  const totalWeight = records.reduce((sum, r) => sum + (r.weight ?? 0), 0);
  const totalRecyclable = records.reduce((sum, r) => sum + (r.recyclableWeight ?? 0), 0);
  const ratedRecords = records.filter((r) => r.recyclingRate !== null);
  const avgRate =
    ratedRecords.length > 0
      ? ratedRecords.reduce((sum, r) => sum + (r.recyclingRate ?? 0), 0) / ratedRecords.length
      : null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Kopā pieņemts</div>
          <div className="text-2xl font-semibold">{formatTonnes(totalWeight)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Pārstrādājams</div>
          <div className="text-2xl font-semibold">{formatTonnes(totalRecyclable)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Vid. pārstrādes likme</div>
          <div className="text-2xl font-semibold">{formatRate(avgRate)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Log Walk-in Dialog ───────────────────────────────────────────────────────

function LogWalkInDialog({
  open,
  onClose,
  centers,
  token,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  centers: AdminRecyclingCenter[];
  token: string;
  onCreated: (record: RecyclingWasteRecord) => void;
}) {
  const [centerId, setCenterId] = useState(centers[0]?.id ?? '');
  const [wasteType, setWasteType] = useState('');
  const [weight, setWeight] = useState('');
  const [volume, setVolume] = useState('');
  const [recyclableWeight, setRecyclableWeight] = useState('');
  const [recyclingRate, setRecyclingRate] = useState('');
  const [processedDate, setProcessedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isValid = centerId && wasteType && weight && parseFloat(weight) > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError('');
    try {
      const record = await adminCreateWasteRecord(
        {
          recyclingCenterId: centerId,
          wasteType,
          weight: parseFloat(weight),
          volume: volume ? parseFloat(volume) : undefined,
          recyclableWeight: recyclableWeight ? parseFloat(recyclableWeight) : undefined,
          recyclingRate: recyclingRate ? parseFloat(recyclingRate) : undefined,
          processedDate: processedDate || undefined,
        },
        token,
      );
      onCreated(record);
      onClose();
    } catch {
      setError('Neizdevās saglabāt ierakstu. Pārbaudiet ievadītos datus.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reģistrēt svēršanu</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {centers.length > 1 && (
            <div className="grid gap-1.5">
              <Label>Pārstrādes centrs</Label>
              <Select value={centerId} onValueChange={setCenterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlieties centru" />
                </SelectTrigger>
                <SelectContent>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>
              Atkritumu veids <span className="text-destructive">*</span>
            </Label>
            <Select value={wasteType} onValueChange={setWasteType}>
              <SelectTrigger>
                <SelectValue placeholder="Izvēlieties veidu" />
              </SelectTrigger>
              <SelectContent>
                {WASTE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>
                Svars (t) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tilpums (m³)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Pārstrādājamais (t)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={recyclableWeight}
                onChange={(e) => setRecyclableWeight(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Pārstrādes % </Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0.0"
                value={recyclingRate}
                onChange={(e) => setRecyclingRate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Apstrādes datums</Label>
            <Input
              type="date"
              value={processedDate}
              onChange={(e) => setProcessedDate(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Atcelt
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? 'Saglabā...' : 'Saglabāt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function WasteRecordRow({ record }: { record: RecyclingWasteRecord }) {
  return (
    <TableRow>
      <TableCell className="text-sm">
        {record.processedDate ? format(new Date(record.processedDate), 'dd.MM.yyyy') : '—'}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{WASTE_TYPE_LABELS[record.wasteType] ?? record.wasteType}</Badge>
      </TableCell>
      <TableCell className="text-sm">{formatTonnes(record.weight)}</TableCell>
      <TableCell className="text-sm">{formatTonnes(record.recyclableWeight)}</TableCell>
      <TableCell className="text-sm">{formatRate(record.recyclingRate)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {record.containerOrder?.order?.buyer?.name ??
          record.containerOrder?.order?.orderNumber ??
          '—'}
      </TableCell>
      <TableCell>
        {record.certificateUrl ? (
          <a
            href={record.certificateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Sertifikāts
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Nav</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {format(new Date(record.createdAt), 'dd.MM.yyyy')}
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WasteLogPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<RecyclingWasteRecord[]>([]);
  const [centers, setCenters] = useState<AdminRecyclingCenter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [res, centersData] = await Promise.all([
        adminGetRecyclingWasteRecords(token, { limit: 200 }),
        adminGetRecyclingCenters(token),
      ]);
      setRecords(res.data);
      setTotal(res.total);
      setCenters(centersData.filter((c) => c.active));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreated = (record: RecyclingWasteRecord) => {
    setRecords((prev) => [record, ...prev]);
    setTotal((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atkritumu žurnāls"
        description={`Gulbenes šķirošanas centrs — ${total} ieraksti`}
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setDialogOpen(true)} disabled={centers.length === 0}>
              <Plus className="h-4 w-4 mr-1.5" />
              Reģistrēt svēršanu
            </Button>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {!loading && records.length > 0 && <SummaryBar records={records} />}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <EmptyState
              icon={Recycle}
              title="Nav ierakstu"
              description="Vēl nav reģistrēts neviens atkritumu apstrādes ieraksts."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apstrādes datums</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead>Svars</TableHead>
                  <TableHead>Pārstrādājamais</TableHead>
                  <TableHead>Pārstrādes %</TableHead>
                  <TableHead>Klients</TableHead>
                  <TableHead>Sertifikāts</TableHead>
                  <TableHead>Ierakstīts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <WasteRecordRow key={r.id} record={r} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {token && centers.length > 0 && (
        <LogWalkInDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          centers={centers}
          token={token}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
