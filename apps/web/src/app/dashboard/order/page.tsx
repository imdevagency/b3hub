/**
 * Order hub page — /dashboard/order
 * Intent-first UX: surface active/recent orders first, then service grid.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth-context';
import { getMyOrders, type ApiOrder } from '@/lib/api';
import { OrderServiceGrid } from '@/components/order/OrderServiceGrid';

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'LOADING',
  'DISPATCHED',
  'DELIVERING',
]);

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Gaida apstiprinājumu',
  CONFIRMED: 'Apstiprināts',
  PROCESSING: 'Apstrādē',
  LOADING: 'Iekraušana',
  DISPATCHED: 'Nosūtīts',
  DELIVERING: 'Piegāde',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

export default function OrderHubPage() {
  const { token } = useAuth();
  const [recentOrders, setRecentOrders] = useState<ApiOrder[]>([]);

  useEffect(() => {
    if (!token) return;
    getMyOrders(token)
      .then((orders) => {
        // Show active orders first, then last 3 completed
        const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
        const done = orders.filter((o) => !ACTIVE_STATUSES.has(o.status)).slice(0, 3);
        setRecentOrders([...active, ...done].slice(0, 5));
      })
      .catch(() => {});
  }, [token]);

  return (
    <div className="w-full h-full pb-20 space-y-8">
      <PageHeader title="Pasūtīt" description="Izvēlieties pakalpojumu" />

      {/* Recent / active orders */}
      {recentOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Aktīvie un nesenie
            </h3>
            <Link
              href="/dashboard/orders"
              className="text-sm font-medium text-foreground hover:underline flex items-center gap-1"
            >
              Visi <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const isActive = ACTIVE_STATUSES.has(order.status);
              const materialName = order.items?.[0]?.material?.name ?? 'Pasūtījums';
              return (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-black/5 px-4 py-3.5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-amber-100' : 'bg-gray-100'}`}
                    >
                      {isActive ? (
                        <Clock className="h-4 w-4 text-amber-700" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {materialName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        #{order.orderNumber} · {order.deliveryCity}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isActive ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div>
        {recentOrders.length > 0 && (
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Jauns pasūtījums
          </h3>
        )}
        <OrderServiceGrid dashboard />
      </div>
    </div>
  );
}
