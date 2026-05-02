/**
 * Buyer disputes page — /dashboard/disputes
 * Lists all disputes raised by the current buyer. Read-only view.
 * Admin resolution is handled at /dashboard/admin/disputes.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/hooks/use-require-auth';
import {
  listDisputes,
  type ApiDispute,
  type DisputeStatus,
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  getDisputeStatusColor,
} from '@/lib/api/disputes';
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const STATUS_FILTERS: { value: 'ALL' | DisputeStatus; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'OPEN', label: 'Jauni' },
  { value: 'UNDER_REVIEW', label: 'Izskatīšanā' },
  { value: 'RESOLVED', label: 'Atrisināti' },
  { value: 'REJECTED', label: 'Noraidīti' },
];

export default function DisputesPage() {
  const { token } = useRequireAuth();
  const [disputes, setDisputes] = useState<ApiDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DisputeStatus>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listDisputes(token);
      setDisputes(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    statusFilter === 'ALL' ? disputes : disputes.filter((d) => d.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mani Strīdi"
        description="Pasūtījumu sūdzības un to izskatīšanas statuss"
        action={
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit overflow-x-auto">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === value
                ? 'bg-gray-100 border border-gray-200 text-gray-900 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nav strīdu"
          description={
            statusFilter === 'ALL'
              ? 'Jums nav nevienas iesniegtas sūdzības.'
              : 'Nav strīdu ar šo statusu.'
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((dispute) => (
            <Link
              key={dispute.id}
              href={`/dashboard/orders?highlight=${dispute.orderId}`}
              className="block bg-card border border-border rounded-xl p-4 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <AlertTriangle className="size-4 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        #{dispute.order.orderNumber}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getDisputeStatusColor(dispute.status)}`}
                      >
                        {DISPUTE_STATUS_LABELS[dispute.status]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {DISPUTE_REASON_LABELS[dispute.reason]}
                    </p>
                    {dispute.description && (
                      <p className="text-sm text-foreground/70 mt-1 line-clamp-2">
                        {dispute.description}
                      </p>
                    )}
                    {dispute.resolution && dispute.status === 'RESOLVED' && (
                      <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mt-2 border border-green-100">
                        <span className="font-medium">Atrisinājums:</span> {dispute.resolution}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {new Date(dispute.createdAt).toLocaleDateString('lv-LV', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
