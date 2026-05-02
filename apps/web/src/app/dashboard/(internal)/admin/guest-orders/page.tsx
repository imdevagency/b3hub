/**
 * Admin guest orders page — /dashboard/admin/guest-orders
 * View and manage guest (non-authenticated) orders. Admin can:
 *  - Set a quoted price (which lets the guest proceed to payment)
 *  - Update status manually (e.g. mark as CANCELLED)
 * Guest orders are created via the public B2C wizards.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetGuestOrders,
  adminSetGuestQuote,
  adminUpdateGuestStatus,
  type AdminGuestOrder,
  type GuestOrderStatus,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, UserCheck, Search, Euro, CheckCircle2, XCircle } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<GuestOrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  QUOTED: 'bg-blue-100 text-blue-700',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-700',
  PAID: 'bg-green-100 text-green-700',
  CONVERTED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-500',
};

const STATUS_LABELS: Record<GuestOrderStatus, string> = {
  PENDING: 'Gaida',
  QUOTED: 'Cena nosūtīta',
  AWAITING_PAYMENT: 'Gaida maksājumu',
  PAID: 'Apmaksāts',
  CONVERTED: 'Pārveidots',
  CANCELLED: 'Atcelts',
};

const CATEGORY_LABELS: Record<string, string> = {
  MATERIAL: 'Materiāls',
  SKIP_HIRE: 'Skip noma',
  TRANSPORT: 'Transports',
  DISPOSAL: 'Utilizācija',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: GuestOrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Status filter tabs ────────────────────────────────────────────────────────

const FILTERS: { label: string; value: GuestOrderStatus | 'ALL' }[] = [
  { label: 'Visi', value: 'ALL' },
  { label: 'Gaida', value: 'PENDING' },
  { label: 'Cena nosūtīta', value: 'QUOTED' },
  { label: 'Gaida maksājumu', value: 'AWAITING_PAYMENT' },
  { label: 'Apmaksāts', value: 'PAID' },
  { label: 'Atcelts', value: 'CANCELLED' },
];

// ─── Quote dialog ─────────────────────────────────────────────────────────────

function QuoteDialog({
  order,
  token,
  onClose,
  onSaved,
}: {
  order: AdminGuestOrder;
  token: string;
  onClose: () => void;
  onSaved: (updated: AdminGuestOrder) => void;
}) {
  const [amount, setAmount] = useState(
    order.quotedAmount != null ? String(order.quotedAmount) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Ievadiet derīgu summu');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const updated = await adminSetGuestQuote(order.id, val, token);
      onSaved(updated);
    } catch {
      setError('Kļūda saglabājot cenu');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Noteikt cenu — {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Viesis saņems e-pasta saiti apmaksai pēc cenas saglabāšanas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Kontakts:</span> {order.contactName} —{' '}
            {order.contactPhone}
            {order.contactEmail && ` / ${order.contactEmail}`}
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Piegāde:</span> {order.deliveryCity},{' '}
            {order.deliveryAddress}
            {order.materialName && (
              <>
                {' '}
                — {order.materialName}{' '}
                {order.quantity != null ? `${order.quantity} ${order.unit ?? ''}` : ''}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium w-20">Cena (€)</span>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="max-w-[160px]"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Atcelt
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saglabā...' : 'Saglabāt cenu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGuestOrdersPage() {
  const { token: rawToken, isLoading: authLoading } = useAuth();
  const token = rawToken ?? '';

  const [rows, setRows] = useState<AdminGuestOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GuestOrderStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [quoting, setQuoting] = useState<AdminGuestOrder | null>(null);
  const [cancelling, setCancelling] = useState<AdminGuestOrder | null>(null);
  const [busyCancel, setBusyCancel] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminGetGuestOrders(token, filter !== 'ALL' ? filter : undefined);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const filtered = search.trim()
    ? rows.filter(
        (r) =>
          r.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
          r.contactName.toLowerCase().includes(search.toLowerCase()) ||
          r.contactPhone.includes(search) ||
          (r.contactEmail ?? '').toLowerCase().includes(search.toLowerCase()) ||
          r.deliveryCity.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  async function cancel(order: AdminGuestOrder) {
    setBusyCancel(true);
    try {
      const updated = await adminUpdateGuestStatus(order.id, 'CANCELLED', token);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setCancelling(null);
    } finally {
      setBusyCancel(false);
    }
  }

  // ── stats ────
  const pending = rows.filter((r) => r.status === 'PENDING').length;
  const paid = rows.filter((r) => r.status === 'PAID').length;
  const converted = rows.filter((r) => r.status === 'CONVERTED').length;

  if (authLoading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Viesa pieprasījumi"
        description="Pasūtījumi no neautentificētiem B2C klientiem — nosūtiet cenu, pieņemiet maksājumu."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Gaida cenu', value: pending, color: 'text-yellow-600' },
          { label: 'Apmaksāti', value: paid, color: 'text-green-600' },
          { label: 'Pārveidoti', value: converted, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
            placeholder="Meklēt vārdu, tālruni, pilsētu..."
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
          icon={UserCheck}
          title="Nav viesa pieprasījumu"
          description="B2C pieprasījumi parādīsies šeit pēc viesa formas aizpildīšanas."
        />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numurs</TableHead>
                <TableHead>Kategorija</TableHead>
                <TableHead>Kontakts</TableHead>
                <TableHead>Pilsēta</TableHead>
                <TableHead>Datums</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Cena</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.orderNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[row.category] ?? row.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{row.contactName}</p>
                    <p className="text-xs text-muted-foreground">{row.contactPhone}</p>
                    {row.contactEmail && (
                      <p className="text-xs text-muted-foreground">{row.contactEmail}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{row.deliveryCity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.quotedAmount != null ? (
                      <span className="font-semibold text-sm">€{row.quotedAmount.toFixed(2)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {(row.status === 'PENDING' || row.status === 'QUOTED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setQuoting(row)}
                        >
                          <Euro className="h-3 w-3 mr-1" />
                          Cena
                        </Button>
                      )}
                      {row.status === 'CONVERTED' && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Konvertēts
                        </span>
                      )}
                      {!['CANCELLED', 'CONVERTED', 'PAID'].includes(row.status) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setCancelling(row)}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Quote dialog */}
      {quoting && (
        <QuoteDialog
          order={quoting}
          token={token}
          onClose={() => setQuoting(null)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setQuoting(null);
          }}
        />
      )}

      {/* Cancel confirmation */}
      {cancelling && (
        <Dialog open onOpenChange={(o) => !o && setCancelling(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atcelt pieprasījumu?</DialogTitle>
              <DialogDescription>
                {cancelling.orderNumber} — {cancelling.contactName} ({cancelling.contactPhone})
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelling(null)} disabled={busyCancel}>
                Aizvērt
              </Button>
              <Button
                variant="destructive"
                onClick={() => cancel(cancelling)}
                disabled={busyCancel}
              >
                {busyCancel ? 'Atceļ...' : 'Atcelt pieprasījumu'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
