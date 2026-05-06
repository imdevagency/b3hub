/**
 * Recycler incoming jobs — /dashboard/recycling/jobs
 * All disposal transport jobs heading to this operator's recycling centers.
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getRecyclerIncomingJobs, recyclerCancelIncomingJob } from '@/lib/api';
import type { RecyclerIncomingJob } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Truck } from 'lucide-react';
import { fmtDate } from '@/lib/format';

const STATUS_META: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { label: 'Gaida', variant: 'outline' },
  ASSIGNED: { label: 'Piešķirts', variant: 'default' },
  ACCEPTED: { label: 'Apstiprināts', variant: 'default' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz paņemšanu', variant: 'default' },
  EN_ROUTE_DROPOFF: { label: 'Ceļā', variant: 'default' },
  COMPLETED: { label: 'Pabeigts', variant: 'secondary' },
  CANCELLED: { label: 'Atcelts', variant: 'destructive' },
};

const CANCELLABLE = new Set(['AVAILABLE', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE_PICKUP']);

export default function RecyclerJobsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<RecyclerIncomingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmJob, setConfirmJob] = useState<RecyclerIncomingJob | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !token) return;
    getRecyclerIncomingJobs(token)
      .then(setJobs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, token]);

  async function handleCancel(job: RecyclerIncomingJob) {
    if (!token || !job.recyclingCenter?.id) return;
    setCancelling(job.id);
    try {
      await recyclerCancelIncomingJob(token, job.recyclingCenter.id, job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch {
      // error ignored — user can retry
    } finally {
      setCancelling(null);
    }
  }

  if (isLoading || !user) return <PageSpinner />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Ienākošie darbi"
        description="Atkritumu transporta uzdevumi uz jūsu centriem"
      />

      {loading && <PageSpinner />}

      {!loading && error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <EmptyState
          icon={Truck}
          title="Nav ienākošo darbu"
          description="Šeit parādīsies transporta uzdevumi ar atkritumus uz jūsu centriem"
        />
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const meta = STATUS_META[job.status] ?? {
              label: job.status,
              variant: 'outline' as const,
            };
            return (
              <Card key={job.id} className="rounded-2xl border-0 shadow-sm ring-1 ring-black/5">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">
                        {job.recyclingCenter?.name ?? 'Centrs nezināms'}
                      </p>
                      {job.recyclingCenter?.address && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {job.recyclingCenter.address}
                        </p>
                      )}
                      {job.requester && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Klients: {job.requester.firstName} {job.requester.lastName}
                          {job.requester.phone && ` · ${job.requester.phone}`}
                        </p>
                      )}
                      {job.vehicle && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Transportlīdzeklis: {job.vehicle.licensePlate} ({job.vehicle.vehicleType})
                        </p>
                      )}
                      {job.scheduledAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Plānots: {fmtDate(job.scheduledAt)}
                        </p>
                      )}
                    </div>
                    <Badge variant={meta.variant} className="shrink-0 whitespace-nowrap">
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Izveidots {fmtDate(job.createdAt)}
                  </p>
                  {CANCELLABLE.has(job.status) && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={cancelling === job.id}
                        onClick={() => setConfirmJob(job)}
                      >
                        {cancelling === job.id ? 'Atceļ...' : 'Atcelt'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!confirmJob} onOpenChange={(v) => !v && setConfirmJob(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atcelt piegādi?</DialogTitle>
            <DialogDescription>
              Vai tiešām vēlaties atcelt šo atkritumu piegādi? Klients tiks informēts par atcelšanu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmJob(null)}>
              Nē
            </Button>
            <Button
              variant="destructive"
              disabled={cancelling === confirmJob?.id}
              onClick={async () => {
                if (confirmJob) {
                  await handleCancel(confirmJob);
                  setConfirmJob(null);
                }
              }}
            >
              {cancelling === confirmJob?.id ? 'Atceļ...' : 'Jā, atcelt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
