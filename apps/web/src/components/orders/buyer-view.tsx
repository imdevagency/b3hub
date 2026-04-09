'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Link2,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  ORDER_STATUS,
  JOB_STATUS,
  SKIP_STATUS,
  SKIP_SIZE_LABEL,
  StatusBadgeHex,
} from '@/lib/status-config';
import { useBuyerOrders } from '@/hooks/use-buyer-orders';
import { QuickStat } from './quick-stat';

function skipSizeToWizardId(size: string): string {
  return size.toLowerCase();
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

export function BuyerView({ token }: { token: string }) {
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
      {!loading &&
        tab === 'transport' &&
        (transportRequests.length === 0 ? (
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
              const st = JOB_STATUS[j.status] ?? {
                label: j.status,
                bg: '#f3f4f6',
                text: '#374151',
              };
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
                      <span className="text-xs text-muted-foreground capitalize">
                        {j.jobType?.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </div>
                    <StatusBadgeHex cfg={st} />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                    {/* Route */}
                    <div className="flex-2 relative pl-6">
                      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-black/10" />
                      <div className="relative mb-3">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-amber-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          Paņemšana · {fmtDate(j.pickupDate)}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {j.pickupAddress || j.pickupCity || '—'}
                        </p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-emerald-500 ring-4 ring-background shadow-sm" />
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                          Piegāde · {fmtDate(j.deliveryDate)}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {j.deliveryAddress || j.deliveryCity || '—'}
                        </p>
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
        ))}
    </div>
  );
}
