'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Package, Phone, RefreshCw, Scale, X, Zap } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDate, fmtMoney } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status-config';
import { confirmOrder, cancelOrder, startLoadingOrder, sellerCancelOrder } from '@/lib/api';
import { markJobLoadingDock } from '@/lib/api/transport';
import { useMaterialOrders } from '@/hooks/use-material-orders';
import { QuickStat } from './quick-stat';
import { SurchargePanel } from './surcharge-panel';

export function SupplierView({ token }: { token: string }) {
  const { orders, setOrders, loading, reload } = useMaterialOrders(token);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    type: 'cancel' | 'startLoading' | 'sellerCancel';
  } | null>(null);
  const [weightInput, setWeightInput] = useState<Record<string, string>>({});
  const [weightPromptId, setWeightPromptId] = useState<string | null>(null);

  const handleConfirm = async (id: string) => {
    setActioning(id);
    setActionError(null);
    try {
      const updated = await confirmOrder(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Neizdevās apstiprināt pasūtījumu. Mēģiniet vēlreiz.',
      );
    } finally {
      setActioning(null);
    }
  };

  const handleCancel = async (id: string) => {
    setPendingAction(null);
    setActioning(id);
    setActionError(null);
    try {
      await cancelOrder(id, token);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu. Mēģiniet vēlreiz.',
      );
    } finally {
      setActioning(null);
    }
  };

  const handleStartLoading = async (id: string) => {
    setPendingAction(null);
    setWeightPromptId(null);
    setActioning(id);
    setActionError(null);
    try {
      const order = orders.find((o) => o.id === id);
      const weightKg = weightInput[id] ? parseFloat(weightInput[id]) : undefined;
      const tjId = order?.transportJobs?.[0]?.id;
      if (tjId) {
        try {
          await markJobLoadingDock(tjId, token, weightKg);
        } catch {
          // Non-fatal: proceed even if TJ update fails
        }
      }
      const updated = await startLoadingOrder(id, token, weightKg);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Neizdevās mainīt statusu. Mēģiniet vēlreiz.',
      );
    } finally {
      setActioning(null);
    }
  };

  const handleSellerCancel = async (id: string) => {
    setPendingAction(null);
    setActioning(id);
    setActionError(null);
    try {
      const updated = await sellerCancelOrder(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Neizdevās atcelt pasūtījumu. Mēģiniet vēlreiz.',
      );
    } finally {
      setActioning(null);
    }
  };

  const pending = orders.filter((o) => o.status === 'PENDING').length;
  const revenue = orders
    .filter((o) => !['PENDING', 'CANCELLED'].includes(o.status))
    .reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 py-2 mt-4">
        <QuickStat value={String(orders.length)} label="Kopā pasūtījumi" />
        <QuickStat value={String(pending)} label="Gaida apstiprinājumu" alert={pending > 0} />
        <QuickStat value={fmtMoney(revenue)} label="Kopā ieņēmumi" />
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="shrink-0 text-red-400 hover:text-red-600 font-medium"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nav ienākošu pasūtījumu"
          description="Kad pircēji veiks pasūtījumu, tas parādīsies šeit. Pārliecinieties, ka jūsu piedāvājumi ir aktīvi."
          action={
            <Link
              href="/dashboard/materials"
              className="inline-flex items-center gap-2 bg-foreground hover:opacity-90 text-background font-semibold rounded-full px-6 py-3 text-sm transition-all"
            >
              <Package className="h-4 w-4" />
              Pārvaldīt piedāvājumus
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>{orders.length} pasūtījumi</span>
            <span className="font-medium text-foreground">
              Kopā: {fmtMoney(orders.reduce((s, o) => s + o.total, 0))}
            </span>
          </div>
          {orders.map((order) => {
            const st = ORDER_STATUS[order.status] ?? {
              label: order.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const item = order.items?.[0];
            const busy = actioning === order.id;

            return (
              <div
                key={order.id}
                className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
              >
                {/* Header row */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                      #{order.orderNumber}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {fmtDate(order.createdAt)}
                    </span>
                  </div>
                  <div
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: st.bg, color: st.text }}
                  >
                    {st.label}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                  {/* Material Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="font-medium text-base">{item?.material?.name ?? '—'}</h3>
                      {item && (
                        <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                    </div>
                    {item?.material?.category && (
                      <p className="text-sm text-muted-foreground">{item.material.category}</p>
                    )}
                  </div>

                  {/* Route & Contact Timeline */}
                  <div className="flex-[1.5] space-y-4">
                    <div className="relative pl-6">
                      <div className="absolute left-2.75 top-2 -bottom-4 w-px bg-black/10" />

                      {/* Buyer */}
                      <div className="relative mb-4">
                        <div className="absolute -left-6 top-1.5 size-2 rounded-full bg-blue-500 ring-4 ring-white" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Pircējs</p>
                        {order.buyer ? (
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {order.buyer.firstName} {order.buyer.lastName}
                            </p>
                            {order.buyer.phone && (
                              <div
                                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `tel:${order.buyer?.phone}`;
                                }}
                              >
                                <Phone className="size-3.5" />
                                {order.buyer.phone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Delivery */}
                      <div className="relative">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          Piegāde • {fmtDate(order.deliveryDate)}
                        </p>
                        <p className="text-sm font-medium text-foreground pr-8">
                          {order.deliveryAddress || order.deliveryCity || '—'}
                        </p>
                        {order.siteContactPhone && (
                          <div
                            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mt-1 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${order.siteContactPhone}`;
                            }}
                          >
                            <Phone className="size-3.5" />
                            {order.siteContactName ?? 'Objekta'}, {order.siteContactPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Actions */}
                  <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-0">
                    <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1 mb-4">
                      <span className="text-sm text-muted-foreground sm:text-right">Summa</span>
                      <span className="text-lg font-bold tabular-nums">
                        {fmtMoney(order.total)}
                      </span>
                    </div>

                    {order.status === 'PENDING' && (
                      <div className="flex flex-col gap-2 mt-auto">
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            handleConfirm(order.id);
                          }}
                          className="flex items-center justify-center w-full gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="size-4" />
                          Apstiprināt
                        </button>
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            setPendingAction({ id: order.id, type: 'cancel' });
                          }}
                          className="flex items-center justify-center w-full gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <X className="size-4" />
                          Noraidīt
                        </button>
                      </div>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <div className="flex flex-col gap-2 mt-auto">
                        {weightPromptId === order.id ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                              <Scale className="size-3.5" /> Svars kraušanā (neobligāti)
                            </p>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="piem. 22000"
                                value={weightInput[order.id] ?? ''}
                                onChange={(e) =>
                                  setWeightInput((prev) => ({
                                    ...prev,
                                    [order.id]: e.target.value,
                                  }))
                                }
                                className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                              />
                              <span className="self-center text-xs text-muted-foreground">kg</span>
                            </div>
                            <button
                              disabled={busy}
                              onClick={(e) => {
                                e.preventDefault();
                                handleStartLoading(order.id);
                              }}
                              className="flex items-center justify-center w-full gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              <Zap className="size-4" />
                              Sākt iekraušanu
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setWeightPromptId(null);
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground text-center py-1"
                            >
                              Atcelt
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={(e) => {
                              e.preventDefault();
                              setWeightPromptId(order.id);
                            }}
                            className="flex items-center justify-center w-full gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            <Zap className="size-4" />
                            Sākt iekraušanu
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            setPendingAction({ id: order.id, type: 'sellerCancel' });
                          }}
                          className="flex items-center justify-center w-full gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <X className="size-4" />
                          Atcelt
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Surcharges panel — visible for confirmed/in-progress orders */}
                {['CONFIRMED', 'IN_PROGRESS', 'DELIVERED'].includes(order.status) && (
                  <SurchargePanel orderId={order.id} token={token} />
                )}

                {/* Inline confirmation prompt */}
                {pendingAction?.id === order.id && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                    <span className="font-medium">
                      {pendingAction.type === 'cancel'
                        ? 'Vai tiešām atcelt šo pasūtījumu?'
                        : 'Atcelt apstiprinātu pasūtījumu? Administrators tiks informēts.'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={busy}
                        onClick={(e) => {
                          e.preventDefault();
                          if (pendingAction.type === 'cancel') handleCancel(order.id);
                          else handleSellerCancel(order.id);
                        }}
                        className="rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 text-xs disabled:opacity-50 transition-colors"
                      >
                        Jā, atcelt
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setPendingAction(null);
                        }}
                        className="rounded-lg bg-white border border-amber-300 text-amber-800 font-semibold px-3 py-1.5 text-xs hover:bg-amber-100 transition-colors"
                      >
                        Atpakaļ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
