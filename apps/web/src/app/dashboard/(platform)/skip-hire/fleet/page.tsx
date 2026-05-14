/**
 * Skip Fleet Board — /dashboard/skip-hire/fleet
 *
 * Shows the operator's entire deployed skip fleet in two modes:
 *   Map view  — Google Maps with colour-coded pins + side detail panel
 *   Table view — sortable table with urgency ordering
 *
 * Status colour logic:
 *   Gray  = CONFIRMED (awaiting delivery to site)
 *   Blue  = DELIVERED, hire period not expired
 *   Red   = DELIVERED, overdue (hire period passed)
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useAuth } from '@/lib/auth-context';
import { getSkipCarrierMap, type SkipMapOrder, type SkipSize } from '@/lib/api/skip-hire';
import {
  getCarrierPricing,
  setCarrierPrice,
  deleteCarrierPrice,
  getCarrierZones,
  addCarrierZone,
  deleteCarrierZone,
  type CarrierPricing,
  type CarrierServiceZone,
} from '@/lib/api/carrier-settings';
import { getGoogleMapsPublicKey } from '@/lib/google-maps-key';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Calendar,
  List,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const LATVIA_CENTER = { lat: 56.9496, lng: 24.1052 };
const DEFAULT_ZOOM = 8;
const DEFAULT_HIRE_DAYS = 7;

type FilterKey = 'all' | 'CONFIRMED' | 'DELIVERED' | 'OVERDUE';

type EffectiveStatus = 'CONFIRMED' | 'DELIVERED' | 'OVERDUE';

const STATUS_CONFIG: Record<
  EffectiveStatus,
  { label: string; pinColor: string; badgeClass: string }
> = {
  CONFIRMED: {
    label: 'Gaida piegādi',
    pinColor: '#6b7280',
    badgeClass: 'border-gray-200 bg-gray-100 text-gray-700',
  },
  DELIVERED: {
    label: 'Uz objekta',
    pinColor: '#2563eb',
    badgeClass: 'border-blue-200 bg-blue-100 text-blue-700',
  },
  OVERDUE: {
    label: 'Kavējas',
    pinColor: '#dc2626',
    badgeClass: 'border-red-200 bg-red-100 text-red-700',
  },
};

const SIZE_LABELS: Record<SkipSize, string> = {
  MINI: 'Mini (2m³)',
  MIDI: 'Midi (4m³)',
  BUILDERS: 'Builders (6m³)',
  LARGE: 'Large (8m³)',
};

const SIZE_DESCRIPTIONS: Record<SkipSize, string> = {
  MINI: 'Ideāli maziem dārza darbiem',
  MIDI: 'Standarta renovācijas projekts',
  BUILDERS: 'Vidējs būvniecības projekts',
  LARGE: 'Lielie būvgruzji un nojaukšana',
};

const ALL_SKIP_SIZES: SkipSize[] = ['MINI', 'MIDI', 'BUILDERS', 'LARGE'];

const WASTE_LABELS: Record<string, string> = {
  MIXED: 'Jaukts',
  GREEN_GARDEN: 'Dārza',
  CONCRETE_RUBBLE: 'Betona gruži',
  WOOD: 'Koks',
  METAL_SCRAP: 'Metāls',
  ELECTRONICS_WEEE: 'Elektronika',
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Visi',
  CONFIRMED: 'Gaida piegādi',
  DELIVERED: 'Uz objekta',
  OVERDUE: 'Kavējas',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function effectiveStatus(o: SkipMapOrder): EffectiveStatus {
  if (o.status === 'DELIVERED' && o.overdueDays > 0) return 'OVERDUE';
  return o.status as EffectiveStatus;
}

/** ISO date → short Latvian format "12. mai." */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });
}

/** Return due date: deliveredAt + hireDays */
function returnDue(o: SkipMapOrder): Date | null {
  if (o.status !== 'DELIVERED') return null;
  const days = o.hireDays ?? DEFAULT_HIRE_DAYS;
  const ts = o.statusTimestamps as Record<string, string> | null;
  const base = ts?.DELIVERED ? new Date(ts.DELIVERED) : new Date(o.deliveryDate);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Days on site (since delivery, not since return due). */
function daysOnSite(o: SkipMapOrder): number {
  if (o.status !== 'DELIVERED') return 0;
  const ts = o.statusTimestamps as Record<string, string> | null;
  const from = ts?.DELIVERED ? new Date(ts.DELIVERED) : new Date(o.deliveryDate);
  return Math.max(0, Math.floor((Date.now() - from.getTime()) / (24 * 60 * 60 * 1000)));
}

/** SVG data-URI pin for Google Maps marker. */
function pinSvgUrl(fill: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48">
    <path d="M20 1C10.6 1 3 8.6 3 18c0 13.4 17 28 17 28s17-14.6 17-28C37 8.6 29.4 1 20 1z"
      fill="${fill}" stroke="white" stroke-width="1.5"/>
    <circle cx="20" cy="18" r="10" fill="white" opacity="0.9"/>
    <text x="20" y="22" text-anchor="middle"
      font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${fill}">${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function fmtEur(v: number): string {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(v);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderCard({
  order,
  selected,
  onClick,
}: {
  order: SkipMapOrder;
  selected: boolean;
  onClick: () => void;
}) {
  const status = effectiveStatus(order);
  const cfg = STATUS_CONFIG[status];
  const due = returnDue(order);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3.5 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/50 ${
        selected ? 'bg-muted/60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-mono font-bold text-muted-foreground">
          #{order.orderNumber}
        </span>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.badgeClass}`}>
          {status === 'OVERDUE' ? `Kavējas ${order.overdueDays} d.` : cfg.label}
        </Badge>
      </div>
      <p className="text-sm font-medium text-foreground line-clamp-1 mb-1">{order.location}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Package className="size-3" />
          {SIZE_LABELS[order.skipSize]}
        </span>
        {due && (
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {fmtDate(due.toISOString())}
          </span>
        )}
      </div>
      {order.overdueFeeEur > 0 && (
        <p className="text-xs text-red-600 font-semibold mt-1.5 flex items-center gap-1">
          <AlertTriangle className="size-3" />
          Kavēšanās maksa: {fmtEur(order.overdueFeeEur)}
        </p>
      )}
    </button>
  );
}

function OrderDetail({ order, onClose }: { order: SkipMapOrder; onClose: () => void }) {
  const status = effectiveStatus(order);
  const cfg = STATUS_CONFIG[status];
  const due = returnDue(order);
  const dos = daysOnSite(order);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-mono text-muted-foreground">#{order.orderNumber}</p>
          <h3 className="text-sm font-bold text-foreground mt-0.5">{order.location}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs underline shrink-0"
        >
          Aizvērt
        </button>
      </div>

      <Badge variant="outline" className={`${cfg.badgeClass} text-xs`}>
        {status === 'OVERDUE' ? `Kavējas ${order.overdueDays} dienas` : cfg.label}
      </Badge>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="size-4 shrink-0" />
          <span>
            {SIZE_LABELS[order.skipSize]} ·{' '}
            {WASTE_LABELS[order.wasteCategory] ?? order.wasteCategory}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="size-4 shrink-0" />
          <span>
            Piegādāts: {fmtDate(order.deliveryDate)}
            {order.status === 'DELIVERED' && ` · ${dos} d. uz objekta`}
          </span>
        </div>
        {due && (
          <div
            className={`flex items-center gap-2 font-medium ${
              order.overdueDays > 0 ? 'text-red-600' : 'text-foreground'
            }`}
          >
            <Calendar className="size-4 shrink-0" />
            <span>
              Atgriešana: {fmtDate(due.toISOString())}
              {order.overdueDays > 0
                ? ` (${order.overdueDays} d. kavējas)`
                : ` (${Math.max(0, Math.ceil((due.getTime() - Date.now()) / 86400000))} d. atliek)`}
            </span>
          </div>
        )}
        {order.contactName && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4 shrink-0" />
            <span>
              {order.contactName}
              {order.contactPhone && (
                <a
                  href={`tel:${order.contactPhone}`}
                  className="ml-1 text-foreground hover:underline"
                >
                  {order.contactPhone}
                </a>
              )}
            </span>
          </div>
        )}
        {order.notes && (
          <p className="text-muted-foreground italic text-xs bg-muted/50 rounded p-2">
            {order.notes}
          </p>
        )}
      </div>

      {order.overdueFeeEur > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Kavēšanās maksa: {fmtEur(order.overdueFeeEur)}
          </p>
          <p className="text-[11px] text-red-600 mt-0.5">
            Izrakstiet papildu rēķinu mobilajā lietotnē
          </p>
        </div>
      )}
    </div>
  );
}

// ── Fleet Map ─────────────────────────────────────────────────────────────────

function FleetMap({
  orders,
  selectedId,
  onSelect,
}: {
  orders: SkipMapOrder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [infoId, setInfoId] = useState<string | null>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'skip-fleet-map',
    googleMapsApiKey: getGoogleMapsPublicKey(),
  });
  const [mapInst, setMapInst] = useState<google.maps.Map | null>(null);

  const mappable = useMemo(() => orders.filter((o) => o.lat && o.lng), [orders]);
  const unmappable = useMemo(() => orders.filter((o) => !o.lat || !o.lng), [orders]);

  // Fit bounds to all markers once map + orders are ready
  useEffect(() => {
    if (!mapInst || mappable.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    mappable.forEach((o) => bounds.extend({ lat: o.lat!, lng: o.lng! }));
    mapInst.fitBounds(bounds, 60);
  }, [mapInst, mappable]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  );

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-150 rounded-xl border border-border bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Karte nav pieejama — pārbaudiet API atslēgu.
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] rounded-xl overflow-hidden border border-border">
      {/* Map */}
      <div className="relative h-150">
        {!isLoaded ? (
          <Skeleton className="w-full h-full rounded-none" />
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={LATVIA_CENTER}
            zoom={DEFAULT_ZOOM}
            onLoad={setMapInst}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              gestureHandling: 'greedy',
            }}
          >
            {mappable.map((order) => {
              const status = effectiveStatus(order);
              const pin = STATUS_CONFIG[status];
              return (
                <Marker
                  key={order.id}
                  position={{ lat: order.lat!, lng: order.lng! }}
                  icon={pinSvgUrl(pin.pinColor, SIZE_LABELS[order.skipSize].split(' ')[0])}
                  onClick={() => {
                    onSelect(order.id);
                    setInfoId(order.id);
                  }}
                  zIndex={order.overdueDays > 0 ? 10 : 1}
                >
                  {infoId === order.id && (
                    <InfoWindow onCloseClick={() => setInfoId(null)}>
                      <div className="text-xs space-y-0.5 min-w-32">
                        <p className="font-bold text-gray-800">#{order.orderNumber}</p>
                        <p className="text-gray-600">{order.location}</p>
                        <p
                          className={`font-semibold ${
                            status === 'OVERDUE' ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {status === 'OVERDUE' ? `Kavējas ${order.overdueDays} d.` : pin.label}
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              );
            })}
          </GoogleMap>
        )}
      </div>

      {/* Side panel */}
      <div className="h-150 flex flex-col border-l border-border bg-background">
        {selectedOrder ? (
          <OrderDetail order={selectedOrder} onClose={() => onSelect(null)} />
        ) : (
          <>
            <p className="text-[11px] font-semibold text-muted-foreground px-3.5 pt-3 pb-2 border-b border-border/50">
              {orders.length > 0
                ? `${orders.length} aktīvs skip${orders.length === 1 ? '' : 'i'} · noklikšķiniet uz kārtes`
                : 'Nav aktīvu skipu'}
            </p>
            <div className="flex-1 overflow-y-auto">
              {orders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  selected={o.id === selectedId}
                  onClick={() => onSelect(o.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Unmappable orders warning */}
        {unmappable.length > 0 && (
          <div className="border-t border-border/50 p-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50">
            <MapPinOff className="size-3.5 shrink-0" />
            {unmappable.length} skip{unmappable.length > 1 ? 'i' : 's'} bez koordinātēm — redzams
            tikai sarakstā
          </div>
        )}
      </div>
    </div>
  );
}

// ── Fleet Table ───────────────────────────────────────────────────────────────

function FleetTable({ orders }: { orders: SkipMapOrder[] }) {
  const sorted = useMemo(
    () =>
      [...orders].sort((a, b) => {
        // Overdue first (highest overdueDays first), then DELIVERED, then CONFIRMED
        if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
        if (a.status !== b.status) {
          if (a.status === 'DELIVERED') return -1;
          if (b.status === 'DELIVERED') return 1;
        }
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      }),
    [orders],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="size-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nav atbilstošu skipu</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Pasūtījums</TableHead>
              <TableHead>Adrese</TableHead>
              <TableHead className="w-28">Izmērs</TableHead>
              <TableHead className="w-28">Atkritumi</TableHead>
              <TableHead className="w-24">Piegādāts</TableHead>
              <TableHead className="w-24">Atgriešana</TableHead>
              <TableHead className="w-24 text-right">Dienas</TableHead>
              <TableHead className="w-32">Statuss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((order) => {
              const status = effectiveStatus(order);
              const cfg = STATUS_CONFIG[status];
              const due = returnDue(order);
              const dos = daysOnSite(order);
              const daysRemaining = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;
              const isOverdue = order.overdueDays > 0;

              return (
                <TableRow key={order.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                  <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                    #{order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5">
                      {!order.lat && (
                        <MapPinOff className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <span className="text-sm text-foreground line-clamp-2 max-w-56">
                        {order.location}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{SIZE_LABELS[order.skipSize]}</TableCell>
                  <TableCell className="text-sm">
                    {WASTE_LABELS[order.wasteCategory] ?? order.wasteCategory}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(order.deliveryDate)}
                  </TableCell>
                  <TableCell
                    className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-foreground'}`}
                  >
                    {due ? fmtDate(due.toISOString()) : '–'}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === 'CONFIRMED' ? (
                      <span className="text-sm text-muted-foreground">–</span>
                    ) : isOverdue ? (
                      <span className="text-sm font-bold text-red-600">-{order.overdueDays}d</span>
                    ) : daysRemaining !== null ? (
                      <span
                        className={`text-sm font-semibold ${
                          daysRemaining <= 1 ? 'text-amber-600' : 'text-foreground'
                        }`}
                      >
                        +{daysRemaining}d
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">{dos}d</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline" className={`text-[10px] ${cfg.badgeClass}`}>
                        {cfg.label}
                      </Badge>
                      {order.overdueFeeEur > 0 && (
                        <p className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                          <AlertTriangle className="size-2.5" />
                          {fmtEur(order.overdueFeeEur)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type PageTab = 'deployed' | 'fleet';

export default function SkipFleetPage() {
  const { token } = useAuth();

  // ── Deployed fleet (orders) state ────────────────────────────────
  const [tab, setTab] = useState<PageTab>('deployed');
  const [orders, setOrders] = useState<SkipMapOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'map' | 'table'>('map');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Fleet config (pricing + zones) state ─────────────────────────
  const [pricing, setPricing] = useState<CarrierPricing[]>([]);
  const [zones, setZones] = useState<CarrierServiceZone[]>([]);
  const [fleetLoading, setFleetLoading] = useState(true);
  const [priceDialog, setPriceDialog] = useState<{ open: boolean; size: SkipSize; price: string }>({
    open: false,
    size: 'MINI',
    price: '',
  });
  const [savingPrice, setSavingPrice] = useState(false);
  const [deletingSize, setDeletingSize] = useState<SkipSize | null>(null);
  const [newZone, setNewZone] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await getSkipCarrierMap(token);
        setOrders(data);
      } catch {
        // silent — user can retry
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const loadFleet = useCallback(async () => {
    if (!token) return;
    setFleetLoading(true);
    try {
      const [p, z] = await Promise.all([getCarrierPricing(token), getCarrierZones(token)]);
      setPricing(p);
      setZones(z);
    } catch {
      // silent
    } finally {
      setFleetLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'fleet') loadFleet();
  }, [tab, loadFleet]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedId(null);
  }, [filter]);

  // ── Fleet config handlers ─────────────────────────────────────────

  function openPriceDialog(size: SkipSize) {
    const existing = pricing.find((p) => p.skipSize === size);
    setPriceDialog({ open: true, size, price: existing ? String(existing.price) : '' });
  }

  async function handleSavePrice() {
    if (!token) return;
    const price = parseFloat(priceDialog.price);
    if (isNaN(price) || price <= 0) return;
    setSavingPrice(true);
    try {
      await setCarrierPrice(token, priceDialog.size, price);
      setPriceDialog((d) => ({ ...d, open: false }));
      await loadFleet();
    } finally {
      setSavingPrice(false);
    }
  }

  async function handleDeletePrice(size: SkipSize) {
    if (!token) return;
    setDeletingSize(size);
    try {
      await deleteCarrierPrice(token, size);
      await loadFleet();
    } finally {
      setDeletingSize(null);
    }
  }

  async function handleAddZone() {
    const city = newZone.trim();
    if (!city || !token) return;
    setAddingZone(true);
    try {
      await addCarrierZone(token, { city });
      setNewZone('');
      await loadFleet();
    } finally {
      setAddingZone(false);
    }
  }

  async function handleDeleteZone(id: string) {
    if (!token) return;
    setDeletingZoneId(id);
    try {
      await deleteCarrierZone(token, id);
      await loadFleet();
    } finally {
      setDeletingZoneId(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const confirmed = orders.filter((o) => o.status === 'CONFIRMED').length;
    const delivered = orders.filter((o) => o.status === 'DELIVERED' && o.overdueDays === 0).length;
    const overdue = orders.filter((o) => o.overdueDays > 0).length;
    const overdueFeesTotal = orders.reduce((s, o) => s + o.overdueFeeEur, 0);
    return { confirmed, delivered, overdue, overdueFeesTotal, total: orders.length };
  }, [orders]);

  // ── Filtered orders ───────────────────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'OVERDUE') return orders.filter((o) => o.overdueDays > 0);
    if (filter === 'DELIVERED')
      return orders.filter((o) => o.status === 'DELIVERED' && o.overdueDays === 0);
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  // ── Filter counts ─────────────────────────────────────────────────────────

  const filterCount: Record<FilterKey, number> = {
    all: orders.length,
    CONFIRMED: stats.confirmed,
    DELIVERED: stats.delivered,
    OVERDUE: stats.overdue,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 xl:p-8 space-y-6">
      <PageHeader
        title="Skip Flote"
        description="Pārvaldiet konteineru cenas, zonas un aktīvo izvietojumu"
        action={
          tab === 'fleet' ? (
            <Button size="sm" onClick={() => openPriceDialog('MINI')}>
              <Plus className="size-4 mr-2" /> Pievienot konteinera tipu
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Atjaunināt
            </Button>
          )
        }
      />

      {/* Tab switch */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {(['deployed', 'fleet'] as PageTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'deployed' ? 'Izvietojums' : 'Mana flote'}
          </button>
        ))}
      </div>

      {/* ── FLEET CONFIG TAB ─────────────────────────────────────── */}
      {tab === 'fleet' && (
        <>
          {fleetLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Konteineru cenas
                </h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {ALL_SKIP_SIZES.map((size) => {
                    const entry = pricing.find((p) => p.skipSize === size);
                    return (
                      <Card key={size} className="rounded-2xl border border-border">
                        <CardContent className="pt-5 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-base font-semibold">{SIZE_LABELS[size]}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {SIZE_DESCRIPTIONS[size]}
                              </p>
                            </div>
                            <Badge variant={entry ? 'default' : 'secondary'}>
                              {entry ? 'Aktīvs' : 'Nav iestatīts'}
                            </Badge>
                          </div>
                          {entry ? (
                            <p className="text-2xl font-bold">
                              €{entry.price.toFixed(2)}
                              <span className="text-sm font-normal text-muted-foreground ml-1">
                                / noma
                              </span>
                            </p>
                          ) : (
                            <p className="text-2xl font-bold text-muted-foreground/40">—</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => openPriceDialog(size)}
                            >
                              <Pencil className="size-3.5 mr-1.5" />
                              {entry ? 'Rediģēt' : 'Iestatīt cenu'}
                            </Button>
                            {entry && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={deletingSize === size}
                                onClick={() => handleDeletePrice(size)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Service zones */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Apkalpojamās pilsētas
                </h3>
                <Card className="rounded-2xl border border-border">
                  <CardContent className="pt-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {zones.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Nav pievienotu pilsētu. Pievienojiet pilsētas, kurās nodrošināt piegādi.
                        </p>
                      )}
                      {zones.map((z) => (
                        <span
                          key={z.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm font-medium"
                        >
                          <MapPin className="size-3 text-muted-foreground" />
                          {z.city}
                          {z.surcharge ? (
                            <span className="text-xs text-muted-foreground">+€{z.surcharge}</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDeleteZone(z.id)}
                            disabled={deletingZoneId === z.id}
                            className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Rīga, Jūrmala, Jelgava..."
                        value={newZone}
                        onChange={(e) => setNewZone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddZone()}
                        className="max-w-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAddZone}
                        disabled={!newZone.trim() || addingZone}
                      >
                        <Plus className="size-4 mr-1.5" />
                        Pievienot
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Pricing dialog */}
          <Dialog
            open={priceDialog.open}
            onOpenChange={(open) => setPriceDialog((d) => ({ ...d, open }))}
          >
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>
                  {pricing.find((p) => p.skipSize === priceDialog.size)
                    ? `Rediģēt — ${SIZE_LABELS[priceDialog.size]}`
                    : `Pievienot — ${SIZE_LABELS[priceDialog.size]}`}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  {SIZE_DESCRIPTIONS[priceDialog.size]}
                </p>
                <div className="space-y-2">
                  <Label>Nomas cena (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={priceDialog.price}
                    onChange={(e) => setPriceDialog((d) => ({ ...d, price: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePrice()}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPriceDialog((d) => ({ ...d, open: false }))}
                  >
                    Atcelt
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSavePrice}
                    disabled={savingPrice || !priceDialog.price}
                  >
                    {savingPrice ? 'Saglabā...' : 'Saglabāt'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── DEPLOYED FLEET TAB ───────────────────────────────────── */}
      {tab === 'deployed' && (
        <>
          {/* Stats strip */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Gaida piegādi</p>
                  <p className="text-3xl font-bold text-foreground">{stats.confirmed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Uz objekta</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.delivered}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Kavējas</p>
                  <p
                    className={`text-3xl font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-foreground'}`}
                  >
                    {stats.overdue}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Kavēšanās maksa</p>
                  <p
                    className={`text-2xl font-bold ${stats.overdueFeesTotal > 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                  >
                    {stats.overdueFeesTotal > 0 ? fmtEur(stats.overdueFeesTotal) : '€0'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Controls: filter chips + view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter chips */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    filter === key
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-foreground hover:border-foreground/40 bg-background'
                  }`}
                >
                  {FILTER_LABELS[key]}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                      filter === key ? 'bg-background/20' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {filterCount[key]}
                  </span>
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setView('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  view === 'map'
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted/60'
                }`}
              >
                <MapIcon className="size-3.5" />
                Karte
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-l border-border transition-colors ${
                  view === 'table'
                    ? 'bg-foreground text-background'
                    : 'text-foreground hover:bg-muted/60'
                }`}
              >
                <List className="size-3.5" />
                Saraksts
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <Skeleton className="h-150 rounded-xl" />
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Trash2 className="size-12 text-muted-foreground/30 mb-4" />
              <p className="text-base font-semibold text-muted-foreground">Nav aktīvu skipu</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Kad klients pasūtīs skip, tas parādīsies šeit
              </p>
            </div>
          ) : view === 'map' ? (
            <FleetMap orders={filteredOrders} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <FleetTable orders={filteredOrders} />
          )}
        </>
      )}
    </div>
  );
}
