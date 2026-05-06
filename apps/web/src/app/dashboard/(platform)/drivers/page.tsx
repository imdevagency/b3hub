/**
 * Driver roster — /dashboard/drivers
 * Carrier OWNER/MANAGER: see all company drivers, their active job status, and vehicle.
 * Invite/role management is handled by /dashboard/company/team.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getCompanyMembers,
  getAllTransportJobs,
  type CompanyMember,
  type ApiTransportJob,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageSpinner } from '@/components/ui/page-spinner';
import Link from 'next/link';
import {
  Users,
  Truck,
  Phone,
  MapPin,
  RefreshCw,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type DriverStatus = 'FREE' | 'ASSIGNED' | 'ACCEPTED' | 'EN_ROUTE_PICKUP' | 'AT_PICKUP' | 'LOADED' | 'EN_ROUTE_DELIVERY' | 'AT_DELIVERY';

interface DriverRow extends CompanyMember {
  activeJob: ApiTransportJob | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set([
  'ASSIGNED', 'ACCEPTED', 'EN_ROUTE_PICKUP', 'AT_PICKUP', 'LOADED', 'EN_ROUTE_DELIVERY', 'AT_DELIVERY',
]);

const STATUS_LABEL: Record<string, string> = {
  FREE: 'Brīvs',
  ASSIGNED: 'Piešķirts',
  ACCEPTED: 'Pieņēmis darbu',
  EN_ROUTE_PICKUP: 'Brauc uz iekraušanu',
  AT_PICKUP: 'Iekraušanā',
  LOADED: 'Iekrauts',
  EN_ROUTE_DELIVERY: 'Brauc uz piegādi',
  AT_DELIVERY: 'Piegādē',
  AVAILABLE: 'Brīvs',
};

const STATUS_COLOR: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  ASSIGNED: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  EN_ROUTE_PICKUP: 'bg-blue-100 text-blue-700',
  AT_PICKUP: 'bg-orange-100 text-orange-700',
  LOADED: 'bg-orange-100 text-orange-700',
  EN_ROUTE_DELIVERY: 'bg-green-100 text-green-700',
  AT_DELIVERY: 'bg-green-100 text-green-700',
  AVAILABLE: 'bg-gray-100 text-gray-600',
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Īpašnieks',
  MANAGER: 'Pārvaldnieks',
  DRIVER: 'Vadītājs',
  MEMBER: 'Dalībnieks',
};

function initials(m: CompanyMember) {
  return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const cls = STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const { token, user, isLoading } = useAuth();
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!token) return;
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const [members, jobs] = await Promise.all([
          getCompanyMembers(token),
          getAllTransportJobs(token),
        ]);

        // Build a driverId → active job map
        const activeByDriver = new Map<string, ApiTransportJob>();
        for (const job of jobs) {
          if (job.driverId && ACTIVE_STATUSES.has(job.status)) {
            // Keep the most recent one per driver (jobs are ordered by updatedAt desc from API)
            if (!activeByDriver.has(job.driverId)) {
              activeByDriver.set(job.driverId, job);
            }
          }
        }

        const drivers = members
          .filter((m) => m.canTransport)
          .map((m) => ({ ...m, activeJob: activeByDriver.get(m.id) ?? null }));

        setRows(drivers);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isLoading) load();
  }, [isLoading, load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const isDispatcher =
    user?.companyRole === 'OWNER' || user?.companyRole === 'MANAGER';

  if (isLoading || loading) return <PageSpinner />;

  const freeCount = rows.filter((r) => !r.activeJob).length;
  const busyCount = rows.filter((r) => !!r.activeJob).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vadītāji"
        description={`${freeCount} brīvi · ${busyCount} aktīvā darbā`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/company/team">
                <Users className="h-4 w-4 mr-1.5" />
                Pārvaldīt komandu
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/active">
                <Truck className="h-4 w-4 mr-1.5" />
                Flotes karte
              </Link>
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nav vadītāju"
          description="Pievienojiet vadītājus komandā, lai tie parādītos šeit"
          action={
            <Button asChild>
              <Link href="/dashboard/company/team">
                <Users className="h-4 w-4 mr-1.5" />
                Pārvaldīt komandu
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((driver) => (
            <DriverCard key={driver.id} driver={driver} isDispatcher={isDispatcher} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Driver card ───────────────────────────────────────────────────────────────

function DriverCard({
  driver,
  isDispatcher,
}: {
  driver: DriverRow;
  isDispatcher: boolean;
}) {
  const job = driver.activeJob;
  const jobStatus = job ? job.status : 'FREE';

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0 mt-0.5">
        <AvatarFallback className="text-sm font-medium">{initials(driver)}</AvatarFallback>
      </Avatar>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {driver.firstName} {driver.lastName}
          </span>
          {driver.companyRole && (
            <span className="text-xs text-muted-foreground">
              {ROLE_LABEL[driver.companyRole] ?? driver.companyRole}
            </span>
          )}
          <StatusPill status={jobStatus} />
        </div>

        {driver.phone && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Phone className="h-3 w-3" />
            <a href={`tel:${driver.phone}`} className="hover:underline">
              {driver.phone}
            </a>
          </div>
        )}

        {/* Active job details */}
        {job && (
          <div className="mt-2.5 rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Truck className="h-3.5 w-3.5 shrink-0" />
              <span>#{job.jobNumber}</span>
              {job.vehicle && (
                <span className="text-muted-foreground font-normal">· {job.vehicle.licensePlate}</span>
              )}
            </div>
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
              <span>{job.pickupCity}</span>
              <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{job.deliveryCity}</span>
              {job.cargoType && (
                <span className="ml-1 text-muted-foreground/70">· {job.cargoType}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {job && (
        <Button variant="ghost" size="icon" asChild className="shrink-0 mt-0.5">
          <Link href={`/dashboard/transport-jobs/${job.id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {!job && isDispatcher && (
        <Button variant="outline" size="sm" asChild className="shrink-0 mt-0.5">
          <Link href="/dashboard/jobs">
            Piešķirt darbu
          </Link>
        </Button>
      )}
    </div>
  );
}
