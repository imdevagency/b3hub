/**
 * B3 Recycling — Sertifikāti (Waste Certificates)
 * /dashboard/b3-recycling/certificates
 *
 * Lists all WasteRecord entries that have an issued waste certificate.
 * Admins can view and open the certificate documents.
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
import { RefreshCw, FileCheck2, ExternalLink } from 'lucide-react';
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

// ─── Row ──────────────────────────────────────────────────────────────────────

function CertRow({ record }: { record: RecyclingWasteRecord }) {
  return (
    <TableRow>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(record.createdAt), 'dd.MM.yyyy')}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {record.processedDate ? format(new Date(record.processedDate), 'dd.MM.yyyy') : '—'}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{WASTE_TYPE_LABELS[record.wasteType] ?? record.wasteType}</Badge>
      </TableCell>
      <TableCell className="text-sm">
        {record.weight != null ? `${record.weight.toFixed(2)} t` : '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {record.containerOrder?.order?.buyer?.name ??
          record.containerOrder?.order?.orderNumber ??
          '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{record.recyclingCenter.name}</TableCell>
      <TableCell>
        <a
          href={record.certificateUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Atvērt
        </a>
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { token } = useAuth();
  const [certs, setCerts] = useState<RecyclingWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminGetRecyclingWasteRecords(token, { limit: 500 });
      // Filter to only records that have an issued certificate
      setCerts(res.data.filter((r) => Boolean(r.certificateUrl)));
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
        title="Sertifikāti"
        description={`Izdotie atkritumu pārstrādes sertifikāti — ${certs.length} dokumenti`}
        action={
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : certs.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="Nav sertifikātu"
              description="Vēl nav izdots neviens atkritumu pārstrādes sertifikāts."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reģistrēts</TableHead>
                  <TableHead>Apstrādes datums</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead>Svars</TableHead>
                  <TableHead>Klients</TableHead>
                  <TableHead>Centrs</TableHead>
                  <TableHead>Dokuments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map((r) => (
                  <CertRow key={r.id} record={r} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
