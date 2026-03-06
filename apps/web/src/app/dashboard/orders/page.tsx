'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  getMyOrders,
  getMySkipHireOrders,
  getMyTransportJobs,
  confirmOrder,
  cancelOrder,
  type ApiOrder,
  type SkipHireOrder,
  type ApiTransportJob,
} from '@/lib/api';
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Trash2,
  Truck,
  User,
  Weight,
  X,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtMoney(n: number, currency = 'EUR'): string {
  return `€${Math.round(n).toLocaleString('lv-LV')}`;
}

// ── Status config ──────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Gaidā', bg: '#fef3c7', text: '#b45309' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#dbeafe', text: '#1d4ed8' },
  PROCESSING: { label: 'Apstrādē', bg: '#e0e7ff', text: '#4338ca' },
  LOADING: { label: 'Iekraušana', bg: '#fce7f3', text: '#be185d' },
  DISPATCHED: { label: 'Nosūtīts', bg: '#dcfce7', text: '#15803d' },
  DELIVERING: { label: 'Piegāde', bg: '#dcfce7', text: '#15803d' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', text: '#166534' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

const JOB_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  AVAILABLE: { label: 'Pieejams', bg: '#f0fdf4', text: '#166534' },
  ASSIGNED: { label: 'Piešķirts', bg: '#e0e7ff', text: '#4338ca' },
  ACCEPTED: { label: 'Pieņemts', bg: '#dbeafe', text: '#1d4ed8' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz Iek.', bg: '#fef3c7', text: '#b45309' },
  AT_PICKUP: { label: 'Uz vietas', bg: '#fce7f3', text: '#be185d' },
  LOADED: { label: 'Iekrauts', bg: '#e0e7ff', text: '#4338ca' },
  EN_ROUTE_DELIVERY: { label: 'Piegādē', bg: '#fef3c7', text: '#b45309' },
  AT_DELIVERY: { label: 'Atvedis', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

const SKIP_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Gaidā', bg: '#fef3c7', text: '#b45309' },
  CONFIRMED: { label: 'Apst.', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#dcfce7', text: '#15803d' },
  COLLECTED: { label: 'Savākts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

const SKIP_SIZE_LABEL: Record<string, string> = {
  MINI: 'Mini 2 m³',
  MIDI: 'Midi 4 m³',
  BUILDERS: 'Celtn. 6 m³',
  LARGE: 'Liels 8 m³',
};

function StatusBadge({ cfg }: { cfg: { label: string; bg: string; text: string } }) {
  return (
    <span
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"
    >
      {cfg.label}
    </span>
  );
}

// ── CARRIER view ───────────────────────────────────────────────────────────────

function CarrierView({ token }: { token: string }) {
  const [jobs, setJobs] = useState<ApiTransportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyTransportJobs(token);
      setJobs(data);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Kopā darbi', value: String(jobs.length), icon: ClipboardList },
          {
            label: 'Aktīvie',
            value: String(jobs.filter((j) => ACTIVE.includes(j.status)).length),
            icon: Truck,
          },
          { label: 'Tonnas tranzītā', value: `${totalTonnes.toFixed(1)} t`, icon: Weight },
          { label: 'Nopelnīts (pabeigts)', value: fmtMoney(totalEarnings), icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className="size-4" />
              {label}
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'active', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f === 'all' ? 'Visi' : f === 'active' ? 'Aktīvie' : 'Pabeigti'}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Truck className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav darbu šajā kategorijā</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Darbs</th>
                <th className="px-4 py-3 text-left font-medium">Statuss</th>
                <th className="px-4 py-3 text-left font-medium">Krava</th>
                <th className="px-4 py-3 text-left font-medium">Svars</th>
                <th className="px-4 py-3 text-left font-medium">Maršruts</th>
                <th className="px-4 py-3 text-left font-medium">Datums</th>
                <th className="px-4 py-3 text-left font-medium">Transportlīdzeklis</th>
                <th className="px-4 py-3 text-right font-medium">Cena</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((job) => {
                const st = JOB_STATUS[job.status] ?? {
                  label: job.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const weightTStr = job.cargoWeight
                  ? `${(job.cargoWeight / 1000).toFixed(2)} t`
                  : '—';
                return (
                  <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-xs">#{job.jobNumber}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{job.jobType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge cfg={st} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{job.cargoType}</p>
                      {job.requiredVehicleType && (
                        <p className="text-muted-foreground text-xs">{job.requiredVehicleType}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{weightTStr}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">{job.pickupCity}</span>
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{job.deliveryCity}</span>
                      </div>
                      {job.distanceKm && (
                        <p className="text-muted-foreground text-xs mt-0.5">{job.distanceKm} km</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <p>{fmtDate(job.pickupDate)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {job.vehicle ? (
                        <>
                          <p className="font-medium">{job.vehicle.licensePlate}</p>
                          <p className="text-muted-foreground">{job.vehicle.vehicleType}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {fmtMoney(job.rate ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/orders/${job.id}`}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                      >
                        <Truck className="size-3" />
                        Sekot
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td colSpan={8} className="px-4 py-2 text-muted-foreground">
                  {filtered.length} ieraksti
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {fmtMoney(filtered.reduce((s, j) => s + (j.rate ?? 0), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SUPPLIER view ──────────────────────────────────────────────────────────────

function SupplierView({ token }: { token: string }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyOrders(token);
      setOrders(data);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (id: string) => {
    setActioning(id);
    try {
      const updated = await confirmOrder(id, token);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: updated.status } : o)));
    } catch {
      /**/
    } finally {
      setActioning(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Vai atcelt šo pasūtījumu?')) return;
    setActioning(id);
    try {
      await cancelOrder(id, token);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } catch {
      /**/
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
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Kopā pasūtījumi', value: String(orders.length), icon: ClipboardList },
          {
            label: 'Gaida apstiprinājumu',
            value: String(pending),
            icon: Package,
            alert: pending > 0,
          },
          { label: 'Kopā ieņēmumi', value: fmtMoney(revenue), icon: Banknote },
        ].map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${alert ? 'border-amber-300 bg-amber-50' : 'bg-card'}`}
          >
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className={`size-4 ${alert ? 'text-amber-600' : ''}`} />
              {label}
            </div>
            <p className={`text-xl font-bold ${alert ? 'text-amber-700' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Package className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav ienākošu pasūtījumu</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Pasūtījums</th>
                <th className="px-4 py-3 text-left font-medium">Statuss</th>
                <th className="px-4 py-3 text-left font-medium">Materiāls</th>
                <th className="px-4 py-3 text-left font-medium">Svars</th>
                <th className="px-4 py-3 text-left font-medium">Pircējs</th>
                <th className="px-4 py-3 text-left font-medium">Piegādes adrese</th>
                <th className="px-4 py-3 text-left font-medium">Datums</th>
                <th className="px-4 py-3 text-right font-medium">Summa</th>
                <th className="px-4 py-3 text-center font-medium">Darbības</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const st = ORDER_STATUS[order.status] ?? {
                  label: order.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const item = order.items?.[0];
                const busy = actioning === order.id;
                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-xs">#{order.orderNumber}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {fmtDate(order.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge cfg={st} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{item?.material?.name ?? '—'}</p>
                      {item?.material?.category && (
                        <p className="text-muted-foreground text-xs">{item.material.category}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {item ? `${item.quantity} ${item.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {order.buyer ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <User className="size-3 text-muted-foreground" />
                            {order.buyer.firstName} {order.buyer.lastName}
                          </div>
                          {order.buyer.phone && (
                            <a
                              href={`tel:${order.buyer.phone}`}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                            >
                              <Phone className="size-3" />
                              {order.buyer.phone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{order.deliveryAddress || order.deliveryCity || '—'}</span>
                      </div>
                      {order.siteContactPhone && (
                        <a
                          href={`tel:${order.siteContactPhone}`}
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          title={order.siteContactName ?? 'Objekta kontakts'}
                        >
                          <Phone className="size-3" />
                          {order.siteContactName ?? order.siteContactPhone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtDate(order.deliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {fmtMoney(order.total, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'PENDING' ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            disabled={busy}
                            onClick={() => handleConfirm(order.id)}
                            className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle className="size-3" />
                            Apstiprināt
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => handleCancel(order.id)}
                            className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            <X className="size-3" />
                            Noraidīt
                          </button>
                        </div>
                      ) : (
                        <span className="block text-center text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td colSpan={7} className="px-4 py-2 text-muted-foreground">
                  {orders.length} pasūtījumi
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {fmtMoney(orders.reduce((s, o) => s + o.total, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── BUYER view ─────────────────────────────────────────────────────────────────

function BuyerView({ token }: { token: string }) {
  const [tab, setTab] = useState<'skip' | 'material'>('skip');
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skip, mat] = await Promise.all([getMySkipHireOrders(token), getMyOrders(token)]);
      setSkipOrders(skip);
      setMatOrders(mat);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const totalSpent =
    skipOrders.reduce((s, o) => s + o.price, 0) + matOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Konteineri', value: String(skipOrders.length), icon: Trash2 },
          { label: 'Materiālu pasūtījumi', value: String(matOrders.length), icon: Package },
          { label: 'Kopā iztērēts', value: fmtMoney(totalSpent), icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Icon className="size-4" />
              {label}
            </div>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + refresh */}
      <div className="flex items-center gap-2">
        {[
          { key: 'skip', label: `Konteineri (${skipOrders.length})` },
          { key: 'material', label: `Materiāli (${matOrders.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as 'skip' | 'material')}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
      ) : tab === 'skip' ? (
        /* Skip-hire table */
        skipOrders.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Trash2 className="mx-auto size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nav konteineru pasūtījumu</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Pasūtījums</th>
                  <th className="px-4 py-3 text-left font-medium">Statuss</th>
                  <th className="px-4 py-3 text-left font-medium">Konteiners</th>
                  <th className="px-4 py-3 text-left font-medium">Atkritumu veids</th>
                  <th className="px-4 py-3 text-left font-medium">Adrese</th>
                  <th className="px-4 py-3 text-left font-medium">Piegādes datums</th>
                  <th className="px-4 py-3 text-right font-medium">Cena</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {skipOrders.map((o) => {
                  const st = SKIP_STATUS[o.status] ?? {
                    label: o.status,
                    bg: '#f3f4f6',
                    text: '#374151',
                  };
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-xs">#{o.orderNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge cfg={st} />
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {SKIP_SIZE_LABEL[o.skipSize] ?? o.skipSize}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.wasteCategory.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5 text-xs">
                          <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                          <span>{o.location}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="size-3" />
                          {fmtDate(o.deliveryDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        €{o.price}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          {o.currency}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : /* Material orders table */
      matOrders.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Package className="mx-auto size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Nav materiālu pasūtījumu</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Pasūtījums</th>
                <th className="px-4 py-3 text-left font-medium">Statuss</th>
                <th className="px-4 py-3 text-left font-medium">Materiāls</th>
                <th className="px-4 py-3 text-left font-medium">Daudzums</th>
                <th className="px-4 py-3 text-left font-medium">Piegādes adrese</th>
                <th className="px-4 py-3 text-left font-medium">Datums</th>
                <th className="px-4 py-3 text-right font-medium">Summa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {matOrders.map((o) => {
                const st = ORDER_STATUS[o.status] ?? {
                  label: o.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const item = o.items?.[0];
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-xs">#{o.orderNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge cfg={st} />
                    </td>
                    <td className="px-4 py-3 font-medium">{item?.material?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {item ? `${item.quantity} ${item.unit}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5 text-xs">
                        <MapPin className="size-3 text-muted-foreground mt-0.5 shrink-0" />
                        <span>{o.deliveryAddress || o.deliveryCity || '—'}</span>
                      </div>
                      {/* Driver contact when in transit */}
                      {(() => {
                        const driver = o.transportJobs?.find(
                          (j) =>
                            j.status === 'EN_ROUTE_DELIVERY' ||
                            j.status === 'AT_DELIVERY' ||
                            j.status === 'LOADED',
                        )?.driver;
                        if (!driver) return null;
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <User className="size-3 text-blue-500 shrink-0" />
                            <span className="text-xs text-blue-700 font-medium">
                              {driver.firstName} {driver.lastName}
                            </span>
                            {driver.phone && (
                              <a
                                href={`tel:${driver.phone}`}
                                className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                <Phone className="size-3" />
                                Zvanīt
                              </a>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fmtDate(o.deliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {fmtMoney(o.total, o.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs font-semibold">
                <td colSpan={6} className="px-4 py-2 text-muted-foreground">
                  {matOrders.length} pasūtījumi
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {fmtMoney(matOrders.reduce((s, o) => s + o.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) router.push('/');
  }, [token, router]);

  if (!token || !user) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Ielādē...</div>;
  }

  const isCarrier = user.canTransport || user.userType === 'CARRIER';
  const isSupplier = user.canSell || user.userType === 'SUPPLIER';

  const title = isCarrier ? 'Mani Darbi' : isSupplier ? 'Ienākošie Pasūtījumi' : 'Mani Pasūtījumi';

  const subtitle = isCarrier
    ? 'Visi transporta darbi — aktīvie, pabeigti, tonnas tranzītā'
    : isSupplier
      ? 'Pilna pārredzamība — pircēji, materiāli, piegādes datumi, kontakti'
      : 'Jūsu konteineru un materiālu pasūtījumi reāllaikā';

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="size-6 text-red-600" />
            {title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        </div>
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
