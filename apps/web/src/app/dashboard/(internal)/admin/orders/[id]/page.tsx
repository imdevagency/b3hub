/**
 * Admin — Order detail
 * /dashboard/admin/orders/[id]
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ExternalLink, AlertTriangle, FileText, Truck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  adminGetOrderById,
  adminCancelOrder,
  adminForceOrderStatus,
  type AdminOrderDetail,
} from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fmtDate } from '@/lib/format';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  DISPUTED: 'bg-orange-100 text-orange-800',
};

const PAYMENT_STATUS_COLOURS: Record<string, string> = {
  UNPAID: 'bg-red-50 text-red-700',
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  REFUNDED: 'bg-gray-100 text-gray-700',
  FAILED: 'bg-red-100 text-red-800',
};

function euro(v: number, currency = 'EUR') {
  return v.toLocaleString('lv-LV', { style: 'currency', currency, minimumFractionDigits: 2 });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token: rawToken } = useAuth();
  const token = rawToken ?? '';

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel dialog
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Force status dialog
  const [forceStatusOpen, setForceStatusOpen] = useState(false);
  const [forceStatus, setForceStatus] = useState('');
  const [forceStatusReason, setForceStatusReason] = useState('');
  const [forcingStatus, setForcingStatus] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      setOrder(await adminGetOrderById(id, token));
    } catch {
      setError('Neizdevās ielādēt pasūtījuma informāciju.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel() {
    if (!token || !order || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await adminCancelOrder(order.id, cancelReason.trim(), token);
      setCancelOpen(false);
      setCancelReason('');
      await load();
    } catch {
      setError('Neizdevās atcelt pasūtījumu.');
    } finally {
      setCancelling(false);
    }
  }

  if (loading)
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (error || !order)
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Atpakaļ
        </Button>
        <p className="text-destructive">{error ?? 'Pasūtījums nav atrasts.'}</p>
      </div>
    );

  const isCancellable = !['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(order.status);

  async function handleForceStatus() {
    if (!token || !order || !forceStatus) return;
    setForcingStatus(true);
    try {
      await adminForceOrderStatus(
        order.id,
        forceStatus,
        forceStatusReason || 'Admin override',
        token,
      );
      setForceStatusOpen(false);
      setForceStatus('');
      setForceStatusReason('');
      await load();
    } catch {
      setError('Neizdevās mainīt statusu.');
    } finally {
      setForcingStatus(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/admin/orders">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Pasūtījumi
          </Link>
        </Button>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot
        </button>
      </div>

      <div className="flex items-start justify-between">
        <PageHeader
          title={order.orderNumber}
          description={`${order.orderType} · ${fmtDate(order.createdAt)}`}
        />
        <div className="flex items-center gap-3 mt-1">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOURS[order.status] ?? 'bg-muted text-foreground'}`}
          >
            {order.status}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${PAYMENT_STATUS_COLOURS[order.paymentStatus ?? ''] ?? 'bg-muted text-foreground'}`}
          >
            {order.paymentStatus ?? '—'}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kopsavilkums</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Kopā
            </p>
            <p className="text-xl font-bold tabular-nums">{euro(order.total, order.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Piegādes pilsēta
            </p>
            {order.deliveryCity ?? '—'}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
              Piegādes datums
            </p>
            {order.deliveryDate ? fmtDate(order.deliveryDate) : '—'}
          </div>
          {order.deliveryAddress && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Adrese
              </p>
              {order.deliveryAddress}
            </div>
          )}
          {order.notes && (
            <div className="col-span-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Piezīmes
              </p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buyer */}
      {order.buyer && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pircējs</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div>
              <Link
                href={`/dashboard/admin/users/${order.buyer.id}`}
                className="font-medium hover:underline flex items-center gap-1"
              >
                {order.buyer.name ?? order.buyer.id}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pozīcijas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase border-b">
                    {['Materiāls', 'Daudzums', 'Vienības cena', 'Summa'].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-4">
                        {item.material?.name ?? '—'}
                        {item.material?.category && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {item.material.category}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums">{euro(item.unitPrice)}</td>
                      <td className="py-2.5 font-semibold tabular-nums">{euro(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transport jobs */}
      {order.transportJobs && order.transportJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Transporta darbi ({order.transportJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {order.transportJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/admin/jobs/${job.id}`}
                      className="font-mono text-sm font-medium hover:underline flex items-center gap-1"
                    >
                      {job.jobNumber}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </Link>
                    <Badge variant="secondary" className="text-xs">
                      {job.jobType}
                    </Badge>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOURS[job.status] ?? 'bg-muted text-foreground'}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {job.driver && (
                      <span>
                        {job.driver.firstName} {job.driver.lastName}
                      </span>
                    )}
                    {job.carrier && <span>{job.carrier.name}</span>}
                    <span className="font-semibold text-foreground tabular-nums">
                      {euro(job.rate, job.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      {order.documents && order.documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dokumenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {order.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {doc.documentType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{fmtDate(doc.createdAt)}</span>
                  </div>
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Skatīt
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Darbības</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
            onClick={() => {
              setForceStatus(order.status);
              setForceStatusOpen(true);
            }}
          >
            Mainīt statusu
          </Button>
          {isCancellable && (
            <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              Atcelt pasūtījumu
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Force Status dialog */}
      <Dialog open={forceStatusOpen} onOpenChange={setForceStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mainīt pasūtījuma statusu</DialogTitle>
            <DialogDescription>
              {order.orderNumber} · Pašreizējais statuss: <strong>{order.status}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Jaunais statuss</Label>
              <Select value={forceStatus} onValueChange={setForceStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Izvēlēties statusu..." />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'DRAFT',
                    'PENDING',
                    'CONFIRMED',
                    'IN_PROGRESS',
                    'DELIVERED',
                    'COMPLETED',
                    'CANCELLED',
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="force-order-reason">Iemesls</Label>
              <Textarea
                id="force-order-reason"
                value={forceStatusReason}
                onChange={(e) => setForceStatusReason(e.target.value)}
                rows={3}
                placeholder="Admin piezīme par statusa maiņas iemeslu..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setForceStatusOpen(false)}
              disabled={forcingStatus}
            >
              Atcelt
            </Button>
            <Button
              onClick={handleForceStatus}
              disabled={forcingStatus || !forceStatus}
              variant="destructive"
            >
              Apstiprināt maiņu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atcelt pasūtījumu {order.orderNumber}</DialogTitle>
            <DialogDescription>
              Šī darbība ir neatgriezeniska. Lūdzu, norādiet iemeslu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Iemesls</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Norādiet atcelšanas iemeslu..."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Atcelt
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling || !cancelReason.trim()}
            >
              Atcelt pasūtījumu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
