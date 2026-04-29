'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wallet, Clock, AlertTriangle, CheckCircle2, Loader2, Search, Zap } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/common';
import {
  adminExecuteSupplierPayout,
  adminExecuteCarrierPayout,
  adminExecuteAllPayouts,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  payseraTransferId?: string | null;
  createdAt: string;
  payoutType: 'supplier';
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
  notes?: string | null;
  payseraTransferId?: string | null;
  createdAt: string;
  payoutType: 'carrier';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Intl.DateTimeFormat('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(s));
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida',
  PROCESSING: 'Apstrādā',
  PAID: 'Izmaksāts',
  FAILED: 'Kļūda',
  CANCELLED: 'Atcelts',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
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

// ─── Supplier payout row ──────────────────────────────────────────────────────

function SupplierRow({
  payout,
  token,
  onDone,
}: {
  payout: SupplierPayout;
  token: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function execute() {
    setBusy(true);
    try {
      await adminExecuteSupplierPayout(payout.id, token);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const isOverdue = payout.status === 'PENDING' && new Date(payout.dueDate) < new Date();

  return (
    <TableRow>
      <TableCell className="text-sm font-medium">{payout.supplier?.name ?? '—'}</TableCell>
      <TableCell className="text-xs text-muted-foreground font-mono">
        {payout.supplier?.ibanNumber ?? '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {payout.order?.orderNumber ?? '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums font-semibold">
        {fmt(payout.amount, payout.currency)}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[payout.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {isOverdue && <AlertTriangle className="h-3 w-3" />}
          {STATUS_LABEL[payout.status] ?? payout.status}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
          {fmtDate(payout.dueDate)}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{fmtDate(payout.paidAt)}</TableCell>
      <TableCell>
        {payout.status === 'PENDING' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy}
            onClick={execute}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Izmaksāt'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Carrier payout row ───────────────────────────────────────────────────────

function CarrierRow({
  payout,
  token,
  onDone,
}: {
  payout: CarrierPayout;
  token: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function execute() {
    setBusy(true);
    try {
      await adminExecuteCarrierPayout(payout.id, token);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const isOverdue = payout.status === 'PENDING' && new Date(payout.dueDate) < new Date();

  return (
    <TableRow>
      <TableCell className="text-sm font-medium">
        {payout.driver
          ? `${payout.driver.firstName} ${payout.driver.lastName}`
          : (payout.carrier?.name ?? '—')}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground font-mono">
        {payout.carrier?.ibanNumber ?? '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {payout.order?.orderNumber ?? '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums font-semibold">
        {fmt(payout.amount, payout.currency)}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[payout.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {isOverdue && <AlertTriangle className="h-3 w-3" />}
          {STATUS_LABEL[payout.status] ?? payout.status}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <span className={isOverdue ? 'text-red-600 font-medium' : undefined}>
          {fmtDate(payout.dueDate)}
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{fmtDate(payout.paidAt)}</TableCell>
      <TableCell>
        {payout.status === 'PENDING' && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy}
            onClick={execute}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Izmaksāt'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPayoutsPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

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
          apiFetch<{
            supplierPayouts: SupplierPayout[];
            carrierPayouts: CarrierPayout[];
            meta: { supplierTotal: number; carrierTotal: number };
          }>(`/admin/payouts?${qs}`, { headers: { Authorization: `Bearer ${token}` } }),
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
    if (!authLoading && token) load(statusFilter);
  }, [authLoading, token, statusFilter, load]);

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

  if (authLoading) return null;

  const pendingTotal = summary ? summary.pending.supplierAmount + summary.pending.carrierAmount : 0;
  const overdueTotal = summary ? summary.overdue.supplierAmount + summary.overdue.carrierAmount : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Izmaksas" description="Piegādātāju un pārvadātāju izmaksu pārvaldība" />
        <Button onClick={runAll} disabled={executingAll || loading} className="shrink-0">
          {executingAll ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Zap className="h-4 w-4 mr-2" />
          )}
          Izpildīt visas
        </Button>
      </div>

      {/* Stats */}
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
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
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="supplier">
        <TabsList>
          <TabsTrigger value="supplier">
            Piegādātāji
            {filteredSupplier.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filteredSupplier.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="carrier">
            Pārvadātāji
            {filteredCarrier.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {filteredCarrier.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Supplier payouts */}
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
                  description="Šim filtram nav atrasta neviena piegādātāja izmaksa."
                  className="py-16"
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
                    {filteredSupplier.map((p) => (
                      <SupplierRow
                        key={p.id}
                        payout={p}
                        token={token}
                        onDone={() => load(statusFilter)}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Carrier payouts */}
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
                  description="Šim filtram nav atrasta neviena pārvadātāja izmaksa."
                  className="py-16"
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
                    {filteredCarrier.map((p) => (
                      <CarrierRow
                        key={p.id}
                        payout={p}
                        token={token}
                        onDone={() => load(statusFilter)}
                      />
                    ))}
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
