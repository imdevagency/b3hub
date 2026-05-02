/**
 * Admin RFQ page — /dashboard/admin/rfqs
 * Platform-wide view of all buyer quote requests and supplier responses.
 * Admin can monitor which RFQs are unanswered, see pricing competition,
 * and track the request → quote → order conversion funnel.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetQuoteRequests,
  type AdminQuoteRequest,
  type AdminQuoteRequestStatus,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, FileQuestion, Search, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AdminQuoteRequestStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  QUOTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-500',
  EXPIRED: 'bg-gray-100 text-gray-500',
};

const STATUS_LABELS: Record<AdminQuoteRequestStatus, string> = {
  PENDING: 'Gaida piedāvājumus',
  QUOTED: 'Saņemts piedāvājums',
  ACCEPTED: 'Apstiprināts',
  CANCELLED: 'Atcelts',
  EXPIRED: 'Beidzies',
};

const CATEGORY_LABELS: Record<string, string> = {
  AGGREGATES: 'Balasts/Smilts',
  CONCRETE: 'Betons',
  SOIL: 'Grunts',
  RECYCLED: 'Pārstrādāts',
  OTHER: 'Cits',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: AdminQuoteRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Status filter tabs ────────────────────────────────────────────────────────

const FILTERS: { label: string; value: AdminQuoteRequestStatus | 'ALL' }[] = [
  { label: 'Visi', value: 'ALL' },
  { label: 'Gaida', value: 'PENDING' },
  { label: 'Saņemts piedāvājums', value: 'QUOTED' },
  { label: 'Apstiprināts', value: 'ACCEPTED' },
  { label: 'Atcelts', value: 'CANCELLED' },
];

// ─── Response detail dialog ────────────────────────────────────────────────────

function ResponsesDialog({ rfq, onClose }: { rfq: AdminQuoteRequest; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {rfq.requestNumber} — piedāvājumi ({rfq.responses.length})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {rfq.responses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nav saņemtu piedāvājumu
            </p>
          ) : (
            rfq.responses.map((r) => (
              <div
                key={r.id}
                className="border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-sm">{r.supplier.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(r.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">
                    €{r.pricePerUnit.toFixed(2)}/{r.unit} · €{r.totalPrice.toFixed(2)} kopā
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === 'ACCEPTED'
                        ? 'bg-green-100 text-green-700'
                        : r.status === 'REJECTED'
                          ? 'bg-red-100 text-red-500'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRfqsPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [rows, setRows] = useState<AdminQuoteRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AdminQuoteRequestStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<AdminQuoteRequest | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminGetQuoteRequests(token, 1, 200, filter !== 'ALL' ? filter : undefined);
      setRows(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const filtered = search.trim()
    ? rows.filter((r) => {
        const q = search.toLowerCase();
        return (
          r.requestNumber.toLowerCase().includes(q) ||
          r.materialName.toLowerCase().includes(q) ||
          r.deliveryCity.toLowerCase().includes(q) ||
          `${r.buyer.firstName} ${r.buyer.lastName}`.toLowerCase().includes(q) ||
          r.buyer.email.toLowerCase().includes(q)
        );
      })
    : rows;

  // stats
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const noResponses = rows.filter((r) => r.status === 'PENDING' && r.responses.length === 0).length;
  const accepted = rows.filter((r) => r.status === 'ACCEPTED').length;
  const avgResponses =
    rows.length > 0
      ? (rows.reduce((s, r) => s + r.responses.length, 0) / rows.length).toFixed(1)
      : '0';

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ / Cenu pieprasījumi"
        description="Visi pircēju cenu pieprasījumi — redziet konkurenci, vidējo atbildju skaitu un konversiju."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Kopā', value: total, color: 'text-foreground' },
          { label: 'Gaida (bez piedāv.)', value: noResponses, color: 'text-red-500' },
          { label: 'Aktīvi', value: pending, color: 'text-yellow-600' },
          { label: 'Apstiprināti', value: accepted, color: 'text-green-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Avg responses callout */}
      <p className="text-sm text-muted-foreground">
        Vidēji <span className="font-semibold text-foreground">{avgResponses}</span> piedāvājumu uz
        vienu pieprasījumu
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:border-foreground/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Meklēt numuru, materiālu, pilsētu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm w-64"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="Nav cenu pieprasījumu"
          description="Pircēji var sūtīt RFQ no mobilās lietotnes vai web portāla."
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numurs</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead>Materiāls</TableHead>
                <TableHead>Pircējs</TableHead>
                <TableHead>Pilsēta</TableHead>
                <TableHead className="text-right">Piedāvājumi</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead>Datums</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const lowestPrice =
                  row.responses.length > 0
                    ? Math.min(...row.responses.map((r) => r.totalPrice))
                    : null;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.requestNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[row.materialCategory] ?? row.materialCategory}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{row.materialName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.quantity} {row.unit}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {row.buyer.firstName} {row.buyer.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.buyer.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{row.deliveryCity}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span
                          className={`text-sm font-semibold ${
                            row.responses.length === 0 && row.status === 'PENDING'
                              ? 'text-red-500'
                              : 'text-foreground'
                          }`}
                        >
                          {row.responses.length}
                        </span>
                        {lowestPrice !== null && (
                          <span className="text-xs text-muted-foreground">
                            no €{lowestPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmt(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setDetail(row)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {detail && <ResponsesDialog rfq={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
