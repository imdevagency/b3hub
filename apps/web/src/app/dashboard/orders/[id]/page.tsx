/**
 * Order detail page — /dashboard/orders/[id]
 * Full detail view for a single material order: items, status, transport tracking, payment, disputes.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

const TrackingMap = dynamic(() => import('@/components/tracking/TrackingMap'), {
  ssr: false,
  loading: () => <div className="rounded-2xl bg-slate-100 animate-pulse" style={{ height: 360 }} />,
});
import { getOrder, type ApiOrder } from '@/lib/api/orders';
import {
  getTransportJob,
  getTransportJobLocation,
  createPaymentIntent,
  type ApiTransportJob,
  type TransportJobLocation,
  type TransportJobStatus,
} from '@/lib/api';
import {
  createDispute,
  listDisputes,
  DISPUTE_REASON_LABELS,
  DISPUTE_STATUS_LABELS,
  getDisputeStatusColor,
  type DisputeReason,
  type ApiDispute,
} from '@/lib/api/disputes';
import { fmtDate } from '@/lib/format';
import { ORDER_STATUS } from '@/lib/status-config';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  CreditCard,
  Package,
  Phone,
  Truck,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/page-spinner';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('lv-LV', { hour: '2-digit', minute: '2-digit' });
}

const UNIT_LABELS: Record<string, string> = {
  TONNE: 't',
  KG: 'kg',
  M3: 'm³',
  M2: 'm²',
  M: 'm',
  PIECE: 'gab.',
  PALLET: 'pal.',
};

const JOB_STATUS_CFG: Record<TransportJobStatus, { label: string; bg: string; text: string }> = {
  AVAILABLE: { label: 'Pieejams', bg: '#f0fdf4', text: '#166534' },
  ASSIGNED: { label: 'Piešķirts', bg: '#e0e7ff', text: '#4338ca' },
  ACCEPTED: { label: 'Pieņemts', bg: '#dbeafe', text: '#1d4ed8' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz iek.', bg: '#fef3c7', text: '#b45309' },
  AT_PICKUP: { label: 'Uz iekr. vietu', bg: '#fce7f3', text: '#be185d' },
  LOADED: { label: 'Iekrauts', bg: '#e0e7ff', text: '#4338ca' },
  EN_ROUTE_DELIVERY: { label: 'Piegādē', bg: '#fef3c7', text: '#b45309' },
  AT_DELIVERY: { label: 'Atvedis', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [job, setJob] = useState<ApiTransportJob | null>(null);
  const [location, setLocation] = useState<TransportJobLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentInitLoading, setPaymentInitLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Dispute state
  const [existingDispute, setExistingDispute] = useState<ApiDispute | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState<DisputeReason | ''>('');
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived truck position from location poll
  const truckPos = location?.currentLocation ?? null;

  // Fetch order then optionally the transport job
  const loadData = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      const ord = await getOrder(id, token);
      setOrder(ord);
      // Load any existing dispute for this order
      try {
        const disputes = await listDisputes(token, id);
        if (disputes.length > 0) setExistingDispute(disputes[0]);
      } catch {
        // non-critical
      }
      // Load the first transport job if one exists
      if (ord.transportJobs && ord.transportJobs.length > 0) {
        try {
          const j = await getTransportJob(ord.transportJobs[0].id, token);
          setJob(j);
        } catch {
          // non-critical — order can exist without a finalized job
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda ielādējot pasūtījumu');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  // Poll location only once we know the job id
  const pollLocation = useCallback(async () => {
    if (!token || !job?.id) return;
    try {
      const data = await getTransportJobLocation(job.id, token);
      setLocation(data);
      setLastPoll(new Date());
    } catch {
      // silently ignore poll errors
    }
  }, [token, job?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!job) return;
    pollLocation();
    pollTimer.current = setInterval(pollLocation, 10_000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [job, pollLocation]);

  if (loading) {
    return <PageSpinner className="min-h-[60vh]" />;
  }

  if (error || !order) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="mb-4">{error ?? 'Pasūtījums nav atrasts'}</p>
        <Button variant="link" onClick={() => router.back()} className="text-sm">
          ← Atpakaļ
        </Button>
      </div>
    );
  }

  const isJobLive = job?.status === 'EN_ROUTE_PICKUP' || job?.status === 'EN_ROUTE_DELIVERY';
  const orderStatusCfg = ORDER_STATUS[order.status] ?? {
    label: order.status,
    bg: '#f1f5f9',
    text: '#475569',
  };

  const handleStartPayment = async () => {
    if (!token) return;
    setPaymentInitLoading(true);
    setPaymentError(null);
    try {
      const payment = await createPaymentIntent(order.id, token);
      setStripePromise(loadStripe(payment.publishableKey));
      setPaymentClientSecret(payment.clientSecret);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Neizdevās uzsākt maksājumu');
    } finally {
      setPaymentInitLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">
            {fmtDate(order.createdAt)}
            {order.deliveryCity ? ` · ${order.deliveryCity}` : ''}
          </p>
        </div>
        <div className="ml-auto">
          <span
            style={{ backgroundColor: orderStatusCfg.bg, color: orderStatusCfg.text }}
            className="inline-block rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap border border-black/5"
          >
            {orderStatusCfg.label}
          </span>
        </div>
      </div>

      {/* ── Order items ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">Pasūtītās preces</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Materiāls
              </th>
              <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Daudzums
              </th>
              <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cena/vienība
              </th>
              <th className="text-right pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Kopā
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {order.items.map((item, i) => (
              <tr key={i}>
                <td className="py-2.5">
                  <p className="font-medium text-slate-900">{item.material.name}</p>
                  <p className="text-xs text-slate-400">{item.material.category}</p>
                </td>
                <td className="py-2.5 text-right text-slate-700">
                  {item.quantity} {UNIT_LABELS[item.unit] ?? item.unit}
                </td>
                <td className="py-2.5 text-right text-slate-500">
                  {item.unitPrice.toFixed(2)} {order.currency}
                </td>
                <td className="py-2.5 text-right font-semibold text-slate-900">
                  {item.total.toFixed(2)} {order.currency}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200">
              <td colSpan={3} className="pt-3 text-sm font-semibold text-slate-700 text-right pr-4">
                Kopā
              </td>
              <td className="pt-3 text-right font-bold text-slate-900">
                {order.total.toFixed(2)} {order.currency}
              </td>
            </tr>
          </tfoot>
        </table>
        {order.surcharges && order.surcharges.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            {order.surcharges.map((s) => (
              <div key={s.id} className="flex justify-between text-xs text-slate-500">
                <span>{s.label}</span>
                <span className="font-medium">
                  {s.amount.toFixed(2)} {order.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Delivery info ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Piegādes informācija</h2>
        <div className="flex gap-3">
          <div className="pt-1">
            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
          </div>
          <div>
            <p className="text-sm text-slate-900 font-medium">{order.deliveryAddress}</p>
            <p className="text-xs text-slate-500">{order.deliveryCity}</p>
            {order.deliveryDate && (
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                {fmtDate(order.deliveryDate)}
              </div>
            )}
          </div>
        </div>
        {(order.siteContactName || order.siteContactPhone) && (
          <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
            <div className="p-2 bg-green-50 rounded-xl">
              <Phone className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Objekta kontaktpersona</p>
              {order.siteContactName && (
                <p className="text-sm font-medium text-slate-900">{order.siteContactName}</p>
              )}
              {order.siteContactPhone && (
                <a
                  href={`tel:${order.siteContactPhone}`}
                  className="text-xs text-green-600 hover:underline font-medium"
                >
                  {order.siteContactPhone}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Transport / Live tracking ── */}
      {job && (
        <div className="space-y-4">
          {/* Job status row */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Truck className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pārvadājums</p>
                <p className="text-sm font-medium text-slate-900">{job.jobNumber}</p>
              </div>
            </div>
            {(() => {
              const cfg = JOB_STATUS_CFG[job.status] ?? {
                label: job.status,
                bg: '#f1f5f9',
                text: '#475569',
              };
              return (
                <span
                  style={{ backgroundColor: cfg.bg, color: cfg.text }}
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
                >
                  {cfg.label}
                </span>
              );
            })()}
          </div>

          {/* Driver & vehicle */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <User className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Vadītājs</p>
                {job.driver ? (
                  <>
                    <p className="text-sm font-medium text-slate-900">
                      {job.driver.firstName} {job.driver.lastName}
                    </p>
                    {job.driver.phone && (
                      <a
                        href={`tel:${job.driver.phone}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {job.driver.phone}
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Nav piešķirts</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Truck className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Transportlīdzeklis</p>
                {job.vehicle ? (
                  <>
                    <p className="text-sm font-medium text-slate-900">{job.vehicle.vehicleType}</p>
                    <p className="text-xs text-slate-500">{job.vehicle.licensePlate}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Nav piešķirts</p>
                )}
              </div>
            </div>
          </div>

          {/* Live map */}
          <div>
            <TrackingMap
              token={token ?? undefined}
              pickupLat={location?.pickupLat ?? job.pickupLat}
              pickupLng={location?.pickupLng ?? job.pickupLng}
              pickupAddress={job.pickupAddress}
              deliveryLat={location?.deliveryLat ?? job.deliveryLat}
              deliveryLng={location?.deliveryLng ?? job.deliveryLng}
              deliveryAddress={job.deliveryAddress}
              truckPos={truckPos}
              isLive={isJobLive}
            />
            {lastPoll && (
              <p className="text-xs text-slate-400 mt-1.5 text-right pr-1">
                GPS atjaunots {fmtTime(lastPoll.toISOString())} · atsvaidzina ik 10s
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Dispute / Report issue ── */}
      {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-700">Sūdzība / Problēma</h2>
          </div>

          {existingDispute ? (
            <div className="space-y-2">
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getDisputeStatusColor(existingDispute.status)}`}
              >
                {DISPUTE_STATUS_LABELS[existingDispute.status]}
              </div>
              <p className="text-sm text-slate-700 font-medium">
                {DISPUTE_REASON_LABELS[existingDispute.reason]}
              </p>
              {existingDispute.description && (
                <p className="text-sm text-slate-500">{existingDispute.description}</p>
              )}
              {existingDispute.resolution && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                  <span className="font-semibold">Lēmums: </span>
                  {existingDispute.resolution}
                </div>
              )}
            </div>
          ) : showDisputeForm ? (
            <div className="space-y-3">
              <div className="space-y-2">
                {(Object.keys(DISPUTE_REASON_LABELS) as DisputeReason[]).map((key) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="dispute-reason"
                      value={key}
                      checked={disputeReason === key}
                      onChange={() => setDisputeReason(key)}
                      className="accent-slate-900"
                    />
                    <span
                      className={`text-sm ${disputeReason === key ? 'text-slate-900 font-medium' : 'text-slate-600'}`}
                    >
                      {DISPUTE_REASON_LABELS[key]}
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                rows={3}
                placeholder="Papildu informācija (neobligāts)..."
                value={disputeDetails}
                onChange={(e) => setDisputeDetails(e.target.value)}
              />
              {disputeError && <p className="text-sm text-red-600">{disputeError}</p>}
              <div className="flex gap-2">
                <Button
                  disabled={!disputeReason || disputeLoading}
                  onClick={async () => {
                    if (!disputeReason || !token) return;
                    setDisputeLoading(true);
                    setDisputeError(null);
                    try {
                      const created = await createDispute(
                        {
                          orderId: order.id,
                          reason: disputeReason,
                          description: disputeDetails || DISPUTE_REASON_LABELS[disputeReason],
                        },
                        token,
                      );
                      setExistingDispute(created);
                      setShowDisputeForm(false);
                    } catch (err: unknown) {
                      setDisputeError(
                        err instanceof Error ? err.message : 'Neizdevās iesniegt sūdzību',
                      );
                    } finally {
                      setDisputeLoading(false);
                    }
                  }}
                >
                  {disputeLoading ? 'Iesniedz...' : 'Iesniegt sūdzību'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDisputeForm(false);
                    setDisputeError(null);
                  }}
                >
                  Atcelt
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">
                Piegāde saņemta? Ja ir problēma ar kravas daudzumu, kvalitāti vai bojājumu —
                iesniedz sūdzību.
              </p>
              <Button variant="outline" size="sm" onClick={() => setShowDisputeForm(true)}>
                <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-500" />
                Ziņot par problēmu
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Cancelled banner ── */}
      {order.status === 'CANCELLED' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-xl shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Pasūtījums atcelts</p>
            <p className="text-xs text-red-600 mt-0.5">
              Šis pasūtījums vairs nav aktīvs. Ja nepieciešams, varat izveidot jaunu pasūtījumu.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-red-200 text-red-700 hover:bg-red-100"
              onClick={() => router.push('/dashboard/order/material')}
            >
              Izveidot jaunu pasūtījumu
            </Button>
          </div>
        </div>
      )}

      {/* ── Payment ── */}
      {order.status !== 'CANCELLED' &&
        order.status !== 'COMPLETED' &&
        order.status !== 'DELIVERED' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">Maksājums</h2>
            {order.paymentMethod === 'INVOICE' ? (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <CreditCard className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Rēķins</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Šis pasūtījums tiks apmaksāts ar rēķinu.
                    {order.invoiceDueDate
                      ? ` Apmaksas termiņš: ${fmtDate(order.invoiceDueDate)}.`
                      : ''}
                  </p>
                </div>
              </div>
            ) : order.paymentStatus === 'PAID' ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CreditCard className="h-4 w-4 shrink-0" />
                <span className="font-medium">Apmaksāts</span>
              </div>
            ) : !paymentClientSecret || !stripePromise ? (
              <Button onClick={handleStartPayment} disabled={paymentInitLoading} className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                {paymentInitLoading ? 'Sagatavo maksājumu...' : 'Apmaksāt pasūtījumu'}
              </Button>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret: paymentClientSecret }}>
                <InlinePaymentForm
                  onError={setPaymentError}
                  onSuccess={async () => {
                    setPaymentError(null);
                    await loadData();
                  }}
                />
              </Elements>
            )}
            {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
          </div>
        )}
    </div>
  );
}

// ── Inline payment form ───────────────────────────────────────────────────────

function InlinePaymentForm({
  onError,
  onSuccess,
}: {
  onError: (message: string | null) => void;
  onSuccess: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError(null);
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (result.error) {
      onError(result.error.message ?? 'Maksājums neizdevās');
      setSubmitting(false);
      return;
    }

    const status = result.paymentIntent?.status;
    if (status === 'succeeded' || status === 'processing' || status === 'requires_capture') {
      await onSuccess();
      setSubmitting(false);
      return;
    }

    onError('Maksājuma statuss nav apstiprināts. Lūdzu mēģiniet vēlreiz.');
    setSubmitting(false);
  };

  return (
    <div className="space-y-3">
      <PaymentElement />
      <Button
        onClick={handleConfirm}
        disabled={!stripe || !elements || submitting}
        className="w-full"
      >
        {submitting ? 'Apstrādā...' : 'Apstiprināt maksājumu'}
      </Button>
    </div>
  );
}
