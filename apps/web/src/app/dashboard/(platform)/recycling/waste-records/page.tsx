/**
 * Recycler waste records — /dashboard/recycling/waste-records
 * All waste intake records across this operator's recycling centers.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerWasteRecords } from '@/lib/api';
import type { RecyclerWasteRecord } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { fmtDate } from '@/lib/format';

const PROCESSING_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { label: 'Gaida', variant: 'outline' },
  IN_PROGRESS: { label: 'Apstrādē', variant: 'default' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  CERTIFIED: { label: 'Sertificēts', variant: 'default' },
};

function formatWeight(weightKg?: number | null): string {
  if (weightKg == null) return '—';
  if (weightKg >= 1000) return `${(weightKg / 1000).toFixed(2)} t`;
  return `${weightKg} kg`;
}

export default function RecyclerWasteRecordsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState<RecyclerWasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;
    getRecyclerWasteRecords(token)
      .then(setRecords)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, token]);

  if (isLoading || !user) return <PageSpinner />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Atkritumu žurnāls"
        description="Pieņemtie atkritumi un apstrādes rekordi visos jūsu centros"
      />

      {loading && <PageSpinner />}

      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Nav atkritumu rekordu"
          description="Šeit parādīsies pieņemto atkritumu apstrādes ieraksti"
        />
      )}

      {!loading && !error && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record) => {
            const meta = record.processingStatus
              ? (PROCESSING_META[record.processingStatus] ?? {
                  label: record.processingStatus,
                  variant: 'outline' as const,
                })
              : null;
            return (
              <Card key={record.id} className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{record.wasteType}</p>
                      {record.recyclingCenter && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {record.recyclingCenter.name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Svars: {formatWeight(record.weightKg)}
                      </p>
                      {record.certificateUrl && (
                        <a
                          href={record.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                        >
                          Sertifikāts <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    {meta && (
                      <Badge variant={meta.variant} className="shrink-0 whitespace-nowrap">
                        {meta.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Izveidots {fmtDate(record.createdAt)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
