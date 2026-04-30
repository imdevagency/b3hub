/**
 * B3 Recycling — Atkritumu žurnāls (Waste Log)
 * /dashboard/b3-recycling/waste-log
 *
 * Lists all WasteRecord entries processed at the Gulbene recycling facility.
 * Shows waste type, weight, recycling rate, and certificate availability.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { adminGetRecyclingWasteRecords, type RecyclingWasteRecord } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, FileText, Recycle } from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Grunts',
  MIXED: 'Jaukti',
  HAZARDOUS: 'Bīstami',
};

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
  const avgRate =
    records.filter((r) => r.recyclingRate !== null).length > 0
      ? records
          .filter((r) => r.recyclingRate !== null)
          .reduce((sum, r) => sum + (r.recyclingRate ?? 0), 0) /
        records.filter((r) => r.recyclingRate !== null).length
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
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminGetRecyclingWasteRecords(token, { limit: 200 });
      setRecords(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atkritumu žurnāls"
        description={`Gulbenes šķirošanas centrs — ${total} ieraksti`}
        action={
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
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
              icon={<Recycle className="h-8 w-8 text-muted-foreground" />}
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
    </div>
  );
}
