/**
 * Admin supplier performance — /dashboard/admin/suppliers
 * Per-supplier metrics: GMV, completion rate, disputes, active listings.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { adminGetSupplierPerformance, type SupplierPerformance } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Building2,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function RateBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums font-medium w-8 text-right">{value}%</span>
    </div>
  );
}

type SortKey = 'name' | 'gmv' | 'totalOrders' | 'completionRate' | 'disputeRate' | 'openDisputes';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSuppliersPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('gmv');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.userType !== 'ADMIN')) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetSupplierPerformance(token);
      setSuppliers(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && token) fetchData();
  }, [isLoading, token, fetchData]);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = q
      ? suppliers.filter(
          (s) => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q),
        )
      : suppliers;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [suppliers, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortAsc ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )
    ) : null;

  const totalGmv = suppliers.reduce((s, p) => s + p.gmv, 0);
  const withDisputes = suppliers.filter((s) => s.openDisputes > 0).length;
  const avgCompletion =
    suppliers.length > 0
      ? Math.round(suppliers.reduce((s, p) => s + p.completionRate, 0) / suppliers.length)
      : 0;

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
        title="Piegādātāju veiktspēja"
        description="Katrs piegādātājs — GMV, pasūtījumu izpilde, strīdi, aktīvie materiāli."
        action={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atjaunot
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kopējais GMV
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(totalGmv)}</p>
        </div>
        <div className="rounded-2xl border bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vidējā izpilde
          </p>
          <p className="mt-1 text-2xl font-bold">{avgCompletion}%</p>
        </div>
        <div
          className={`rounded-2xl border p-5 ${withDisputes > 0 ? 'border-red-200 bg-red-50' : 'bg-background'}`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${withDisputes > 0 ? 'text-red-600' : 'text-muted-foreground'}`}
          >
            Piegādātāji ar strīdiem
          </p>
          <p
            className={`mt-1 text-2xl font-bold ${withDisputes > 0 ? 'text-red-700' : 'text-foreground'}`}
          >
            {withDisputes}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Meklēt piegādātāju..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent"
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nav piegādātāju"
          description="Mēģiniet mainīt meklēšanu."
        />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left">
                  <th
                    className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('name')}
                  >
                    <span className="flex items-center gap-1">
                      Piegādātājs <SortIcon k="name" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground text-right"
                    onClick={() => toggleSort('gmv')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      GMV <SortIcon k="gmv" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground text-center"
                    onClick={() => toggleSort('totalOrders')}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Pasūt. <SortIcon k="totalOrders" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('completionRate')}
                  >
                    <span className="flex items-center gap-1">
                      Izpilde <SortIcon k="completionRate" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('disputeRate')}
                  >
                    <span className="flex items-center gap-1">
                      Strīdi <SortIcon k="disputeRate" />
                    </span>
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-center">
                    Mat.
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-center">
                    Verif.
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Komisija
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((s) => {
                  const hasIssue = s.openDisputes > 0 || s.disputeRate >= 10;
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${hasIssue ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-muted/20'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {hasIssue && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                          <div>
                            <p className="font-semibold text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                        {fmt(s.gmv)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs">
                          <p className="font-semibold">{s.totalOrders}</p>
                          <p className="text-muted-foreground">{s.cancelledOrders} atc.</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-36">
                        <RateBar value={s.completionRate} color="bg-emerald-500" />
                      </td>
                      <td className="px-4 py-3 w-36">
                        <RateBar
                          value={s.disputeRate}
                          color={s.disputeRate >= 10 ? 'bg-red-500' : 'bg-amber-400'}
                        />
                        {s.openDisputes > 0 && (
                          <p className="text-xs text-red-600 font-semibold mt-0.5">
                            {s.openDisputes} atvērti
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium">
                        {s.activeMaterials}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.verified ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">
                            ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-xs font-semibold">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-700">
                        {s.commissionRate}%
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/admin/companies?id=${s.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Atvērt uzņēmumu"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {sorted.length} piegādātāji · Kopējais GMV {fmt(sorted.reduce((s, p) => s + p.gmv, 0))}
          </div>
        </div>
      )}
    </div>
  );
}
