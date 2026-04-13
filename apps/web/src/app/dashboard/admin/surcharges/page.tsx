/**
 * Admin surcharge approval queue — /dashboard/admin/surcharges
 * Review driver-submitted surcharges before they are billed to buyers.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetPendingSurcharges,
  adminApproveSurcharge,
  adminRejectSurcharge,
  type AdminSurcharge,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Receipt,
  AlertTriangle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(s));
}

const SURCHARGE_TYPE_LABEL: Record<string, string> = {
  WAITING_TIME: 'Gaidīšanas laiks',
  FUEL_SURCHARGE: 'Degvielas piemaksa',
  OVERWEIGHT: 'Pārslogošana',
  EXTRA_DISTANCE: 'Papildu attālums',
  CLEANING: 'Tīrīšana',
  OTHER: 'Cits',
};

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({
  surcharge,
  onConfirm,
  onCancel,
}: {
  surcharge: AdminSurcharge;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">Noraidīt piemaksu</h2>
        <p className="text-sm text-muted-foreground">
          <strong>{surcharge.label}</strong> — {fmt(surcharge.amount, surcharge.currency)}
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Noraidīšanas iemesls</label>
          <textarea
            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-24 resize-none"
            placeholder="Paskaidrojiet vadītājam, kāpēc piemaksa tika noraidīta..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Atcelt
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onConfirm(note)}
            disabled={!note.trim()}
          >
            Noraidīt
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSurchargesPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [surcharges, setSurcharges] = useState<AdminSurcharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminSurcharge | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchSurcharges = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetPendingSurcharges(token);
      setSurcharges(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchSurcharges();
  }, [isLoading, token, fetchSurcharges]);

  const totalExposure = surcharges.reduce((sum, s) => sum + (s.billable ? s.amount : 0), 0);

  const handleApprove = async (id: string) => {
    if (!token || processing) return;
    setProcessing(id + 'approve');
    try {
      await adminApproveSurcharge(id, token);
      setSurcharges((prev) => prev.filter((s) => s.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās apstiprināt');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string, note: string) => {
    if (!token || processing) return;
    setRejectTarget(null);
    setProcessing(id + 'reject');
    try {
      await adminRejectSurcharge(id, note, token);
      setSurcharges((prev) => prev.filter((s) => s.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Neizdevās noraidīt');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {rejectTarget && (
        <RejectModal
          surcharge={rejectTarget}
          onConfirm={(note) => handleReject(rejectTarget.id, note)}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div className="space-y-6">
        <PageHeader
          title="Piemaksu apstiprināšana"
          description="Vadītāju iesniegtās piemaksas, kas gaida apstiprināšanu pirms pircēja rēķinēšanas."
          action={
            <Button variant="outline" size="sm" onClick={fetchSurcharges}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Atjaunot
            </Button>
          }
        />

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Gaida apstiprināšanu
            </p>
            <p className="mt-1 text-3xl font-bold text-amber-800">{surcharges.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kopējā summa pircējiem
            </p>
            <p className="mt-1 text-3xl font-bold">{fmt(totalExposure)}</p>
          </div>
        </div>

        {surcharges.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nav gaidošu piemaksu"
            description="Visas iesniegtās piemaksas ir izskatītas."
          />
        ) : (
          <div className="space-y-3">
            {surcharges.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Left: info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-xs font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      {SURCHARGE_TYPE_LABEL[s.type] ?? s.type}
                    </span>
                    {!s.billable && (
                      <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                        Nav rēķināms pircējam
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-foreground">{s.label}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {s.order && (
                      <span>
                        Pasūtījums:{' '}
                        <Link
                          href={`/dashboard/admin/orders/${s.order.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {s.order.orderNumber}
                        </Link>
                        {s.order.buyer && ` · ${s.order.buyer.name}`}
                      </span>
                    )}
                    {s.transportJob && (
                      <span>
                        Darbs: <span className="font-medium">{s.transportJob.jobNumber}</span>
                        {s.transportJob.driver &&
                          ` · ${s.transportJob.driver.firstName} ${s.transportJob.driver.lastName}`}
                      </span>
                    )}
                    <span>{fmtDate(s.createdAt)}</span>
                  </div>
                </div>

                {/* Right: amount + actions */}
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xl font-bold tabular-nums">
                    {fmt(s.amount, s.currency)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(s.id)}
                      disabled={!!processing}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Apstiprināt
                    </button>
                    <button
                      onClick={() => setRejectTarget(s)}
                      disabled={!!processing}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-700 text-sm font-semibold px-3 py-2 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      Noraidīt
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
