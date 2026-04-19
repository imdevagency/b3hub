/**
 * Admin SLA monitor — /dashboard/admin/sla
 * Orders stuck in PENDING (>4h) or CONFIRMED (>24h) that need admin action.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { adminGetSlaOrders, type SlaOrder } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock, CheckCircle2, ArrowUpRight } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function AgeBadge({ hours, status }: { hours: number; status: string }) {
  const isCritical =
    (status === 'PENDING' && hours >= 8) || (status === 'CONFIRMED' && hours >= 48);
  const isWarn = !isCritical;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isCritical
          ? 'bg-red-100 text-red-700'
          : isWarn
            ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-gray-500'
      }`}
    >
      <Clock className="h-3 w-3" />
      {hours}h
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSlaPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<SlaOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetSlaOrders(token);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchOrders();
  }, [isLoading, token, fetchOrders]);

  const critical = orders.filter(
    (o) =>
      (o.status === 'PENDING' && o.ageHours >= 8) || (o.status === 'CONFIRMED' && o.ageHours >= 48),
  );
  const warning = orders.filter((o) => !critical.includes(o));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Monitors"
        description="Pasūtījumi, kas pārsniedz gaidīšanas laika sliekšņus un prasa iejaukšanos."
        action={
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
            Kritiski (&gt;8h/48h)
          </p>
          <p className="mt-1 text-3xl font-bold text-red-700">{critical.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Brīdinājums (&gt;4h/24h)
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-700">{warning.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kopā
          </p>
          <p className="mt-1 text-3xl font-bold">{orders.length}</p>
        </div>
      </div>

      {/* SLA thresholds legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          PENDING &gt; 4h brīdinājums
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          PENDING &gt; 8h kritisks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          CONFIRMED &gt; 24h brīdinājums
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          CONFIRMED &gt; 48h kritisks
        </span>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Visi pasūtījumi ir SLA ietvaros"
          description="Nav neviena pasūtījuma, kas pārsniegtu reaģēšanas laika sliekšņus."
        />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Nr.</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Statuss</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Vecums</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pircējs</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pilsēta</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Summa
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Transports</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => {
                  const isCritical =
                    (o.status === 'PENDING' && o.ageHours >= 8) ||
                    (o.status === 'CONFIRMED' && o.ageHours >= 48);
                  return (
                    <tr
                      key={o.id}
                      className={`transition-colors ${isCritical ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-muted/20'}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-foreground/70">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AgeBadge hours={o.ageHours} status={o.status} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{o.buyer?.name ?? '—'}</p>
                        {o.buyer?.email && (
                          <p className="text-xs text-muted-foreground">{o.buyer.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.deliveryCity}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {fmt(o.total, o.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {o.transportJobs.length > 0 ? (
                          <span className="text-xs font-semibold text-purple-700 bg-purple-50 rounded-full px-2 py-0.5">
                            {o.transportJobs.length} darb.
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nav</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/orders/${o.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {critical.length} kritiski · {warning.length} brīdinājums
          </div>
        </div>
      )}
    </div>
  );
}
