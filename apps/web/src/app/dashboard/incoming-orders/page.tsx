/**
 * Incoming Orders — /dashboard/incoming-orders
 * Dedicated supplier view for managing orders placed by buyers.
 * Also handles recycler companies who receive incoming disposal orders.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { getMyOrders, confirmOrder, cancelOrder, type ApiOrder } from '@/lib/api/orders';
import { SupplierView } from '../orders/page';
import { Recycle, MapPin, CalendarDays, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status-config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ── Disposal orders view for recycler companies ───────────────────────────────

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons / Bruģis',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koks',
  METAL: 'Metāli',
  PLASTIC: 'Plastmasa',
  SOIL: 'Grunts / Smiltis',
  MIXED: 'Jaukti atkritumi',
  HAZARDOUS: 'Bīstamie atkritumi',
};

function DisposalIncomingView({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getMyOrders(token);
      setOrders(all.filter((o) => o.orderType === 'DISPOSAL'));
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (id: string) => {
    setActioning(id);
    setActionError(null);
    try {
      const updated = await confirmOrder(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Kļūda');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Noraidīt šo utilizācijas pasūtījumu?')) return;
    setActioning(id);
    setActionError(null);
    try {
      await cancelOrder(id, token);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Kļūda');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Recycle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Nav jaunu utilizācijas pasūtījumu</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <div className="rounded-xl bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {actionError}
        </div>
      )}
      {orders.map((order) => {
        const statusMeta = ORDER_STATUS[order.status] ?? {
          label: order.status,
          color: 'bg-muted text-muted-foreground',
        };
        const isPending = order.status === 'PENDING';
        const wasteLabel = (order as ApiOrder & { wasteType?: string }).wasteType
          ? (WASTE_TYPE_LABELS[(order as ApiOrder & { wasteType?: string }).wasteType!] ??
            (order as ApiOrder & { wasteType?: string }).wasteType)
          : null;
        return (
          <div
            key={order.id}
            className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">#{order.orderNumber}</span>
                {wasteLabel && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{wasteLabel}</span>
                )}
                <Badge className={`text-[10px] px-2 h-4 ${statusMeta.color}`}>
                  {statusMeta.label}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {order.deliveryAddress}
                  {order.deliveryCity ? `, ${order.deliveryCity}` : ''}
                </span>
                {order.deliveryDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {fmtDate(order.deliveryDate)}
                  </span>
                )}
              </div>
              {order.buyer && (
                <p className="text-xs text-muted-foreground">
                  {order.buyer.firstName} {order.buyer.lastName}
                  {order.buyer.phone ? ` · ${order.buyer.phone}` : ''}
                </p>
              )}
            </div>
            {isPending && (
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={actioning === order.id}
                  onClick={() => handleReject(order.id)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Noraidīt
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={actioning === order.id}
                  onClick={() => handleConfirm(order.id)}
                >
                  {actioning === order.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Apstiprināt
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IncomingOrdersPage() {
  const { token, user, isLoading } = useRequireAuth();
  const router = useRouter();

  const isRecycler = user?.company?.companyType === 'RECYCLER';
  const isSeller = !!user?.canSell;
  const hasAccess = isSeller || isRecycler;

  const [tab, setTab] = useState<'material' | 'disposal'>('material');
  // Recycler-only users default to the disposal tab (derived, no effect needed)
  const effectiveTab: 'material' | 'disposal' = isRecycler && !isSeller ? 'disposal' : tab;

  useEffect(() => {
    if (!isLoading && user && !hasAccess) router.replace('/dashboard');
  }, [user, isLoading, hasAccess, router]);

  if (!token || (user && !hasAccess)) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  return (
    <div className="w-full h-full pb-20 space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ienākošie Pasūtījumi</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">
          Pilna pārredzamība — pircēji, materiāli, piegādes datumi, kontakti
        </p>
      </div>

      {/* Tabs — only shown when user has both roles */}
      {isSeller && isRecycler && (
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('material')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              effectiveTab === 'material'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Materiāli
          </button>
          <button
            onClick={() => setTab('disposal')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              effectiveTab === 'disposal'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Utilizācija
          </button>
        </div>
      )}

      {effectiveTab === 'material' && isSeller && <SupplierView token={token} />}
      {effectiveTab === 'disposal' && isRecycler && token && <DisposalIncomingView token={token} />}
    </div>
  );
}
