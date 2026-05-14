/**
 * Equipment Rentals — /dashboard/equipment-rentals
 *
 * Adapts based on role:
 *   ADMIN        → all orders platform-wide (/rentals/all)
 *   Provider     → orders for their listings (/rentals/provider)
 *   Carrier      → assigned jobs (/rentals/carrier)
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { lv } from 'date-fns/locale';
import { RefreshCw, MapPin, Calendar, Forklift, Package, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  getAllRentalOrders,
  getProviderRentalOrders,
  type RentalOrderAdminRow,
} from '@/lib/api/rentals';
import { apiFetch } from '@/lib/api/common';
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

// ── Status config ─────────────────────────────────────────────────────────────

type RentalStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'IN_USE'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Visi' },
  { value: 'PENDING', label: 'Gaida' },
  { value: 'CONFIRMED', label: 'Apstiprināti' },
  { value: 'DELIVERED', label: 'Piegādāti' },
  { value: 'IN_USE', label: 'Lietošanā' },
  { value: 'COLLECTED', label: 'Savākti' },
  { value: 'COMPLETED', label: 'Pabeigti' },
];

// Carrier can advance status; provider/admin see read-only status
const CARRIER_NEXT_STATUS: Partial<Record<RentalStatus, RentalStatus>> = {
  CONFIRMED: 'DELIVERED',
  DELIVERED: 'IN_USE',
  IN_USE: 'COLLECTED',
  COLLECTED: 'COMPLETED',
};

const CARRIER_NEXT_LABEL: Partial<Record<RentalStatus, string>> = {
  CONFIRMED: 'Atzīmēt piegādātu',
  DELIVERED: 'Aktivizēt nomu',
  IN_USE: 'Savākta',
  COLLECTED: 'Pabeigt',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-indigo-100 text-indigo-800',
  IN_USE: 'bg-green-100 text-green-800',
  COLLECTED: 'bg-gray-100 text-gray-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
  DELIVERED: 'Piegādāts',
  IN_USE: 'Lietošanā',
  COLLECTED: 'Savākts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  MINI_EXCAVATOR: 'Mini ekskavators',
  EXCAVATOR: 'Ekskavators',
  DUMPER: 'Dempera pašizgāzējs',
  COMPACTOR: 'Kompaktors',
  TELEHANDLER: 'Teleskopiskā iekrāvējs',
  AERIAL_PLATFORM: 'Pacēlājs',
  SCAFFOLDING: 'Sastatnes',
  TEMP_FENCING: 'Pagaidu žogs',
  SITE_OFFICE: 'Mobilā mājiņa',
  GENERATOR: 'Ģenerators',
  LIGHTING_TOWER: 'Apgaismojuma tornis',
  WATER_BOWSER: 'Ūdens cisterna',
  AIR_COMPRESSOR: 'Gaisa kompresors',
  POWER_TOOLS: 'Elektroinstrumenti',
  WELDER: 'Metināšanas iekārta',
  HEATER: 'Sildītājs',
  CONCRETE_EQUIPMENT: 'Betona iekārtas',
  REBAR_EQUIPMENT: 'Armatūras iekārtas',
  ALUMINUM_TOWER: 'Alumīnija tornis',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EquipmentRentalsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<RentalOrderAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const isAdmin = (user as any)?.userType === 'ADMIN';
  const isProvider = !isAdmin && (user as any)?.canRent;
  const isCarrier = !isAdmin && !isProvider && (user as any)?.canTransport;

  const pageTitle = isAdmin
    ? 'Tehnikas noma — visi pasūtījumi'
    : isProvider
      ? 'Ienākošie pasūtījumi'
      : 'Piešķirtie pasūtījumi';

  const pageDescription = isAdmin
    ? 'Visi platformas tehnikas nomas pasūtījumi.'
    : isProvider
      ? 'Pasūtījumi, kas saņemti pret jūsu sludinājumiem.'
      : 'Jūsu uzņēmumam piešķirtie tehnikas nomas darbi.';

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let data: RentalOrderAdminRow[];
      if (isAdmin) {
        data = await getAllRentalOrders(
          token,
          undefined,
          statusFilter !== 'ALL' ? statusFilter : undefined,
        );
      } else if (isProvider) {
        data = await getProviderRentalOrders(token);
        if (statusFilter !== 'ALL') {
          data = data.filter((o) => o.status === statusFilter);
        }
      } else {
        // Carrier
        const qs = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
        data = await apiFetch<RentalOrderAdminRow[]>(`/rentals/carrier${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, isAdmin, isProvider]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusUpdate = async (id: string, newStatus: RentalStatus) => {
    if (!token) return;
    setUpdatingId(id);
    try {
      await apiFetch(`/rentals/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex items-center gap-2">
            {isProvider && (
              <Button
                size="sm"
                onClick={() => router.push('/dashboard/equipment-rentals/catalog')}
                className="gap-2"
              >
                <Package className="h-4 w-4" />
                Mans katalogs
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atjaunināt
            </Button>
          </div>
        }
      />

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Forklift}
          title="Nav pasūtījumu"
          description={
            isAdmin
              ? 'Platformā vēl nav tehnikas nomas pasūtījumu.'
              : isProvider
                ? 'Neviens pircējs vēl nav pasūtījis jūsu iekārtas. Pārliecinieties, ka sludinājumi ir aktīvi.'
                : 'Jums nav piešķirtu tehnikas nomas darbu.'
          }
        />
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Iekārta</TableHead>
                {isAdmin && <TableHead>Piegādātājs</TableHead>}
                <TableHead>Adrese</TableHead>
                <TableHead>Piegāde</TableHead>
                <TableHead>Noma</TableHead>
                <TableHead>Daudzums</TableHead>
                <TableHead>Cena</TableHead>
                <TableHead>Statuss</TableHead>
                {isCarrier && <TableHead>Darbības</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const next = CARRIER_NEXT_STATUS[order.status as RentalStatus];
                const isUpdating = updatingId === order.id;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {SERVICE_TYPE_LABELS[order.serviceType] ?? order.serviceType}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm text-gray-600">
                        {order.provider?.name ?? (
                          <span className="text-gray-400 italic">Nav piegādātāja</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="truncate max-w-40">{order.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        {format(parseISO(order.deliveryDate), 'd. MMM', { locale: lv })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{order.hireDays} d.</TableCell>
                    <TableCell className="text-sm text-gray-600">{order.quantity}×</TableCell>
                    <TableCell className="text-sm font-medium">€{order.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-800'}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    {isCarrier && (
                      <TableCell>
                        {next && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleStatusUpdate(order.id, next)}
                            className="text-xs"
                          >
                            {isUpdating ? '...' : CARRIER_NEXT_LABEL[order.status as RentalStatus]}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
