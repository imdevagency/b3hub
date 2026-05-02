/**
 * Admin Finances hub — /dashboard/admin/finances
 * Tabbed hub: Izmaksas (payouts) · Maksājumi (payments) · Rēķini (invoices)
 */
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Zap,
  Euro,
  TrendingUp,
  XCircle,
  RotateCcw,
  RefreshCw,
  FileText,
  AlertCircle,
  Download,
  ArrowUpRight,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/common';
import {
  adminExecuteSupplierPayout,
  adminExecuteCarrierPayout,
  adminExecuteAllPayouts,
  adminGetPayments,
  adminReleasePayment,
  adminRefundPayment,
  adminGetAllInvoices,
  adminGetFinanceStats,
  type AdminPayment,
  type AdminInvoice,
  type AdminFinanceStats,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, currency = 'EUR') {
  if (n == null) return '—';
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string | null | undefined, withTime = false) {
  if (!s) return '—';
  return new Intl.DateTimeFormat('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(s));
}

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

// ─── Payout types ─────────────────────────────────────────────────────────────

interface SupplierPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;
  order?: { orderNumber: string } | null;
  supplier?: { id: string; name: string; ibanNumber?: string | null } | null;
}

interface CarrierPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;
  order?: { orderNumber: string } | null;
  carrier?: { id: string; name: string; ibanNumber?: string | null } | null;
  driver?: { id: string; firstName: string; lastName: string } | null;
}

interface PayoutSummary {
  pending: {
    supplierAmount: number;
    supplierCount: number;
    carrierAmount: number;
    carrierCount: number;
    totalAmount: number;
  };
  overdue: {
    supplierAmount: number;
    supplierCount: number;
    carrierAmount: number;
    carrierCount: number;
    totalAmount: number;
  };
}

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  PROCESSING: 'Apstrādā',
  PAID: 'Izmaksāts',
  FAILED: 'Kļūda',
  CANCELLED: 'Atcelts',
};
const PAYOUT_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

// ─── Payouts tab ──────────────────────────────────────────────────────────────

function PayoutsTab({ token }: { token: string }) {
  const [supplierPayouts, setSupplierPayouts] = useState<SupplierPayout[]>([]);
  const [carrierPayouts, setCarrierPayouts] = useState<CarrierPayout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [executingAll, setExecutingAll] = useState(false);

  const load = useCallback(
    async (status: string) => {
      if (!token) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ limit: '200' });
        if (status !== 'ALL') qs.set('status', status);
        const [res, sum] = await Promise.all([
          apiFetch<{ supplierPayouts: SupplierPayout[]; carrierPayouts: CarrierPayout[] }>(
            `/admin/payouts?${qs}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
          apiFetch<PayoutSummary>('/admin/payouts/summary', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setSupplierPayouts(res.supplierPayouts);
        setCarrierPayouts(res.carrierPayouts);
        setSummary(sum);
      } catch {
        setSupplierPayouts([]);
        setCarrierPayouts([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) load(statusFilter);
  }, [token, statusFilter, load]);

  async function runAll() {
    setExecutingAll(true);
    try {
      await adminExecuteAllPayouts(token);
      load(statusFilter);
    } finally {
      setExecutingAll(false);
    }
  }

  const filteredSupplier = search.trim()
    ? supplierPayouts.filter(
        (p) =>
          p.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.order?.orderNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : supplierPayouts;

  const filteredCarrier = search.trim()
    ? carrierPayouts.filter(
        (p) =>
          p.carrier?.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.driver?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
          p.driver?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
          p.order?.orderNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : carrierPayouts;

  const pendingTotal = summary ? summary.pending.supplierAmount + summary.pending.carrierAmount : 0;
  const overdueTotal = summary ? summary.overdue.supplierAmount + summary.overdue.carrierAmount : 0;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Piegādātāju un pārvadātāju izmaksu pārvaldība
        </p>
        <Button size="sm" onClick={runAll} disabled={executingAll || loading}>
          {executingAll ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Izpildīt visas
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Gaida izmaksu"
          value={fmt(pendingTotal)}
          sub={`${(summary?.pending.supplierCount ?? 0) + (summary?.pending.carrierCount ?? 0)} ieraksti`}
          icon={Clock}
          accent="text-amber-600"
        />
        <StatCard
          label="Kavētie"
          value={fmt(overdueTotal)}
          sub={`${(summary?.overdue.supplierCount ?? 0) + (summary?.overdue.carrierCount ?? 0)} ieraksti`}
          icon={AlertTriangle}
          accent="text-red-600"
        />
        <StatCard
          label="Piegādātāji gaida"
          value={fmt(summary?.pending.supplierAmount ?? 0)}
          sub={`${summary?.pending.supplierCount ?? 0} izmaksas`}
          icon={Wallet}
        />
        <StatCard
          label="Pārvadātāji gaida"
          value={fmt(summary?.pending.carrierAmount ?? 0)}
          sub={`${summary?.pending.carrierCount ?? 0} izmaksas`}
          icon={CheckCircle2}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Meklēt pēc uzņēmuma vai pasūtījuma..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            <SelectItem value="PENDING">Gaida</SelectItem>
            <SelectItem value="PROCESSING">Apstrādā</SelectItem>
            <SelectItem value="PAID">Izmaksāts</SelectItem>
            <SelectItem value="FAILED">Kļūda</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="supplier">
        <TabsList>
          <TabsTrigger value="supplier">
            Piegādātāji{' '}
            {filteredSupplier.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filteredSupplier.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="carrier">
            Pārvadātāji{' '}
            {filteredCarrier.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filteredCarrier.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="supplier">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-px">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-none" />
                  ))}
                </div>
              ) : filteredSupplier.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nav izmaksu"
                  description="Nav piegādātāja izmaksu šim filtram."
                  className="py-12"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Piegādātājs</TableHead>
                      <TableHead>IBAN</TableHead>
                      <TableHead>Pasūtījums</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Termiņš</TableHead>
                      <TableHead>Izmaksāts</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSupplier.map((p) => {
                      const isOverdue = p.status === 'PENDING' && new Date(p.dueDate) < new Date();
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm font-medium">
                            {p.supplier?.name ?? '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {p.supplier?.ibanNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.order?.orderNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {fmt(p.amount, p.currency)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PAYOUT_STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {isOverdue && <AlertTriangle className="h-3 w-3" />}
                              {PAYOUT_STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
                              {fmtDate(p.dueDate)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fmtDate(p.paidAt)}
                          </TableCell>
                          <TableCell>
                            {p.status === 'PENDING' && (
                              <PayoutExecuteBtn
                                id={p.id}
                                type="supplier"
                                token={token}
                                onDone={() => load(statusFilter)}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="carrier">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-px">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-none" />
                  ))}
                </div>
              ) : filteredCarrier.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="Nav izmaksu"
                  description="Nav pārvadātāja izmaksu šim filtram."
                  className="py-12"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vadītājs / Uzņēmums</TableHead>
                      <TableHead>IBAN</TableHead>
                      <TableHead>Pasūtījums</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>Statuss</TableHead>
                      <TableHead>Termiņš</TableHead>
                      <TableHead>Izmaksāts</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCarrier.map((p) => {
                      const isOverdue = p.status === 'PENDING' && new Date(p.dueDate) < new Date();
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm font-medium">
                            {p.driver
                              ? `${p.driver.firstName} ${p.driver.lastName}`
                              : (p.carrier?.name ?? '—')}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {p.carrier?.ibanNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.order?.orderNumber ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {fmt(p.amount, p.currency)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PAYOUT_STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {isOverdue && <AlertTriangle className="h-3 w-3" />}
                              {PAYOUT_STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
                              {fmtDate(p.dueDate)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fmtDate(p.paidAt)}
                          </TableCell>
                          <TableCell>
                            {p.status === 'PENDING' && (
                              <PayoutExecuteBtn
                                id={p.id}
                                type="carrier"
                                token={token}
                                onDone={() => load(statusFilter)}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PayoutExecuteBtn({
  id,
  type,
  token,
  onDone,
}: {
  id: string;
  type: 'supplier' | 'carrier';
  token: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      if (type === 'supplier') await adminExecuteSupplierPayout(id, token);
      else await adminExecuteCarrierPayout(id, token);
      onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={go}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Izmaksāt'}
    </Button>
  );
}

// ─── Payments tab ─────────────────────────────────────────────────────────────

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  AUTHORIZED: 'Autorizēts',
  CAPTURED: 'Iekasēts',
  RELEASED: 'Izmaksāts',
  PAID: 'Apmaksāts',
  PARTIALLY_PAID: 'Daļēji apm.',
  REFUNDED: 'Atmaksāts',
  FAILED: 'Kļūda',
};
const PAYMENT_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  AUTHORIZED: 'bg-blue-100 text-blue-800',
  CAPTURED: 'bg-amber-100 text-amber-800',
  RELEASED: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800',
  REFUNDED: 'bg-purple-100 text-purple-800',
  FAILED: 'bg-red-100 text-red-800',
};

function PaymentsTab({ token }: { token: string }) {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [releasing, setReleasing] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<AdminPayment | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    if (!token) return;
    adminGetPayments(token)
      .then(setPayments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

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

  const statuses = useMemo(
    () => ['ALL', ...Array.from(new Set(payments.map((p) => p.status))).sort()],
    [payments],
  );

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !(
              p.order?.orderNumber?.toLowerCase().includes(q) ||
              p.order?.buyer?.name?.toLowerCase().includes(q) ||
              p.stripePaymentId?.toLowerCase().includes(q)
            )
          )
            return false;
        }
        return true;
      }),
    [payments, statusFilter, search],
  );

  const handleRelease = async (paymentId: string) => {
    if (!token || releasing) return;
    if (!confirm('Izmaksāt pārdevējam? Šo darbību nevar atsaukt.')) return;
    setReleasing(paymentId);
    try {
      await adminReleasePayment(paymentId, token);
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, status: 'RELEASED' } : p)),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setReleasing(null);
    }
  };

  const handleRefund = async () => {
    if (!refundTarget || !token) return;
    setRefunding(refundTarget.id);
    try {
      await adminRefundPayment(refundTarget.id, refundReason || 'Admin manual refund', token);
      setPayments((prev) =>
        prev.map((p) => (p.id === refundTarget.id ? { ...p, status: 'REFUNDED' } : p)),
      );
      setRefundTarget(null);
      setRefundReason('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Kļūda');
    } finally {
      setRefunding(null);
    }
  };

  return (
    <div className="space-y-5 pt-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gaida izmaksu"
          value={String(stats.capturedCount)}
          sub={fmt(stats.capturedAmount)}
          icon={Clock}
          accent="text-amber-600"
        />
        <StatCard
          label="Platformas komisija"
          value={fmt(stats.pendingPlatformFee)}
          sub={`No ${stats.capturedCount} iekasētiem`}
          icon={Euro}
          accent="text-blue-600"
        />
        <StatCard
          label="Kopā izmaksāts"
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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Meklēt pēc pasūtījuma, uzņēmuma vai Stripe ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? 'Visi statusi' : (PAYMENT_STATUS_LABEL[s] ?? s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats.capturedCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm text-amber-900">
          <TrendingUp className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <span>
            <strong>{stats.capturedCount} maksājumi</strong> ({fmt(stats.capturedAmount)}) gaida
            izmaksu pārdevējiem.
          </span>
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Euro} title="Nav maksājumu" description="Mēģiniet mainīt filtrus." />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pasūtījums</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Pircējs</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Summa
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Pārdevējs saņem
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">
                    Komisija
                  </th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Statuss</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Datums</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{p.order?.orderNumber ?? '—'}</td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_STYLE[p.status] ?? 'bg-muted text-muted-foreground'}`}
                      >
                        {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(p.createdAt, true)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.status === 'CAPTURED' && p.order?.id && (
                          <button
                            onClick={() => handleRelease(p.id)}
                            disabled={releasing === p.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-2.5 py-1.5 transition-colors"
                          >
                            <Zap className="h-3 w-3" />
                            {releasing === p.id ? 'Apstrādā…' : 'Izmaksāt'}
                          </button>
                        )}
                        {['CAPTURED', 'PAID'].includes(p.status) && (
                          <button
                            onClick={() => {
                              setRefundTarget(p);
                              setRefundReason('');
                            }}
                            disabled={!!refunding}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-xs font-semibold px-2.5 py-1.5 border border-red-200 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Atmaksāt
                          </button>
                        )}
                        {p.order?.id && (
                          <Link
                            href={`/dashboard/admin/orders/${p.order.id}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
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

      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Atmaksāt maksājumu — {refundTarget?.order?.orderNumber ?? ''}?
            </DialogTitle>
            <DialogDescription>
              Pilns Stripe atmaksa pircēja kartei. Šo darbību <strong>nevar atsaukt</strong>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Atmaksas iemesls (neobligāts)..."
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={!!refunding}>
              Atpakaļ
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={!!refunding}>
              {refunding ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1.5" />
              )}
              Atmaksāt pircējam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Invoices tab ─────────────────────────────────────────────────────────────

const INV_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  PAID: 'Apmaksāts',
  OVERDUE: 'Kavēts',
  FAILED: 'Kļūda',
  REFUNDED: 'Atmaksāts',
  CANCELLED: 'Atcelts',
  PARTIALLY_PAID: 'Daļēji apm.',
  AUTHORIZED: 'Autorizēts',
  CAPTURED: 'Iekasēts',
};
const INV_STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  OVERDUE: 'bg-red-100 text-red-800',
  FAILED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-purple-100 text-purple-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-800',
  AUTHORIZED: 'bg-blue-100 text-blue-800',
  CAPTURED: 'bg-amber-100 text-amber-800',
};

function InvoicesTab({ token }: { token: string }) {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (p: number, status: string) => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await adminGetAllInvoices(token, p, 50, status === 'ALL' ? undefined : status);
        setInvoices(res.data);
        setTotal(res.total);
      } catch {
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) load(page, statusFilter);
  }, [token, page, statusFilter, load]);

  const visible = search.trim()
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          inv.buyerCompany?.name?.toLowerCase().includes(search.toLowerCase()) ||
          inv.sellerCompany?.name?.toLowerCase().includes(search.toLowerCase()) ||
          inv.order?.orderNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : invoices;

  const totalValue = invoices.reduce((s, i) => s + i.total, 0);
  const pendingCount = invoices.filter((i) =>
    ['PENDING', 'AUTHORIZED', 'CAPTURED'].includes(i.paymentStatus),
  ).length;
  const overdueCount = invoices.filter((i) => i.paymentStatus === 'OVERDUE').length;
  const paidValue = invoices
    .filter((i) => i.paymentStatus === 'PAID')
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-5 pt-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Kopā vērtība" value={fmt(totalValue)} icon={FileText} />
        <StatCard
          label="Apmaksāti"
          value={fmt(paidValue)}
          icon={CheckCircle2}
          accent="text-emerald-600"
        />
        <StatCard
          label="Gaida apmaksu"
          value={String(pendingCount)}
          icon={Clock}
          accent="text-amber-600"
        />
        <StatCard
          label="Kavētie"
          value={String(overdueCount)}
          icon={AlertCircle}
          accent="text-red-600"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Meklēt pēc numura, uzņēmuma vai pasūtījuma..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            <SelectItem value="PENDING">Gaida</SelectItem>
            <SelectItem value="PAID">Apmaksāts</SelectItem>
            <SelectItem value="OVERDUE">Kavēts</SelectItem>
            <SelectItem value="CANCELLED">Atcelts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-none" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nav rēķinu"
              description="Šim filtram nav atrasts neviens rēķins."
              className="py-12"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Pircējs</TableHead>
                  <TableHead>Pārdevējs</TableHead>
                  <TableHead>Pasūtījums</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="text-right">PVN</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead>Termiņš</TableHead>
                  <TableHead>Veids</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-sm">{inv.buyerCompany?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{inv.sellerCompany?.name ?? 'B3Hub'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.order?.orderNumber ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {fmt(inv.total, inv.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                      {fmt(inv.tax, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${INV_STATUS_STYLE[inv.paymentStatus] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {INV_STATUS_LABEL[inv.paymentStatus] ?? inv.paymentStatus}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(inv.dueDate)}
                    </TableCell>
                    <TableCell>
                      {inv.isCommissionInvoice && (
                        <Badge variant="outline" className="text-xs">
                          Komisija
                        </Badge>
                      )}
                      {inv.isCreditNote && (
                        <Badge
                          variant="outline"
                          className="text-xs text-purple-700 border-purple-300"
                        >
                          Kredītrēķins
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {inv.pdfUrl && (
                        <a href={inv.pdfUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > 50 && !loading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Lapa {page} · {total} rēķini kopā
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Iepriekšējā
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 50 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Nākamā
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

const ORDER_TYPE_LABEL: Record<string, string> = {
  MATERIAL: 'Materiāli',
  TRANSPORT: 'Transports',
  COMBINED: 'Kombinēts',
  DISPOSAL: 'Atkritumi',
  CONTAINER: 'Konteiners',
};

function pct(current: number, previous: number) {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const p = pct(current, previous);
  if (p === null) return null;
  const up = p >= 0;
  return (
    <span className={`text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(p)}% vs iepr.
    </span>
  );
}

function MiniBar({
  value,
  max,
  color = 'bg-blue-500',
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function OverviewTab({ token }: { token: string }) {
  const [stats, setStats] = useState<AdminFinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    adminGetFinanceStats(token)
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Kļūda'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="pt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error ?? 'Nav datu'}
      </div>
    );
  }

  const maxGmv = Math.max(...stats.monthlyTrend.map((m) => m.gmv), 1);
  const maxCommission = Math.max(...stats.monthlyTrend.map((m) => m.commission), 1);
  const totalOrderGmv = stats.byOrderType.reduce((s, t) => s + t.gmv, 0);

  const commissionRateThisMonth =
    stats.gmv.thisMonth > 0
      ? ((stats.commission.thisMonth / stats.gmv.thisMonth) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6 pt-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              GMV šomēnes
            </p>
            <p className="text-2xl font-bold tabular-nums text-blue-700">
              {fmt(stats.gmv.thisMonth)}
            </p>
            <div className="flex items-center gap-2">
              <TrendBadge current={stats.gmv.thisMonth} previous={stats.gmv.lastMonth} />
            </div>
            <p className="text-xs text-muted-foreground">{stats.orders.thisMonth} pasūtījumi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Komisija šomēnes
            </p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">
              {fmt(stats.commission.thisMonth)}
            </p>
            <div className="flex items-center gap-2">
              <TrendBadge
                current={stats.commission.thisMonth}
                previous={stats.commission.lastMonth}
              />
            </div>
            <p className="text-xs text-muted-foreground">{commissionRateThisMonth}% no GMV</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Gaida izmaksas
            </p>
            <p className="text-2xl font-bold tabular-nums text-amber-600">
              {fmt(stats.pendingPayouts.total)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.pendingPayouts.totalCount} ieraksti
            </p>
            <p className="text-xs text-muted-foreground">
              Pieg. {fmt(stats.pendingPayouts.supplierAmount)} · Pārvad.{' '}
              {fmt(stats.pendingPayouts.carrierAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              GMV kopā
            </p>
            <p className="text-2xl font-bold tabular-nums">{fmt(stats.gmv.allTime)}</p>
            <p className="text-xs text-muted-foreground">
              Komisija kopā: {fmt(stats.commission.allTime)}
            </p>
            <p className="text-xs text-muted-foreground">
              Skip hire šomēnes: {fmt(stats.gmv.skipThisMonth)} ({stats.gmv.skipCountThisMonth})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend chart */}
      <Card>
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">GMV un komisija — pēdējie 12 mēneši</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
              GMV
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Komisija
            </span>
          </div>
        </div>
        <CardContent className="pb-4">
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-[600px] h-44">
              {stats.monthlyTrend.map((m) => {
                const gmvH = maxGmv > 0 ? Math.round((m.gmv / maxGmv) * 148) : 2;
                const comH = maxGmv > 0 ? Math.round((m.commission / maxGmv) * 148) : 2;
                const label = m.month.slice(0, 7); // YYYY-MM
                const [yr, mo] = label.split('-');
                const shortLabel = `${mo}/${yr.slice(2)}`;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full flex items-end gap-0.5 justify-center">
                      <div
                        title={`GMV: ${fmt(m.gmv)}`}
                        className="flex-1 bg-blue-400 rounded-t-sm cursor-default transition-all group-hover:bg-blue-500"
                        style={{ height: `${Math.max(gmvH, 2)}px` }}
                      />
                      <div
                        title={`Komisija: ${fmt(m.commission)}`}
                        className="flex-1 bg-emerald-400 rounded-t-sm cursor-default transition-all group-hover:bg-emerald-500"
                        style={{ height: `${Math.max(comH, 2)}px` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {shortLabel}
                    </span>
                    <span className="text-[9px] text-blue-600 tabular-nums opacity-0 group-hover:opacity-100">
                      {m.orders}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown by order type + pending payouts split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-5 pt-4 pb-1">
            <p className="text-sm font-semibold">GMV pēc pasūtījuma veida</p>
          </div>
          <CardContent className="space-y-3 pt-2">
            {stats.byOrderType
              .sort((a, b) => b.gmv - a.gmv)
              .map((row) => (
                <div key={row.type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{ORDER_TYPE_LABEL[row.type] ?? row.type}</span>
                    <span className="tabular-nums font-medium">{fmt(row.gmv)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBar value={row.gmv} max={totalOrderGmv} color="bg-blue-400" />
                    <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                      {totalOrderGmv > 0 ? Math.round((row.gmv / totalOrderGmv) * 100) : 0}% ·{' '}
                      {row.count}
                    </span>
                  </div>
                </div>
              ))}
            {stats.byOrderType.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nav datu</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="px-5 pt-4 pb-1">
            <p className="text-sm font-semibold">Gaida izmaksas sadalījums</p>
          </div>
          <CardContent className="pt-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="text-sm font-medium">Piegādātāji</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingPayouts.supplierCount} izmaksas
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-amber-600">
                  {fmt(stats.pendingPayouts.supplierAmount)}
                </p>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="text-sm font-medium">Pārvadātāji / Šoferi</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingPayouts.carrierCount} izmaksas
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-amber-600">
                  {fmt(stats.pendingPayouts.carrierAmount)}
                </p>
              </div>
              <div className="flex items-center justify-between py-2">
                <p className="text-sm font-semibold">Kopā</p>
                <p className="text-xl font-bold tabular-nums text-amber-700">
                  {fmt(stats.pendingPayouts.total)}
                </p>
              </div>
              <MiniBar
                value={stats.pendingPayouts.supplierAmount}
                max={stats.pendingPayouts.total}
                color="bg-amber-400"
              />
              <p className="text-xs text-muted-foreground">
                Piegādātāji{' '}
                {stats.pendingPayouts.total > 0
                  ? Math.round(
                      (stats.pendingPayouts.supplierAmount / stats.pendingPayouts.total) * 100,
                    )
                  : 0}
                % · Pārvadātāji{' '}
                {stats.pendingPayouts.total > 0
                  ? Math.round(
                      (stats.pendingPayouts.carrierAmount / stats.pendingPayouts.total) * 100,
                    )
                  : 0}
                %
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

function FinancesHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token: rawToken, isLoading } = useAuth();
  const token = rawToken ?? '';
  const tab = searchParams.get('tab') ?? 'overview';

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <PageHeader title="Finanses" description="Platformas ieņēmumi, izmaksas un rēķini" />
      <Tabs value={tab} onValueChange={(t) => router.push(`?tab=${t}`)}>
        <TabsList>
          <TabsTrigger value="overview">Pārskats</TabsTrigger>
          <TabsTrigger value="payouts">Izmaksas</TabsTrigger>
          <TabsTrigger value="payments">Maksājumi</TabsTrigger>
          <TabsTrigger value="invoices">Rēķini</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab token={token} />
        </TabsContent>
        <TabsContent value="payouts">
          <PayoutsTab token={token} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab token={token} />
        </TabsContent>
        <TabsContent value="invoices">
          <InvoicesTab token={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FinancesHubPage() {
  return (
    <Suspense>
      <FinancesHubContent />
    </Suspense>
  );
}
