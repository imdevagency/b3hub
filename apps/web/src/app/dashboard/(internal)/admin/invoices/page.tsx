'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Download,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetAllInvoices, type AdminInvoice } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  }).format(new Date(s));
}

const STATUS_LABEL: Record<string, string> = {
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

const STATUS_STYLE: Record<string, string> = {
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

const STATUS_ICON: Record<string, React.ElementType> = {
  PAID: CheckCircle2,
  OVERDUE: AlertCircle,
  FAILED: XCircle,
  CANCELLED: XCircle,
  PENDING: Clock,
  AUTHORIZED: Clock,
  CAPTURED: Clock,
  PARTIALLY_PAID: Clock,
  REFUNDED: CheckCircle2,
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

export default function AdminInvoicesPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

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
    if (!authLoading && token) load(page, statusFilter);
  }, [authLoading, token, page, statusFilter, load]);

  const visible = search.trim()
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          inv.buyerCompany?.name?.toLowerCase().includes(search.toLowerCase()) ||
          inv.sellerCompany?.name?.toLowerCase().includes(search.toLowerCase()) ||
          inv.order?.orderNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : invoices;

  // Aggregates
  const totalValue = invoices.reduce((s, i) => s + i.total, 0);
  const pendingCount = invoices.filter((i) =>
    ['PENDING', 'AUTHORIZED', 'CAPTURED'].includes(i.paymentStatus),
  ).length;
  const overdueCount = invoices.filter((i) => i.paymentStatus === 'OVERDUE').length;
  const paidValue = invoices
    .filter((i) => i.paymentStatus === 'PAID')
    .reduce((s, i) => s + i.total, 0);

  if (authLoading) return null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Rēķini" description={`${total} rēķini kopā platformā`} />

      {/* Stats */}
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
        </CardContent>
      </Card>

      {/* Table */}
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
              description="Šim filtrим nav atrasts neviens rēķins."
              className="py-16"
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
                {visible.map((inv) => {
                  const StatusIcon = STATUS_ICON[inv.paymentStatus] ?? Clock;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-sm">{inv.buyerCompany?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {inv.sellerCompany?.name ?? 'B3Hub'}
                      </TableCell>
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
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.paymentStatus] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_LABEL[inv.paymentStatus] ?? inv.paymentStatus}
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
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
