/**
 * B3 Construction — Atkritumu izvešana
 * /dashboard/b3-construction/disposal
 *
 * Cross-project view of all disposal (waste) orders tagged to construction projects.
 * Shows volume by waste type, status workflow, and which orders are linked to B3 Recycling.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetConstructionDisposalOrders,
  type AdminConstructionDisposalOrder,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Truck, RefreshCw, PackageX, Euro } from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Gaida',
  CONFIRMED: 'Apstiprināts',
  IN_PROGRESS: 'Procesā',
  DELIVERED: 'Piegādāts',
  COMPLETED: 'Pabeigts',
  CANCELLED: 'Atcelts',
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  CONFIRMED: 'default',
  IN_PROGRESS: 'default',
  DELIVERED: 'outline',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

const WASTE_TYPE_LABELS: Record<string, string> = {
  CONCRETE: 'Betons',
  BRICK: 'Ķieģeļi',
  WOOD: 'Koksne',
  METAL: 'Metāls',
  PLASTIC: 'Plastmasa',
  SOIL: 'Grunts',
  MIXED: 'Jaukti',
  HAZARDOUS: 'Bīstami',
};

function parseWasteTypes(raw: string | null): string {
  if (!raw) return '—';
  try {
    const arr: string[] = JSON.parse(raw);
    return arr.map((t) => WASTE_TYPE_LABELS[t] ?? t).join(', ');
  } catch {
    return raw;
  }
}

function formatEur(n: number) {
  return new Intl.NumberFormat('lv-LV', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryBar({ orders }: { orders: AdminConstructionDisposalOrder[] }) {
  const active = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
  const totalVolume = orders.reduce((s, o) => s + (o.disposalVolume ?? 0), 0);
  const totalValue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktīvie darbi</p>
              <p className="text-2xl font-semibold">{active}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
              <PackageX className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kopējais apjoms</p>
              <p className="text-2xl font-semibold">
                {totalVolume > 0 ? `${totalVolume.toFixed(1)} m³` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <Euro className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kopējā summa</p>
              <p className="text-2xl font-semibold">{formatEur(totalValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <TableRow>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton className="h-4 w-full" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConstructionDisposalPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<AdminConstructionDisposalOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminGetConstructionDisposalOrders(token, {
        limit: 200,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setOrders(res.data);
      setTotal(res.total);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = orders.filter((o) => o.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Atkritumu izvešana"
        description={`${total} pasūtījumi kopā`}
        action={
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {!loading && orders.length > 0 && <SummaryBar orders={orders} />}

      {/* Pending attention banner */}
      {!loading && pending > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Truck className="h-4 w-4 shrink-0" />
          <span>
            <strong>{pending}</strong> pasūtījums(-i) gaida apstiprinājumu
          </span>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Statuss" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Visi statusi</SelectItem>
            <SelectItem value="PENDING">Gaida</SelectItem>
            <SelectItem value="CONFIRMED">Apstiprināts</SelectItem>
            <SelectItem value="IN_PROGRESS">Procesā</SelectItem>
            <SelectItem value="DELIVERED">Piegādāts</SelectItem>
            <SelectItem value="COMPLETED">Pabeigts</SelectItem>
            <SelectItem value="CANCELLED">Atcelts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nr.</TableHead>
                <TableHead>Projekts</TableHead>
                <TableHead>Klients</TableHead>
                <TableHead>Atkritumu veids</TableHead>
                <TableHead>Apjoms</TableHead>
                <TableHead>Statuss</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead>Datums</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12">
                    <EmptyState
                      icon={Truck}
                      title="Nav atkritumu izvešanas pasūtījumu"
                      description="Šeit parādīsies visi projektiem piesaistītie atkritumu izvešanas darbi"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      o.project?.id &&
                      router.push(`/dashboard/b3-construction/projects/${o.project.id}`)
                    }
                  >
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {o.project?.name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(o.buyerCompany?.name ??
                        `${o.buyer?.firstName ?? ''} ${o.buyer?.lastName ?? ''}`.trim()) ||
                        '—'}
                    </TableCell>
                    <TableCell className="text-sm">{parseWasteTypes(o.wasteTypes)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.disposalVolume != null ? `${o.disposalVolume} m³` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[o.status] ?? 'secondary'}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatEur(o.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.deliveryDate
                        ? format(new Date(o.deliveryDate), 'dd.MM.yyyy')
                        : format(new Date(o.createdAt), 'dd.MM.yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
