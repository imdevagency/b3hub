/**
 * B3 Recycling — Ienākošie darbi (Inbound Jobs)
 * /dashboard/b3-recycling/jobs
 *
 * Lists all DISPOSAL orders targeting the Gulbene recycling facility.
 * Admins can confirm, start processing, complete, or cancel each job.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetRecyclingJobs,
  adminUpdateRecyclingJob,
  type RecyclingInboundJob,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  RefreshCw,
  Truck,
  Package,
  Calendar,
  ChevronDown,
  CheckCircle2,
  XCircle,
  PlayCircle,
} from 'lucide-react';
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

type NextAction = {
  label: string;
  icon: React.ElementType;
  status: string;
  variant?: 'destructive';
};

const NEXT_ACTIONS: Record<string, NextAction[]> = {
  PENDING: [
    { label: 'Apstiprināt', icon: CheckCircle2, status: 'CONFIRMED' },
    { label: 'Atcelt', icon: XCircle, status: 'CANCELLED', variant: 'destructive' },
  ],
  CONFIRMED: [
    { label: 'Sākt apstrādi', icon: PlayCircle, status: 'IN_PROGRESS' },
    { label: 'Atcelt', icon: XCircle, status: 'CANCELLED', variant: 'destructive' },
  ],
  IN_PROGRESS: [{ label: 'Pabeigt', icon: CheckCircle2, status: 'COMPLETED' }],
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

function JobRow({
  job,
  token,
  onUpdated,
}: {
  job: RecyclingInboundJob;
  token: string;
  onUpdated: (id: string, newStatus: string) => void;
}) {
  const transportStatus = job.transportJobs[0]?.status;
  const [updating, setUpdating] = useState(false);
  const actions = NEXT_ACTIONS[job.status] ?? [];

  const handleAction = async (status: string) => {
    setUpdating(true);
    try {
      await adminUpdateRecyclingJob(job.id, { status }, token);
      onUpdated(job.id, status);
    } catch {
      // silently fail
    } finally {
      setUpdating(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{job.orderNumber}</TableCell>
      <TableCell>
        <div className="text-sm font-medium">{job.buyer?.name ?? '—'}</div>
        {job.buyer?.phone && <div className="text-xs text-muted-foreground">{job.buyer.phone}</div>}
      </TableCell>
      <TableCell className="text-sm">{parseWasteTypes(job.wasteTypes)}</TableCell>
      <TableCell className="text-right tabular-nums text-sm">
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
      <TableCell>
        {actions.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={updating} className="h-7 px-2 text-xs">
                Darbības <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action, i) => {
                const Icon = action.icon;
                const isDestructive = action.variant === 'destructive';
                return (
                  <div key={action.status}>
                    {i > 0 && isDestructive && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => void handleAction(action.status)}
                      className={isDestructive ? 'text-destructive focus:text-destructive' : ''}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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

  const handleUpdated = (id: string, newStatus: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: newStatus } : j)));
  };

  const filtered = statusFilter === 'ALL' ? jobs : jobs.filter((j) => j.status === statusFilter);

  const pendingCount = jobs.filter((j) => j.status === 'PENDING').length;
  const inProgressCount = jobs.filter((j) => j.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ienākošie darbi"
        description={`Gulbenes atkritumu šķirošanas centrs — ${total} pasūtījumi`}
        action={
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* Attention banners */}
      {!loading && (pendingCount > 0 || inProgressCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Package className="h-4 w-4" />
              <span>
                <strong>{pendingCount}</strong> gaida apstiprinājumu
              </span>
            </div>
          )}
          {inProgressCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <PlayCircle className="h-4 w-4" />
              <span>
                <strong>{inProgressCount}</strong> tiek apstrādāti
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            <SelectItem value="PENDING">Gaida</SelectItem>
            <SelectItem value="CONFIRMED">Apstiprināts</SelectItem>
            <SelectItem value="IN_PROGRESS">Procesā</SelectItem>
            <SelectItem value="COMPLETED">Pabeigts</SelectItem>
            <SelectItem value="CANCELLED">Atcelts</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} rezultāti</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nav darbu"
              description="Gulbenes objektam nav neviena atbilstoša DISPOSAL pasūtījuma."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pasūtījums</TableHead>
                  <TableHead>Klients</TableHead>
                  <TableHead>Atkritumu veids</TableHead>
                  <TableHead className="text-right">Apjoms</TableHead>
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
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((job) => (
                  <JobRow key={job.id} job={job} token={token!} onUpdated={handleUpdated} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
