/**
 * Admin applications page — /dashboard/admin/applications
 * Lists pending provider applications (supplier/carrier); approve or reject them.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  getProviderApplications,
  approveProviderApplication,
  rejectProviderApplication,
  type ProviderApplication,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  Clock,
  Building,
  Phone,
  Mail,
  RefreshCw,
  ShieldCheck,
  Truck,
  Package,
} from 'lucide-react';

// ── Type label helpers ─────────────────────────────────────────

const STATUS_META: Record<
  ProviderApplication['status'],
  { label: string; className: string; Icon: typeof Clock }
> = {
  PENDING: {
    label: 'Gaida',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Icon: Clock,
  },
  APPROVED: {
    label: 'Apstiprināts',
    className: 'bg-green-50 text-green-700 border-green-200',
    Icon: CheckCircle,
  },
  REJECTED: {
    label: 'Noraidīts',
    className: 'bg-red-50 text-red-700 border-red-200',
    Icon: XCircle,
  },
};

function StatusBadge({ status }: { status: ProviderApplication['status'] }) {
  const { label, className, Icon } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Application card ──────────────────────────────────────────

function ApplicationCard({
  app,
  onApprove,
  onReject,
  loading,
}: {
  app: ProviderApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {app.firstName} {app.lastName}
            </CardTitle>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Building className="h-3.5 w-3.5" />
              {app.companyName}
              {app.regNumber && <span className="text-xs">· {app.regNumber}</span>}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Contact */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {app.email}
          </span>
          <span className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            {app.phone}
          </span>
        </div>

        {/* Applies for */}
        <div className="flex gap-2">
          {app.appliesForSell && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
              <Package className="h-3 w-3" />
              Piegādātājs
            </span>
          )}
          {app.appliesForTransport && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700">
              <Truck className="h-3 w-3" />
              Pārvadātājs
            </span>
          )}
        </div>

        {/* Description */}
        {app.description && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            {app.description}
          </p>
        )}

        {/* Review note */}
        {app.reviewNote && (
          <p className="text-sm italic text-muted-foreground">Piezīme: {app.reviewNote}</p>
        )}

        {/* Date */}
        <p className="text-xs text-muted-foreground">
          Iesniegts: {new Date(app.createdAt).toLocaleDateString('lv-LV')}
        </p>

        {/* Actions */}
        {app.status === 'PENDING' && (
          <>
            <Separator />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onReject(app.id)}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Noraidīt
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApprove(app.id)}
                disabled={loading}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Apstiprināt
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────

type Filter = 'ALL' | ProviderApplication['status'];

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Gaida' },
  { value: 'APPROVED', label: 'Apstiprinātie' },
  { value: 'REJECTED', label: 'Noraidītie' },
];

export default function AdminApplicationsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<ProviderApplication[]>([]);
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const load = useCallback(
    async (f: Filter) => {
      if (!token) return;
      setLoading(true);
      try {
        const data = await getProviderApplications(token, f === 'ALL' ? undefined : f);
        setApps(data);
      } catch {
        // show empty
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const handleApprove = async (id: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const updated = await approveProviderApplication(id, '', token);
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      /* show toast in production */
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const updated = await rejectProviderApplication(id, '', token);
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      /* show toast in production */
    } finally {
      setActionLoading(false);
    }
  };

  const pending = apps.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Piegādātāju pieteikumi"
        description="Pārskatiet un apstipriniet vai noraidiet pieteikumus."
        action={
          <div className="flex items-center gap-2">
            {pending > 0 && (
              <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
                {pending}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => load(filter)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
          </div>
        }
      />

      <Separator />

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              filter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <ShieldCheck className="h-10 w-10" />
          <p className="text-sm">Nav pieteikumu šajā kategorijā.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onApprove={handleApprove}
              onReject={handleReject}
              loading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
