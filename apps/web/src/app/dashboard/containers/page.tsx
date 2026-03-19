/**
 * Containers page — /dashboard/containers
 * Buyer view: list of container rental orders with status tracking.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Calendar, MapPin, Package, Truck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getMyContainerOrders, type ApiContainerOrder, type ContainerOrderStatus } from '@/lib/api';

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<
  ContainerOrderStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  PENDING: {
    label: 'Gaida apstiprinājumu',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  CONFIRMED: {
    label: 'Apstiprināts',
    variant: 'default',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  DELIVERED: {
    label: 'Piegādāts',
    variant: 'default',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  AWAITING_PICKUP: {
    label: 'Gaida savākšanu',
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  COLLECTED: {
    label: 'Savākts',
    variant: 'secondary',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  COMPLETED: {
    label: 'Pabeigts',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

const CONTAINER_TYPE_LV: Record<string, string> = {
  SKIP: 'Pašizkraujošais',
  ROLL_OFF: 'Ritošais',
  COMPACTOR: 'Kompaktors',
  HOOKLOADER: 'Āķa kraušanas',
  FLATBED: 'Platforma',
};

const SIZE_LV: Record<string, string> = {
  SMALL: 'Mazs',
  MEDIUM: 'Vidējs',
  LARGE: 'Liels',
  EXTRA_LARGE: 'Īpaši liels',
};

const ALL_STATUSES = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'DELIVERED',
  'AWAITING_PICKUP',
  'COMPLETED',
  'CANCELLED',
] as const;
type FilterStatus = (typeof ALL_STATUSES)[number];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function euro(v: number) {
  return `€${v.toFixed(2)}`;
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: ApiContainerOrder }) {
  const status = STATUS_MAP[order.status] ?? {
    label: order.status,
    variant: 'secondary' as const,
    className: '',
  };

  return (
    <Card className="shadow-none border-border/60 hover:border-border transition-colors">
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {/* Left: container info */}
          <div className="flex items-start gap-4 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">
                  {CONTAINER_TYPE_LV[order.container.containerType] ??
                    order.container.containerType}
                </span>
                <span className="text-xs text-muted-foreground">
                  {SIZE_LV[order.container.size] ?? order.container.size} · {order.container.volume}{' '}
                  m³
                </span>
                <Badge className={`text-xs font-medium border ${status.className}`}>
                  {status.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {order.deliveryCity}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {order.rentalDays} dienas
                </span>
                {order.deliveryDate && (
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    Piegāde: {fmtDate(order.deliveryDate)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{order.deliveryAddress}</p>
            </div>
          </div>

          {/* Right: price + dates */}
          <div className="flex flex-row sm:flex-col items-end gap-3 sm:text-right shrink-0">
            <span className="text-lg font-bold tabular-nums">{euro(order.totalPrice)}</span>
            <span className="text-xs text-muted-foreground">
              Pasūtīts: {fmtDate(order.createdAt)}
            </span>
          </div>
        </div>

        {order.notes && (
          <p className="mt-3 text-xs text-muted-foreground border-t border-border/40 pt-3">
            {order.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContainersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<ApiContainerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMyContainerOrders(token);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);

  const statusLabel: Record<FilterStatus, string> = {
    ALL: 'Visi',
    PENDING: 'Gaida',
    CONFIRMED: 'Apstiprināts',
    DELIVERED: 'Piegādāts',
    AWAITING_PICKUP: 'Savākšana',
    COMPLETED: 'Pabeigts',
    CANCELLED: 'Atcelts',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Konteineri"
        description="Jūsu konteineru nomas pasūtījumi un statuss"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atjaunot
            </Button>
            <Button size="sm" asChild>
              <a href="/dashboard/order/skip-hire">
                <Box className="h-3.5 w-3.5 mr-1.5" />
                Pasūtīt konteineru
              </a>
            </Button>
          </div>
        }
      />

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {statusLabel[s]}
            {s !== 'ALL' && orders.filter((o) => o.status === s).length > 0 && (
              <span className="ml-1.5 tabular-nums">
                {orders.filter((o) => o.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Box}
          title={
            filter === 'ALL' ? 'Nav konteineru nomas pasūtījumu' : 'Nav pasūtījumu ar šo statusu'
          }
          description={
            filter === 'ALL'
              ? 'Pasūtiet konteineru atkritumu izvešanai vai celtniecības darbiem'
              : undefined
          }
          action={
            filter === 'ALL' ? (
              <Button asChild>
                <a href="/dashboard/order/skip-hire">
                  <Box className="h-4 w-4 mr-1.5" />
                  Pasūtīt konteineru
                </a>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
