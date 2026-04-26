/**
 * Admin skip-hire orders page — /dashboard/admin/skip-hire
 * Platform-wide view of all SkipHireOrder records with status filtering and carrier details.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { adminGetSkipHireOrders, type AdminSkipHireOrder } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { RefreshCw, Box, Search } from 'lucide-react';

// ── Status colours ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  IN_USE: 'bg-purple-100 text-purple-700',
  AWAITING_COLLECTION: 'bg-orange-100 text-orange-700',
  COLLECTED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-500',
};

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-500',
  AUTHORIZED: 'bg-yellow-100 text-yellow-700',
  CAPTURED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
  FAILED: 'bg-red-100 text-red-600',
};

function StatusBadge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? 'bg-gray-100 text-gray-500';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}

// ── Filters ────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Gaida' },
  { value: 'CONFIRMED', label: 'Apstiprināti' },
  { value: 'DELIVERED', label: 'Piegādāti' },
  { value: 'IN_USE', label: 'Lietošanā' },
  { value: 'AWAITING_COLLECTION', label: 'Gaida savākšanu' },
  { value: 'COLLECTED', label: 'Savākti' },
  { value: 'CANCELLED', label: 'Atcelti' },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminSkipHirePage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<AdminSkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetSkipHireOrders(token);
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
      o.location.toLowerCase().includes(q) ||
      (o.contactName ?? '').toLowerCase().includes(q) ||
      (o.contactEmail ?? '').toLowerCase().includes(q) ||
      (o.contactPhone ?? '').toLowerCase().includes(q) ||
      (o.carrier?.name ?? '').toLowerCase().includes(q)
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
        title="Skip Hire Pasūtījumi"
        description={`${orders.length} skip nomas pasūtījumi platformā`}
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
          placeholder="Meklēt pēc nr., adreses, klienta, pārvadātāja..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {/* Filters */}
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={Box}
          title="Nav skip hire pasūtījumu"
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
                    Klients
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Adrese
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Konteiners
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Pārvadātājs
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Statuss
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Maksājums
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Cena
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    Piegāde
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-900 text-xs">
                          {o.contactName ?? '—'}
                        </p>
                        {o.contactEmail && (
                          <p className="text-xs text-muted-foreground">{o.contactEmail}</p>
                        )}
                        {o.contactPhone && (
                          <p className="text-xs text-muted-foreground">{o.contactPhone}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 max-w-32 truncate">
                      {o.location}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <p className="font-medium text-gray-800">{o.skipSize.replace(/_/g, ' ')}</p>
                        <p className="text-muted-foreground">
                          {o.wasteCategory.replace(/_/g, ' ')}
                        </p>
                        {o.hireDays && <p className="text-muted-foreground">{o.hireDays} dienas</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {o.carrier?.name ?? <span className="text-gray-300">Nav piešķirts</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={o.status} colorMap={STATUS_COLORS} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge value={o.paymentStatus} colorMap={PAYMENT_COLORS} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 text-xs">
                      {o.price.toLocaleString('lv-LV', { style: 'currency', currency: o.currency })}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(o.deliveryDate).toLocaleDateString('lv-LV')}
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
