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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, RefreshCw, ShieldCheck, Truck, Package } from 'lucide-react';

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
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Confirm dialogs
  const [confirmApprove, setConfirmApprove] = useState<ProviderApplication | null>(null);
  const [confirmReject, setConfirmReject] = useState<ProviderApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');

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

  const handleApprove = async () => {
    if (!token || !confirmApprove) return;
    setLoadingId(confirmApprove.id);
    setActionError('');
    try {
      const updated = await approveProviderApplication(confirmApprove.id, '', token);
      setApps((prev) => prev.map((a) => (a.id === confirmApprove.id ? updated : a)));
      setConfirmApprove(null);
    } catch {
      setActionError('Kļūda apstiprinot pieteikumu. Mēģini vēlreiz.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!token || !confirmReject) return;
    setLoadingId(confirmReject.id);
    setActionError('');
    try {
      const updated = await rejectProviderApplication(confirmReject.id, rejectReason || '', token);
      setApps((prev) => prev.map((a) => (a.id === confirmReject.id ? updated : a)));
      setConfirmReject(null);
      setRejectReason('');
    } catch {
      setActionError('Kļūda noraidot pieteikumu. Mēģini vēlreiz.');
    } finally {
      setLoadingId(null);
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
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Iesniedzējs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Uzņēmums
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Loma
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Datums
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {apps.map((app) => {
                  const busy = loadingId === app.id;
                  return (
                    <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">
                          {app.firstName} {app.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{app.email}</p>
                        {app.phone && <p className="text-xs text-muted-foreground">{app.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{app.companyName}</p>
                        {app.regNumber && (
                          <p className="text-xs text-muted-foreground font-mono">{app.regNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {app.appliesForSell && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700 w-fit">
                              <Package className="h-3 w-3" />
                              Piegādātājs
                            </span>
                          )}
                          {app.appliesForTransport && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700 w-fit">
                              <Truck className="h-3 w-3" />
                              Pārvadātājs
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={app.status} />
                        {app.reviewNote && (
                          <p className="text-xs text-muted-foreground italic mt-1 max-w-40 mx-auto truncate">
                            {app.reviewNote}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(app.createdAt).toLocaleDateString('lv-LV')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {app.status === 'PENDING' && (
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                setActionError('');
                                setRejectReason('');
                                setConfirmReject(app);
                              }}
                              disabled={!!loadingId}
                            >
                              {busy ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                              )}
                              Noraidīt
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                setActionError('');
                                setConfirmApprove(app);
                              }}
                              disabled={!!loadingId}
                            >
                              {busy ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              )}
                              Apstiprināt
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
            {apps.length} pieteikumi
          </div>
        </div>
      )}

      {/* ── Approve confirm dialog ─────────────────────────────────────────── */}
      <Dialog open={!!confirmApprove} onOpenChange={(open) => !open && setConfirmApprove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apstiprināt pieteikumu?</DialogTitle>
            <DialogDescription>
              {confirmApprove && (
                <>
                  <strong>
                    {confirmApprove.firstName} {confirmApprove.lastName}
                  </strong>{' '}
                  — {confirmApprove.companyName}. Pēc apstiprināšanas piegādātājs varēs publicēt
                  materiālus.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmApprove(null)}
              disabled={!!loadingId}
            >
              Atcelt
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={!!loadingId}
            >
              {loadingId ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1.5" />
              )}
              Apstiprināt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject confirm dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!confirmReject}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmReject(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Noraidīt pieteikumu?</DialogTitle>
            <DialogDescription>
              {confirmReject && (
                <>
                  <strong>
                    {confirmReject.firstName} {confirmReject.lastName}
                  </strong>{' '}
                  — {confirmReject.companyName}. Iesniedzējs tiks informēts par noraidīšanu.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Noraidīšanas iemesls (piezīme)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Paskaidrojiet noraidīšanas iemeslu (neobligāts, bet ieteicams)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmReject(null);
                setRejectReason('');
              }}
              disabled={!!loadingId}
            >
              Atcelt
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!loadingId}>
              {loadingId ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <XCircle className="h-4 w-4 mr-1.5" />
              )}
              Noraidīt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
