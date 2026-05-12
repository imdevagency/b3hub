/**
 * Toilet Cabin Operator Dashboard — /dashboard/toilet-cabins
 * For companies with canSkipHire: true — lists their assigned toilet cabin orders.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  getCarrierToiletCabinOrders,
  updateToiletCabinCarrierStatus,
  type CarrierToiletCabinOrder,
  type ToiletCabinStatus,
} from '@/lib/api/toilet-cabins';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SKIP_HIRE_STATUS, StatusBadgeTw } from '@/lib/status-config';
import { RefreshCw, Home, Phone, MapPin, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { lv } from 'date-fns/locale';

// ── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Gaida' },
  { value: 'CONFIRMED', label: 'Apstiprināti' },
  { value: 'DELIVERED', label: 'Piegādāti' },
  { value: 'IN_USE', label: 'Lietošanā' },
  { value: 'COLLECTED', label: 'Savākti' },
  { value: 'COMPLETED', label: 'Pabeigti' },
];

// Next status in lifecycle — what operator can advance to
const NEXT_STATUS: Partial<Record<ToiletCabinStatus, ToiletCabinStatus>> = {
  CONFIRMED: 'DELIVERED',
  DELIVERED: 'IN_USE',
  IN_USE: 'COLLECTED',
  COLLECTED: 'COMPLETED',
};

const NEXT_STATUS_LABEL: Partial<Record<ToiletCabinStatus, string>> = {
  CONFIRMED: 'Atzīmēt piegādātu',
  DELIVERED: 'Aktivizēt nomu',
  IN_USE: 'Savākta',
  COLLECTED: 'Pabeigt',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ToiletCabinsOperatorPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<CarrierToiletCabinOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getCarrierToiletCabinOrders(token, statusFilter);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdvance(order: CarrierToiletCabinOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next || !token) return;
    setUpdatingId(order.id);
    try {
      await updateToiletCabinCarrierStatus(order.id, next, token);
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Tualetes kabīnes"
        description="Jūsu piešķirtie tualetes kabīņu nomas pasūtījumi"
        icon={<Home className="size-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Status filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground font-medium">Statuss:</span>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-foreground text-background'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Nav pasūtījumu"
          description="Šobrīd nav piešķirtu tualetes kabīņu pasūtījumu šajā kategorijā."
        />
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Pasūtījums</TableHead>
                <TableHead>Adrese</TableHead>
                <TableHead>Kabīnes</TableHead>
                <TableHead>Piegāde</TableHead>
                <TableHead>Periods</TableHead>
                <TableHead>Kontakts</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Darbības</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-sm font-semibold">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium leading-tight">{order.address}</p>
                        <p className="text-xs text-muted-foreground">{order.city}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{order.cabinCount} kab.</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                      {format(parseISO(order.deliveryDate), 'd MMM yyyy', { locale: lv })}
                      {order.deliveryWindow && (
                        <span className="text-xs text-muted-foreground">
                          ({order.deliveryWindow})
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{order.hireDays} d.</TableCell>
                  <TableCell>
                    {order.contactPhone ? (
                      <a
                        href={`tel:${order.contactPhone}`}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Phone className="size-3.5 shrink-0" />
                        {order.contactPhone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadgeTw cfg={SKIP_HIRE_STATUS[order.status]} />
                  </TableCell>
                  <TableCell className="text-right">
                    {NEXT_STATUS[order.status] && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8"
                        disabled={updatingId === order.id}
                        onClick={() => handleAdvance(order)}
                      >
                        {NEXT_STATUS_LABEL[order.status]}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
