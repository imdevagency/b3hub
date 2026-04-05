/**
 * Orders list page — /dashboard/orders
 * Shows the current user's material purchase orders with status filters.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  ORDER_STATUS,
  JOB_STATUS,
  SKIP_STATUS,
  SKIP_SIZE_LABEL,
  StatusBadgeHex,
} from '@/lib/status-config';
import {
  confirmOrder,
  cancelOrder,
  startLoadingOrder,
  sellerCancelOrder,
  getOrder,
  addOrderSurcharge,
  removeOrderSurcharge,
} from '@/lib/api';
import type { ApiOrderSurcharge, SurchargeType } from '@/lib/api';
import { useTransportJobs } from '@/hooks/use-transport-jobs';
import { useMaterialOrders } from '@/hooks/use-material-orders';
import { useBuyerOrders } from '@/hooks/use-buyer-orders';
import { useMode } from '@/lib/mode-context';
import {
  ArrowRight,
  CheckCircle,
  Link2,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react';

// ── Order-again helpers ───────────────────────────────────────────────────────

function skipSizeToWizardId(size: string): string {
  return size.toLowerCase(); // MINI→mini, MIDI→midi, BUILDERS→builders, LARGE→large
}

function wasteCategoryToWizardId(cat: string): string {
  const map: Record<string, string> = {
    MIXED: 'mixed',
    GREEN_GARDEN: 'green',
    CONCRETE_RUBBLE: 'rubble',
    WOOD: 'wood',
    METAL_SCRAP: 'metal',
    ELECTRONICS_WEEE: 'electronics',
  };
  return map[cat] ?? 'mixed';
}

function QuickStat({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  return (
    <div
      className={`p-4 rounded-2xl ${alert ? 'bg-red-50 text-red-900 border border-red-100' : 'bg-muted/30 border border-transparent'} flex flex-col justify-center`}
    >
      <span
        className={`text-xs font-semibold uppercase tracking-wider mb-1 ${alert ? 'text-red-700' : 'text-muted-foreground'}`}
      >
        {label}
      </span>
      <span className={`text-2xl font-bold tracking-tight ${alert ? '' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

// ── Carrier history ───────────────────────────────────────────────────────────

// ActiveJobTab removed — drivers manage active jobs exclusively in the mobile app.

function CarrierHistoryView({ token }: { token: string }) {
  const { jobs, loading, reload } = useTransportJobs(token);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const ACTIVE = [
    'ACCEPTED',
    'EN_ROUTE_PICKUP',
    'AT_PICKUP',
    'LOADED',
    'EN_ROUTE_DELIVERY',
    'AT_DELIVERY',
  ];

  const filtered = jobs.filter((j) => {
    if (filter === 'active') return ACTIVE.includes(j.status);
    if (filter === 'done') return j.status === 'DELIVERED';
    return true;
  });

  const totalTonnes = filtered
    .filter((j) => ACTIVE.includes(j.status))
    .reduce((s, j) => s + (j.cargoWeight ?? 0) / 1000, 0);

  const totalEarnings = filtered
    .filter((j) => j.status === 'DELIVERED')
    .reduce((s, j) => s + (j.rate ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
        <QuickStat value={String(jobs.length)} label="Kopā darbi" />
        <QuickStat
          value={String(jobs.filter((j) => ACTIVE.includes(j.status)).length)}
          label="Aktīvie"
        />
        <QuickStat value={`${totalTonnes.toFixed(1)} t`} label="Tonnas tranzītā" />
        <QuickStat value={fmtMoney(totalEarnings)} label="Nopelnīts" />
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {f === 'all' ? 'Visi' : f === 'active' ? 'Aktīvie' : 'Pabeigti'}
            </button>
          ))}
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-muted/40 hover:bg-muted/80 px-4 py-2 text-sm font-medium text-foreground transition-colors border-0"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Truck className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">Nav neviena darba</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Vēl neesat pieņēmuši nevienu darbu. Atveriet darbu dēli, lai atrastu un pieņemtu
              jaunus kravu pārvadāšanas darbus.
            </p>
          </div>
          <Link
            href="/dashboard/jobs"
            className="mt-2 inline-flex items-center gap-2 bg-black hover:bg-gray-800 text-white font-semibold rounded-full px-6 py-3 text-sm transition-all"
          >
            <Search className="h-4 w-4" />
            Meklēt darbus
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Truck className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav darbu šajā kategorijā</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((job) => {
            const st = JOB_STATUS[job.status] ?? {
              label: job.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const weightTStr = job.cargoWeight ? `${(job.cargoWeight / 1000).toFixed(2)} t` : '—';
            return (
              <Link
                key={job.id}
                href={`/dashboard/transport-jobs/${job.id}`}
                className="group block relative bg-background border border-border/50 rounded-2xl p-5 mb-3 hover:bg-muted/30 transition-all duration-300"
              >
                {/* Meta Top Row */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <p className="font-mono font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
                        #{job.jobNumber}
                      </p>
                      <StatusBadgeHex cfg={st} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-foreground">
                      {fmtMoney(job.rate ?? 0)}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-sm text-muted-foreground font-medium">
                      <span>{job.cargoType}</span>
                      <span>•</span>
                      <span>{weightTStr}</span>
                      {job.distanceKm && (
                        <>
                          <span>•</span>
                          <span>{job.distanceKm} km</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Route */}
                <div className="flex items-start bg-muted/20 rounded-xl p-3 border border-transparent group-hover:border-border/50">
                  <div className="flex flex-col items-center mr-3 mt-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary z-10 shrink-0" />
                    <div className="w-px h-5 bg-border my-0.5 shrink-0" />
                    <div className="w-2 h-2 rounded-[1px] bg-black z-10 shrink-0" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold leading-none">{job.pickupCity}</p>
                      <span className="text-xs font-medium text-muted-foreground">
                        {fmtDate(job.pickupDate)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-none text-muted-foreground">
                      {job.deliveryCity}
                    </p>
                  </div>
                </div>

                {/* Vehicle & assignment footer */}
                {job.vehicle && (
                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                    <div className="flex items-center gap-2">
                      <Truck className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-foreground">
                        {job.vehicle.licensePlate}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] font-bold text-black uppercase tracking-wider group-hover:underline">
                      Skatīt
                      <ArrowRight className="size-3" />
                    </div>
                  </div>
                )}
                {!job.vehicle && (
                  <div className="mt-4 flex items-center justify-end border-t border-border/40 pt-3">
                    <div className="flex items-center gap-1 text-[12px] font-bold text-black uppercase tracking-wider group-hover:underline">
                      Skatīt
                      <ArrowRight className="size-3" />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CarrierView({ token }: { token: string }) {
  return <CarrierHistoryView token={token} />;
}

// ── Surcharge type labels (Latvian) ────────────────────────────────────────────
const SURCHARGE_LABELS: Record<SurchargeType, string> = {
  FUEL: 'Degvielas piemaksa',
  WAITING_TIME: 'Gaidīšanas laiks',
  WEEKEND: 'Nedēļas nogale',
  OVERWEIGHT: 'Pārslogots',
  NARROW_ACCESS: 'Šaura pieeja',
  REMOTE_AREA: 'Attālināta zona',
  TOLL: 'Ceļa nodeva',
  OTHER: 'Cits',
};

interface SurchargePanelProps {
  orderId: string;
  token: string;
  initialSurcharges?: ApiOrderSurcharge[];
}

function SurchargePanel({ orderId, token, initialSurcharges }: SurchargePanelProps) {
  const [surcharges, setSurcharges] = useState<ApiOrderSurcharge[]>(initialSurcharges ?? []);
  const [loading, setLoading] = useState(!initialSurcharges);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<SurchargeType>('FUEL');
  const [formLabel, setFormLabel] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch surcharges on first render if not provided
  useState(() => {
    if (initialSurcharges) return;
    getOrder(orderId, token)
      .then((o) => setSurcharges(o.surcharges ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  });

  const handleAdd = async () => {
    const amount = parseFloat(formAmount);
    if (!formLabel.trim() || isNaN(amount) || amount <= 0) {
      setFormError('Lūdzu aizpildiet visus laukus.');
      return;
    }
    setAdding(true);
    setFormError(null);
    try {
      const created = await addOrderSurcharge(
        orderId,
        { type: formType, label: formLabel.trim(), amount },
        token,
      );
      setSurcharges((prev) => [...prev, created]);
      setFormLabel('');
      setFormAmount('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kļūda pievienojot piemaksu');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (surchargeId: string) => {
    setRemoving(surchargeId);
    try {
      await removeOrderSurcharge(orderId, surchargeId, token);
      setSurcharges((prev) => prev.filter((s) => s.id !== surchargeId));
    } catch {
      // silently ignore
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground py-2">Ielādē piemaksas…</p>;
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Zap className="size-3" /> Piemaksas
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="size-3" /> Pievienot
        </button>
      </div>

      {surcharges.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground italic">Nav piemaksu</p>
      )}

      {surcharges.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {s.label}{' '}
            <span className="text-xs opacity-60">({SURCHARGE_LABELS[s.type] ?? s.type})</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{fmtMoney(s.amount)}</span>
            <button
              disabled={removing === s.id}
              onClick={() => handleRemove(s.id)}
              className="text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="rounded-xl bg-muted/50 p-3 space-y-2">
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value as SurchargeType)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            {(Object.keys(SURCHARGE_LABELS) as SurchargeType[]).map((t) => (
              <option key={t} value={t}>
                {SURCHARGE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Apraksts (piem. Degviela 10%)"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            type="number"
            placeholder="Summa (EUR)"
            min="0"
            step="0.01"
            value={formAmount}
            onChange={(e) => setFormAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Atcelt
            </button>
            <button
              disabled={adding}
              onClick={handleAdd}
              className="rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Saglabā…' : 'Saglabāt'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUPPLIER view ──────────────────────────────────────────────────────────────

function SupplierView({ token }: { token: string }) {
  const { orders, setOrders, loading, reload } = useMaterialOrders(token);
  const [actioning, setActioning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    if (!confirm('Vai atcelt šo pasūtījumu?')) return;
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
    if (!confirm('Atzīmēt kā iekraušanā?')) return;
    setActioning(id);
    setActionError(null);
    try {
      const updated = await startLoadingOrder(id, token);
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
    if (!confirm('Atcelt apstiprinātu pasūtījumu? Administrators tiks informēts.')) return;
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
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
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">Nav ienākošu pasūtījumu</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Kad pircēji veiks pasūtījumu, tas parādīsies šeit. Pārliecinieties, ka jūsu
              piedāvājumi ir aktīvi.
            </p>
          </div>
          <Link
            href="/dashboard/materials"
            className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
          >
            <Package className="h-4 w-4" />
            Pārvaldīt piedāvājumus
          </Link>
        </div>
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
                            handleCancel(order.id);
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
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSellerCancel(order.id);
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── BUYER view ─────────────────────────────────────────────────────────────────

function BuyerView({ token }: { token: string }) {
  const [tab, setTab] = useState<'skip' | 'material' | 'transport'>('skip');
  const { skipOrders, matOrders, transportRequests, loading, reload } = useBuyerOrders(token);

  const totalSpent =
    skipOrders.reduce((s, o) => s + o.price, 0) + matOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 mt-4">
        <QuickStat value={String(skipOrders.length)} label="Konteineri" />
        <QuickStat value={String(matOrders.length)} label="Materiāli" />
        <QuickStat value={String(transportRequests.length)} label="Transports" />
        <QuickStat value={fmtMoney(totalSpent)} label="Kopā iztērēts" />
      </div>

      {/* Tabs + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          {[
            { key: 'skip', label: `Konteineri (${skipOrders.length})` },
            { key: 'material', label: `Materiāli (${matOrders.length})` },
            { key: 'transport', label: `Transports (${transportRequests.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'skip' | 'material' | 'transport')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
      ) : tab === 'skip' ? (
        /* Skip-hire table */
        skipOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
              <Trash2 className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-foreground">Nav konteineru pasūtījumu</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Jums vēl nav neviena konteinera nomas pasūtījuma. Pasūtiet konteineru atkritumu
                izvešanai.
              </p>
            </div>
            <Link
              href="/dashboard/order/skip-hire"
              className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
            >
              <Trash2 className="h-4 w-4" />
              Pasūtīt konteineru
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{skipOrders.length} konteineri</span>
            </div>
            {skipOrders.map((o) => {
              const st = SKIP_STATUS[o.status] ?? {
                label: o.status,
                bg: '#f3f4f6',
                text: '#374151',
              };
              return (
                <div
                  key={o.id}
                  className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                        #{o.orderNumber}
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
                    {/* Skip Info */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline justify-between mb-2">
                        <h3 className="font-medium text-base">
                          {SKIP_SIZE_LABEL[o.skipSize] ?? o.skipSize}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {o.wasteCategory.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    </div>

                    {/* Timeline */}
                    <div className="flex-[1.5] space-y-4">
                      <div className="relative pl-6">
                        <div className="absolute left-2.75 top-2 bottom-2 w-px bg-black/10" />

                        {/* Delivery */}
                        <div className="relative">
                          <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">
                            Adrese • {fmtDate(o.deliveryDate)}
                          </p>
                          <p className="text-sm font-medium text-foreground pr-8">
                            {o.location || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financials + Order again */}
                    <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-0 gap-3">
                      <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
                        <span className="text-sm text-muted-foreground sm:text-right">Cena</span>
                        <div className="text-lg font-bold tabular-nums">
                          €{o.price}{' '}
                          <span className="text-sm font-normal text-muted-foreground">
                            {o.currency}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/dashboard/order/skip-hire?size=${skipSizeToWizardId(o.skipSize)}&waste=${wasteCategoryToWizardId(o.wasteCategory)}`}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground transition-colors"
                      >
                        <RotateCcw className="size-3" />
                        Pasūtīt vēlreiz
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : /* Material orders table */
      matOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-bold text-foreground">Nav materiālu pasūtījumu</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Jums vēl nav neviena materiālu pasūtījuma. Apskatiet piedāvājumus un pasūtiet
              nepieciešamos materiālus.
            </p>
          </div>
          <Link
            href="/dashboard/materials"
            className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
          >
            <Search className="h-4 w-4" />
            Meklēt materiālus
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>{matOrders.length} pasūtījumi</span>
          </div>
          {matOrders.map((o) => {
            const st = ORDER_STATUS[o.status] ?? {
              label: o.status,
              bg: '#f3f4f6',
              text: '#374151',
            };
            const item = o.items?.[0];
            return (
              <Link
                href={`/dashboard/orders/${o.id}`}
                key={o.id}
                className="group block relative bg-muted/30 rounded-3xl p-6 mb-4 hover:bg-muted/50 transition-all duration-300"
              >
                {/* Header row */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                      #{o.orderNumber}
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
                  </div>

                  {/* Timeline */}
                  <div className="flex-[1.5] space-y-4">
                    <div className="relative pl-6">
                      <div className="absolute left-2.75 top-2 bottom-2 w-px bg-black/10" />

                      {/* Delivery */}
                      <div className="relative">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          Adrese • {fmtDate(o.deliveryDate)}
                        </p>
                        <p className="text-sm font-medium text-foreground pr-8">
                          {o.deliveryAddress || o.deliveryCity || '—'}
                        </p>
                        {(() => {
                          const driver = o.transportJobs?.find(
                            (j) =>
                              j.status === 'EN_ROUTE_DELIVERY' ||
                              j.status === 'AT_DELIVERY' ||
                              j.status === 'LOADED',
                          )?.driver;
                          if (!driver) return null;
                          return (
                            <div className="mt-2 flex items-center gap-1.5">
                              <User className="size-3 text-blue-500 shrink-0" />
                              <span className="text-xs text-blue-700 font-medium">
                                {driver.firstName} {driver.lastName}
                              </span>
                              {driver.phone && (
                                <a
                                  href={`tel:${driver.phone}`}
                                  className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="size-3" />
                                  Zvanīt
                                </a>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="flex-1 flex flex-col justify-between pt-4 sm:pt-0">
                    <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end gap-1">
                      <span className="text-sm text-muted-foreground sm:text-right">Summa</span>
                      <div className="text-lg font-bold tabular-nums">{fmtMoney(o.total)}</div>
                    </div>
                  </div>
                </div>

                {/* Linked skip order badge */}
                {o.linkedSkipOrder && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <Link
                      href={`/dashboard/order/skip-hire?linkedOrderId=${o.linkedSkipOrder.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className="size-3" />
                      Konteiners #{o.linkedSkipOrder.orderNumber} ·{' '}
                      {SKIP_SIZE_LABEL[o.linkedSkipOrder.skipSize] ?? o.linkedSkipOrder.skipSize}
                    </Link>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
      {/* Transport requests tab */}
      {!loading && tab === 'transport' && (
        transportRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-muted/20 rounded-3xl">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
              <Truck className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-bold text-foreground">Nav transporta pieprasījumu</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Jums vēl nav neviena transporta pieprasījuma. Pasūtiet pārvadājumu.
              </p>
            </div>
            <Link
              href="/dashboard/order/transport"
              className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 py-3 text-sm transition-all"
            >
              <Truck className="h-4 w-4" />
              Pasūtīt pārvadājumu
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>{transportRequests.length} pieprasījumi</span>
            </div>
            {transportRequests.map((j) => {
              const st = JOB_STATUS[j.status] ?? { label: j.status, bg: '#f3f4f6', text: '#374151' };
              return (
                <div
                  key={j.id}
                  className="block relative bg-muted/30 rounded-3xl p-6 mb-2 hover:bg-muted/50 transition-all duration-300"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                        #{j.jobNumber}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{j.jobType?.replace(/_/g, ' ').toLowerCase()}</span>
                    </div>
                    <StatusBadgeHex cfg={st} />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                    {/* Route */}
                    <div className="flex-2 relative pl-6">
                      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-black/10" />
                      <div className="relative mb-3">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-amber-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Paņemšana · {fmtDate(j.pickupDate)}</p>
                        <p className="text-sm font-medium text-foreground">{j.pickupAddress || j.pickupCity || '—'}</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Piegāde · {fmtDate(j.deliveryDate)}</p>
                        <p className="text-sm font-medium text-foreground">{j.deliveryAddress || j.deliveryCity || '—'}</p>
                      </div>
                    </div>

                    {/* Driver + Rate */}
                    <div className="flex-1 flex flex-col justify-between pt-2 sm:pt-0 gap-3">
                      {j.driver ? (
                        <div className="flex items-center gap-2">
                          <User className="size-4 text-blue-500 shrink-0" />
                          <span className="text-sm font-medium text-blue-700">
                            {j.driver.firstName} {j.driver.lastName}
                          </span>
                          {j.driver.phone && (
                            <a
                              href={`tel:${j.driver.phone}`}
                              className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 transition-colors ml-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="size-3" />
                              Zvanīt
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Šoferis nav piešķirts</span>
                      )}
                      {j.rate != null && (
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">Tarifs</span>
                          <div className="text-lg font-bold tabular-nums">{fmtMoney(j.rate)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, token } = useRequireAuth();
  const { activeMode } = useMode();

  if (!token || !user) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  const isCarrier = activeMode === 'CARRIER';
  const isSupplier = activeMode === 'SUPPLIER';

  const title = isCarrier ? 'Mani Darbi' : isSupplier ? 'Ienākošie Pasūtījumi' : 'Mani Pasūtījumi';

  const subtitle = isCarrier
    ? 'Pārvadājumu vēsture — pabeigti darbi, ieņēmumi, maršruti'
    : isSupplier
      ? 'Pilna pārredzamība — pircēji, materiāli, piegādes datumi, kontakti'
      : 'Jūsu konteineru un materiālu pasūtījumi reāllaikā';

  return (
    <div className="w-full h-full pb-20 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">{subtitle}</p>
      </div>

      {/* Role-aware content */}
      {isCarrier ? (
        <CarrierView token={token} />
      ) : isSupplier ? (
        <SupplierView token={token} />
      ) : (
        <BuyerView token={token} />
      )}
    </div>
  );
}
// reload
// force next reload
