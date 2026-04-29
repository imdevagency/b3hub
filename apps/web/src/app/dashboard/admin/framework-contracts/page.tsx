'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FolderKanban, Search, CheckCircle2, Clock, FileX2, TrendingUp } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { adminGetAllFrameworkContracts, type AdminFrameworkContract } from '@/lib/api/admin';
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

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Intl.DateTimeFormat('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(s));
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Melnraksts',
  ACTIVE: 'Aktīvs',
  COMPLETED: 'Pabeigts',
  EXPIRED: 'Beidzies',
  CANCELLED: 'Atcelts',
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800',
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

function contractTotalValue(c: AdminFrameworkContract): number {
  return c.positions.reduce((sum, p) => sum + p.agreedQty * (p.unitPrice ?? 0), 0);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFrameworkContractsPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [contracts, setContracts] = useState<AdminFrameworkContract[]>([]);
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
        const res = await adminGetAllFrameworkContracts(
          token,
          p,
          50,
          status === 'ALL' ? undefined : status,
        );
        setContracts(res.data);
        setTotal(res.total);
      } catch {
        setContracts([]);
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
    ? contracts.filter(
        (c) =>
          c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.buyer?.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.supplier?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : contracts;

  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const totalValue = contracts.reduce((s, c) => s + contractTotalValue(c), 0);
  const fieldContracts = contracts.filter((c) => c.isFieldContract).length;
  const totalCallOffs = contracts.reduce((s, c) => s + c._count.callOffJobs, 0);

  if (authLoading) return null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Ietvarlīgumi" description={`${total} ietvarlīgumi kopā platformā`} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Aktīvie"
          value={String(activeCount)}
          icon={CheckCircle2}
          accent="text-emerald-600"
        />
        <StatCard label="Kopā vērtība" value={fmt(totalValue)} icon={TrendingUp} />
        <StatCard label="Lauka līgumi" value={String(fieldContracts)} icon={FolderKanban} />
        <StatCard label="Izdevumi (call-offs)" value={String(totalCallOffs)} icon={Clock} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Meklēt pēc numura, nosaukuma vai uzņēmuma..."
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
                <SelectItem value="DRAFT">Melnraksts</SelectItem>
                <SelectItem value="ACTIVE">Aktīvs</SelectItem>
                <SelectItem value="COMPLETED">Pabeigts</SelectItem>
                <SelectItem value="EXPIRED">Beidzies</SelectItem>
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
              icon={FileX2}
              title="Nav ietvarlīgumu"
              description="Šim filtram nav atrasts neviens ietvarlīgums."
              className="py-16"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr.</TableHead>
                  <TableHead>Nosaukums</TableHead>
                  <TableHead>Pircējs</TableHead>
                  <TableHead>Piegādātājs</TableHead>
                  <TableHead>Statuss</TableHead>
                  <TableHead className="text-right">Vērtība</TableHead>
                  <TableHead className="text-right">Call-offs</TableHead>
                  <TableHead>Sākums</TableHead>
                  <TableHead>Beigas</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {c.contractNumber}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <span className="truncate block text-sm">{c.title}</span>
                      {c.isFieldContract && (
                        <Badge variant="outline" className="text-xs mt-0.5">
                          B3 Field
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.buyer?.name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{c.supplier?.name ?? '—'}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-sm">
                      {fmt(contractTotalValue(c))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                      {c._count.callOffJobs}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(c.startDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtDate(c.endDate)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/framework-contracts/${c.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Skatīt
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 50 && !loading && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Lapa {page} · {total} ietvarlīgumi kopā
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
