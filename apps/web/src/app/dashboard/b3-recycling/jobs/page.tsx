/**
 * B3 Recycling — Ienākošie darbi (Inbound Jobs)
 * /dashboard/b3-recycling/jobs
 *
 * Lists all DISPOSAL orders targeting the Gulbene recycling facility.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { adminGetRecyclingJobs, type RecyclingInboundJob } from '@/lib/api/admin';
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
import { RefreshCw, Truck, Package, Calendar } from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Procesā',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const ORDER_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

const TRANSPORT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  ASSIGNED: 'Piešķirts',
  EN_ROUTE: 'Ceļā',
  DELIVERED: 'Piegādāts',
  CANCELLED: 'Atcelts',
};

function parseWasteTypes(raw: string | null): string {
  if (!raw) return '—';
  try {
    const arr: string[] = JSON.parse(raw);
    const labels: Record<string, string> = {
      CONCRETE: 'Betons',
      BRICK: 'Ķieģeļi',
      WOOD: 'Koksne',
      METAL: 'Metāls',
      PLASTIC: 'Plastmasa',
      SOIL: 'Grunts',
      MIXED: 'Jaukti',
      HAZARDOUS: 'Bīstami',
    };
    return arr.map((t) => labels[t] ?? t).join(', ');
  } catch {
    return raw;
  }
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: RecyclingInboundJob }) {
  const transportStatus = job.transportJobs[0]?.status;

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{job.orderNumber}</TableCell>
      <TableCell>
        <div className="text-sm font-medium">{job.buyer?.name ?? '—'}</div>
        {job.buyer?.phone && <div className="text-xs text-muted-foreground">{job.buyer.phone}</div>}
      </TableCell>
      <TableCell className="text-sm">{parseWasteTypes(job.wasteTypes)}</TableCell>
      <TableCell className="text-sm">
        {job.disposalVolume ? `${job.disposalVolume} m³` : '—'}
      </TableCell>
      <TableCell>
        <Badge variant={ORDER_STATUS_VARIANTS[job.status] ?? 'secondary'}>
          {ORDER_STATUS_LABELS[job.status] ?? job.status}
        </Badge>
      </TableCell>
      <TableCell>
        {transportStatus ? (
          <Badge variant="outline" className="text-xs">
            {TRANSPORT_STATUS_LABELS[transportStatus] ?? transportStatus}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Nav</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {job.deliveryDate ? format(new Date(job.deliveryDate), 'dd.MM.yyyy') : '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(new Date(job.createdAt), 'dd.MM.yyyy')}
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecyclingJobsPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<RecyclingInboundJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminGetRecyclingJobs(token, { limit: 100 });
      setJobs(res.data);
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
        title="Ienākošie darbi"
        description={`Gulbenes atkritumu šķirošanas centrs — ${total} DISPOSAL pasūtījumi`}
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
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="Nav darbu"
              description="Gulbenes objektam vēl nav neviena DISPOSAL pasūtījuma."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pasūtījums</TableHead>
                  <TableHead>Klients</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead>Apjoms</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" /> Transports
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Piegāde
                    </div>
                  </TableHead>
                  <TableHead>Izveidots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
