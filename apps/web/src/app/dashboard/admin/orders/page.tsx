/**
 * Admin orders page — /dashboard/admin/orders
 * Platform-wide order view with status filtering and buyer/transport details.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetOrders, type AdminOrder } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { RefreshCw, ClipboardList, Search, Truck } from 'lucide-react';

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-500',
};

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-500',
  AUTHORIZED: 'bg-yellow-100 text-yellow-700',
  CAPTURED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-teal-100 text-teal-600',
  RELEASED: 'bg-purple-100 text-purple-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-600',
};

function StatusBadge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

// ── Filters ─────────────────────────────────────────────────────────────────

type StatusFilter = 'ALL' | AdminOrder['status'];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Gaida' },
  { value: 'CONFIRMED', label: 'Apstiprināti' },
  { value: 'IN_PROGRESS', label: 'Izpildē' },
  { value: 'DELIVERED', label: 'Piegādāti' },
  { value: 'COMPLETED', label: 'Pabeigti' },
  { value: 'CANCELLED', label: 'Atcelti' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetOrders(token);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchOrders();
  }, [isLoading, token, fetchOrders]);

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.buyer.firstName.toLowerCase().includes(q) ||
      o.buyer.lastName.toLowerCase().includes(q) ||
      (o.buyer.email ?? '').toLowerCase().includes(q) ||
      (o.buyer.company?.name ?? '').toLowerCase().includes(q) ||
      o.deliveryCity.toLowerCase().includes(q)
    );
  });

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
        title="Pasūtījumi"
        description={`${orders.length} pasūtījumi platformā`}
        action={
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt pēc nr., pircēja, uzņēmuma, pilsētas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
              statusFilter === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nav pasūtījumu"
          description="Nekas neatbilst meklēšanas kritērijiem."
        />
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Nr.
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pircējs
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Tips
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pilsēta
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Maksājums
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Summa
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    <Truck className="h-3.5 w-3.5 mx-auto" />
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Datums
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {o.buyer.firstName} {o.buyer.lastName}
                        </p>
                        {o.buyer.company && (
                          <p className="text-xs text-muted-foreground">{o.buyer.company.name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 font-medium">{o.orderType}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{o.deliveryCity}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={o.status} colorMap={STATUS_COLORS} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={o.paymentStatus} colorMap={PAYMENT_COLORS} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {o.total.toLocaleString('lv-LV', { style: 'currency', currency: o.currency })}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                      {o.transportJobs.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 text-purple-700 px-2 py-0.5 text-xs font-semibold">
                          <Truck className="h-3 w-3" />
                          {o.transportJobs.length}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString('lv-LV')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
