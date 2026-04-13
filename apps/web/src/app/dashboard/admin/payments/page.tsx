'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Euro, TrendingUp, Clock, CheckCircle2, XCircle, ArrowUpRight, Search } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetPayments, type AdminPayment } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, currency = 'EUR') {
  if (n == null) return '—';
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

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  AUTHORIZED: 'Autorizēts',
  CAPTURED: 'Iekasēts',
  RELEASED: 'Izmaksāts',
  PAID: 'Apmaksāts',
  PARTIALLY_PAID: 'Daļēji apm.',
  REFUNDED: 'Atmaksāts',
  FAILED: 'Kļūda',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  AUTHORIZED: 'bg-blue-100 text-blue-800',
  CAPTURED: 'bg-amber-100 text-amber-800',
  RELEASED: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800',
  REFUNDED: 'bg-purple-100 text-purple-800',
  FAILED: 'bg-red-100 text-red-800',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ?? 'text-foreground'}`}>
              {value}
            </p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-xl bg-muted p-2.5 shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (isLoading) return;
    if (!token || user?.userType !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    adminGetPayments(token)
      .then(setPayments)
      .catch(() => setError('Neizdevās ielādēt maksājumus'))
      .finally(() => setLoading(false));
  }, [token, user, isLoading, router]);

  // Stats
  const stats = useMemo(() => {
    const captured = payments.filter((p) => p.status === 'CAPTURED');
    const released = payments.filter((p) => ['RELEASED', 'PAID'].includes(p.status));
    const failed = payments.filter((p) => p.status === 'FAILED');
    const pending = payments.filter((p) => ['PENDING', 'AUTHORIZED'].includes(p.status));

    const sum = (arr: AdminPayment[], field: keyof AdminPayment) =>
      arr.reduce((s, p) => s + ((p[field] as number | null) ?? 0), 0);

    return {
      capturedCount: captured.length,
      capturedAmount: sum(captured, 'amount'),
      pendingPlatformFee: sum(captured, 'platformFee'),
      releasedTotal: sum(released, 'sellerPayout'),
      failedCount: failed.length,
      pendingCount: pending.length,
    };
  }, [payments]);

  // Filter
  const statuses = useMemo(
    () => ['ALL', ...Array.from(new Set(payments.map((p) => p.status))).sort()],
    [payments],
  );

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const orderNum = p.order?.orderNumber?.toLowerCase() ?? '';
        const buyer = p.order?.buyer?.name?.toLowerCase() ?? '';
        const stripe = p.stripePaymentId?.toLowerCase() ?? '';
        if (!orderNum.includes(q) && !buyer.includes(q) && !stripe.includes(q)) return false;
      }
      return true;
    });
  }, [payments, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm animate-pulse">Ielādē maksājumus…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Maksājumu rinda"
        description="Platforma maksājumu cauruļvads — autorizētie, iekasētie un izmaksātie maksājumi."
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gaida izmaksu"
          value={String(stats.capturedCount)}
          sub={fmt(stats.capturedAmount)}
          icon={Clock}
          accent="text-amber-600"
        />
        <StatCard
          label="Platformas komisija (gaida)"
          value={fmt(stats.pendingPlatformFee)}
          sub={`No ${stats.capturedCount} iekasētiem`}
          icon={Euro}
          accent="text-blue-600"
        />
        <StatCard
          label="Kopā izmaksāts pārdevējiem"
          value={fmt(stats.releasedTotal)}
          icon={CheckCircle2}
          accent="text-emerald-600"
        />
        <StatCard
          label="Neveiksmīgi"
          value={String(stats.failedCount)}
          sub={`${stats.pendingCount} vēl gaida`}
          icon={XCircle}
          accent={stats.failedCount > 0 ? 'text-red-600' : 'text-foreground'}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Meklēt pēc pasūtījuma nr., uzņēmuma vai Stripe ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? 'Visi statusi' : (STATUS_LABEL[s] ?? s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Captured-pending warning */}
      {stats.capturedCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm text-amber-900">
          <TrendingUp className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>{stats.capturedCount} maksājumi</strong> ar kopējo summu{' '}
            <strong>{fmt(stats.capturedAmount)}</strong> ir iekasēti no pircējiem un gaida izmaksu
            pārdevējiem (statuss <em>CAPTURED</em>).
          </span>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Euro}
          title="Nav maksājumu"
          description="Mēģiniet mainīt filtrus vai meklēšanas vērtību."
        />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pasūtījums</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">
                    Pircēja uzņēmums
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Summa
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Pārdevējs saņem
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Komisija
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Stripe PI</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Statuss</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Datums</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                      {p.order?.orderNumber ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {p.order?.buyer ? (
                        <Link
                          href={`/dashboard/admin/companies?highlight=${p.order.buyer.id}`}
                          className="hover:underline text-primary"
                        >
                          {p.order.buyer.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {fmt(p.amount, p.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                      {fmt(p.sellerPayout, p.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-blue-700">
                      {fmt(p.platformFee, p.currency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-30">
                      {p.stripePaymentId ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[p.status] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {p.order?.id && (
                        <Link
                          href={`/dashboard/admin/orders/${p.order.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Atvērt pasūtījumu"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Rāda {filtered.length} no {payments.length} maksājumiem
          </div>
        </div>
      )}
    </div>
  );
}
