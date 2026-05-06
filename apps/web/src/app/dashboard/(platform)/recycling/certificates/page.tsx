/**
 * Recycler — Sertifikāti (Waste Certificates)
 * /dashboard/recycling/certificates
 *
 * Lists all processed waste records that have an issued waste certificate.
 * Operators can view and open the certificate documents.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerWasteRecords } from '@/lib/api';
import type { RecyclerWasteRecord } from '@/lib/api';
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
import { ExternalLink, FileCheck2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  SOIL: 'Grunts',
  RUBBLE: 'Gruži',
  METAL: 'Metāls',
  WOOD: 'Koks',
  MIXED: 'Jaukti',
  ASPHALT: 'Asfalts',
  GLASS: 'Stikls',
  PLASTIC: 'Plastmasa',
  GYPSUM: 'Ģipsis',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { token } = useAuth();

  const [records, setRecords] = useState<RecyclerWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const all = await getRecyclerWasteRecords(token);
      setRecords(all.filter((r) => !!r.certificateUrl));
    } catch {
      setError('Neizdevās ielādēt sertifikātus.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifikāti"
        description="Izsniegto atkritumu pārstrādes sertifikātu saraksts"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="Nav sertifikātu"
          description="Kad tiks izsniegts pirmais atkritumu pārstrādes sertifikāts, tas parādīsies šeit."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datums</TableHead>
                  <TableHead>Centrs</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead className="text-right">Svars (t)</TableHead>
                  <TableHead className="text-right">Pārstrādāts (t)</TableHead>
                  <TableHead>Sertifikāts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {format(new Date(r.createdAt), 'dd.MM.yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.recyclingCenter?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {WASTE_TYPE_LABELS[r.wasteType] ?? r.wasteType}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {r.weightKg != null ? (r.weightKg / 1000).toFixed(3) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-emerald-700 font-medium">
                      {r.recyclableWeight != null ? r.recyclableWeight.toFixed(3) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 bg-emerald-50"
                        >
                          <FileCheck2 className="h-3 w-3 mr-1" />
                          Izsniegts
                        </Badge>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={r.certificateUrl!} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
