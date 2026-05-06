'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSupplierLoadingSchedule, SupplierLoadingEntry } from '@/lib/api/orders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Package, Truck, Phone, Calendar, Weight } from 'lucide-react';

const VEHICLE_LABELS: Record<string, string> = {
  DUMP_TRUCK: 'Pašizgāzējs',
  FLATBED_TRUCK: 'Platforma',
  SEMI_TRAILER: 'Piekabes',
  HOOK_LIFT: 'Hāku pacēlājs',
  SKIP_LOADER: 'Skip iekrāvējs',
  TANKER: 'Cisterna',
  VAN: 'Furgons',
};

const WINDOW_LABELS: Record<string, string> = {
  AM: '08:00–13:00',
  PM: '13:00–18:00',
  ANY: 'Jebkurā laikā',
};

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
};

const JOB_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-slate-100 text-slate-600',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  EN_ROUTE_PICKUP: 'bg-amber-100 text-amber-700',
  AT_PICKUP: 'bg-orange-100 text-orange-700',
  LOADED: 'bg-emerald-100 text-emerald-700',
  EN_ROUTE_DELIVERY: 'bg-teal-100 text-teal-700',
  DELIVERED: 'bg-green-100 text-green-700',
};

function toDateString(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function LoadingSchedulePage() {
  const { token } = useAuth();
  const [from, setFrom] = useState<string>(toDateString(new Date()));
  const [orders, setOrders] = useState<SupplierLoadingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(dateFrom: string) {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getSupplierLoadingSchedule(token, dateFrom);
      setOrders(data);
    } catch {
      setError('Neizdevās ielādēt grafiku.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, from]);

  function shiftDate(days: number) {
    const d = new Date(from);
    d.setDate(d.getDate() + days);
    setFrom(toDateString(d));
  }

  // Group orders by delivery date
  const grouped = orders.reduce<Record<string, SupplierLoadingEntry[]>>((acc, o) => {
    const day = o.deliveryDate ? o.deliveryDate.split('T')[0] : 'Nav datuma';
    if (!acc[day]) acc[day] = [];
    acc[day].push(o);
    return acc;
  }, {});
  const days = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Iekraušanas grafiks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Apstiprināti pasūtījumi un transporta uzdevumi nākamajām 7 dienām
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-7)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={() => shiftDate(7)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFrom(toDateString(new Date()))}>
            Šodien
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Ielādē grafiku…</div>
      )}

      {!loading && orders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nav apstiprinātu pasūtījumu šajā periodā</p>
        </div>
      )}

      {/* Day sections */}
      {!loading &&
        days.map((day) => {
          const dayOrders = grouped[day];
          const dateLabel =
            day === 'Nav datuma'
              ? 'Nav norādīts datums'
              : new Date(day).toLocaleDateString('lv-LV', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
          return (
            <section key={day} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-sm font-semibold text-muted-foreground capitalize">
                  {dateLabel}
                </span>
                <Badge variant="secondary">{dayOrders.length} pasūt.</Badge>
                <div className="h-px flex-1 bg-border" />
              </div>

              {dayOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow"
                >
                  {/* Order header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{order.orderNumber}</span>
                        <Badge
                          className={`text-xs ${STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-600'}`}
                        >
                          {order.status}
                        </Badge>
                        {order.poNumber && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            PO: {order.poNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order.deliveryAddress}, {order.deliveryCity}
                      </p>
                    </div>
                    {order.buyer && (
                      <div className="text-right text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">
                          {order.buyer.firstName} {order.buyer.lastName}
                        </p>
                        {order.siteContactPhone && (
                          <a
                            href={`tel:${order.siteContactPhone}`}
                            className="flex items-center gap-1 text-primary hover:underline justify-end"
                          >
                            <Phone className="h-3 w-3" />
                            {order.siteContactPhone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Materials */}
                  <div className="flex flex-wrap gap-2">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1.5 text-xs"
                      >
                        <Package className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{item.material.name}</span>
                        <span className="text-muted-foreground">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Transport jobs */}
                  {order.transportJobs.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      {order.transportJobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium">{job.jobNumber}</span>
                            <Badge
                              className={`text-xs ${JOB_STATUS_COLORS[job.status] ?? 'bg-slate-100 text-slate-600'}`}
                            >
                              {job.status}
                            </Badge>
                            {job.pickupWindow && (
                              <span className="text-muted-foreground">
                                {WINDOW_LABELS[job.pickupWindow] ?? job.pickupWindow}
                              </span>
                            )}
                            {job.cargoWeight && (
                              <span className="flex items-center gap-0.5 text-muted-foreground">
                                <Weight className="h-3 w-3" />
                                {job.cargoWeight} t
                              </span>
                            )}
                          </div>
                          <div className="text-right text-muted-foreground">
                            {job.driver ? (
                              <span>
                                {job.driver.firstName} {job.driver.lastName}
                                {job.vehicle && (
                                  <>
                                    {' '}
                                    &middot; {job.vehicle.registrationNumber} &middot;{' '}
                                    {VEHICLE_LABELS[job.vehicle.vehicleType] ??
                                      job.vehicle.vehicleType}
                                  </>
                                )}
                              </span>
                            ) : (
                              <span className="text-amber-600">Nav pieņemts</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {order.transportJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
                      Nav piesaistītu transporta uzdevumu
                    </p>
                  )}

                  {order.notes && (
                    <p className="text-xs text-muted-foreground italic border-t border-border/60 pt-2">
                      {order.notes}
                    </p>
                  )}
                </div>
              ))}
            </section>
          );
        })}
    </div>
  );
}
