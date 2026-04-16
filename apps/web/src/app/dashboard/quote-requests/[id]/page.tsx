/**
 * Quote request detail page — /dashboard/quote-requests/[id]
 * Shows the full spec for a single RFQ plus ranked supplier responses.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  Truck,
  Archive,
  Star,
  MapPin,
  CalendarDays,
  Hash,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/page-spinner';
import { useAuth } from '@/lib/auth-context';
import {
  getQuoteRequest,
  acceptQuoteResponse,
  type QuoteRequest,
  type QuoteResponse,
} from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { CATEGORY_LABELS, UNIT_SHORT } from '@b3hub/shared';

const CATEGORY_LV = CATEGORY_LABELS;
const UNIT_LV = UNIT_SHORT;

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' }).format(n);
}

const STATUS_CFG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  PENDING: {
    label: 'Meklē piedāvājumus',
    icon: Clock,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  QUOTED: {
    label: 'Saņemti piedāvājumi',
    icon: Truck,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  ACCEPTED: {
    label: 'Apstiprināts',
    icon: CheckCircle2,
    color: 'text-foreground',
    bg: 'bg-muted/50',
  },
  CANCELLED: {
    label: 'Atcelts',
    icon: XCircle,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30',
  },
  EXPIRED: {
    label: 'Beidzies',
    icon: Archive,
    color: 'text-muted-foreground',
    bg: 'bg-muted/30',
  },
};

// ── Response card ─────────────────────────────────────────────────────────────

function ResponseCard({
  resp,
  canAccept,
  onAccept,
  accepting,
}: {
  resp: QuoteResponse;
  canAccept: boolean;
  onAccept: (id: string) => void;
  accepting: string | null;
}) {
  const isAccepted = resp.status === 'ACCEPTED';

  return (
    <div
      className={`relative rounded-xl border overflow-hidden transition-all ${
        isAccepted
          ? 'border-border/60 bg-muted/20'
          : 'border-border/40 bg-card hover:border-border/70'
      }`}
    >
      {isAccepted && (
        <div className="absolute top-0 right-0 bg-foreground text-background text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-bl-xl flex items-center gap-1.5 z-10">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Izvēlēts
        </div>
      )}

      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Supplier info */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="h-12 w-12 shrink-0 border border-border/50 bg-muted/30 rounded-full flex items-center justify-center">
            <Truck className="h-5 w-5 text-foreground/60" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground tracking-tight flex items-center gap-2 flex-wrap">
              {resp.supplier.name}
              {resp.supplier.rating && (
                <span className="flex items-center gap-1 text-[11px] bg-amber-500/10 rounded px-1.5 py-0.5 font-bold text-amber-700 tracking-wide">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  {resp.supplier.rating.toFixed(1)}
                </span>
              )}
            </p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {resp.supplier.city && (
                <span className="text-[12px] text-muted-foreground font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {resp.supplier.city}
                </span>
              )}
              <span className="text-[12px] text-muted-foreground font-medium">
                Piegāde <span className="text-foreground font-semibold">{resp.etaDays}d</span> laikā
              </span>
              {resp.validUntil && (
                <span className="text-[11px] text-muted-foreground/70">
                  Derīgs līdz {fmtDate(resp.validUntil)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Price + action */}
        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 sm:pl-6 sm:border-l border-border/30">
          <div className="text-left sm:text-right">
            <p className="text-2xl font-semibold text-foreground tracking-tight leading-none">
              {fmtEur(resp.pricePerUnit)}
              <span className="text-[14px] font-normal text-muted-foreground ml-1">
                / {UNIT_LV[resp.unit]}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 uppercase font-bold tracking-widest">
              Cena ar piegādi
            </p>
          </div>

          {canAccept && !isAccepted && (
            <Button
              onClick={() => onAccept(resp.id)}
              disabled={accepting === resp.id}
              className="h-10 px-5 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-none text-[14px] shrink-0"
            >
              {accepting === resp.id ? 'Pieņem...' : 'Izvēlēties'}
            </Button>
          )}
        </div>
      </div>

      {resp.notes && (
        <div className="mx-5 mb-5 bg-muted/30 rounded border border-border/40 px-3 py-2.5 text-[13px] text-muted-foreground">
          <span className="uppercase text-[10px] font-bold tracking-widest text-foreground/60 block mb-1">
            Piegādātāja piezīmes
          </span>
          {resp.notes}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuoteRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [request, setRequest] = useState<QuoteRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getQuoteRequest(id, token);
      setRequest(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (responseId: string) => {
    if (!token || !id) return;
    setAccepting(responseId);
    try {
      const order = await acceptQuoteResponse(id, responseId, token);
      router.push(`/dashboard/orders/${order.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Kļūda pieņemot piedāvājumu');
    } finally {
      setAccepting(null);
    }
  };

  if (loading) return <PageSpinner className="h-96" />;

  if (error || !request) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Atpakaļ
        </button>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-10 text-center">
          <XCircle className="h-10 w-10 text-destructive/60 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-destructive">
            {error ?? 'Pieprasījums nav atrasts'}
          </p>
          <Button
            variant="outline"
            className="mt-6 rounded-lg border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold shadow-none text-[13px]"
            onClick={load}
          >
            Mēģināt vēlreiz
          </Button>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CFG[request.status] ?? STATUS_CFG.PENDING;
  const canAccept = request.status === 'PENDING' || request.status === 'QUOTED';

  // Sort: ACCEPTED first, then by price ascending
  const sortedResponses = [...request.responses].sort((a, b) => {
    if (a.status === 'ACCEPTED') return -1;
    if (b.status === 'ACCEPTED') return 1;
    return a.pricePerUnit - b.pricePerUnit;
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-8 pb-24 space-y-8">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Cenu pieprasījumi
      </button>

      {/* Header */}
      <div className="border-b border-border/30 pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {request.materialName || CATEGORY_LV[request.materialCategory]}
            </h1>
            <p className="text-[14px] text-muted-foreground font-medium mt-1">
              {request.quantity} <span className="uppercase">{UNIT_LV[request.unit]}</span>
              {' · '}
              {CATEGORY_LV[request.materialCategory]}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shrink-0 ${cfg.bg} ${cfg.color}`}
          >
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5 pb-6 border-b border-border/20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
            <Hash className="h-3 w-3" /> Pieprasījuma Nr.
          </p>
          <p className="text-[14px] font-semibold text-foreground font-mono tracking-wide">
            {request.requestNumber}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
            <CalendarDays className="h-3 w-3" /> Izveidots
          </p>
          <p className="text-[14px] font-semibold text-foreground">{fmtDate(request.createdAt)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
            <Truck className="h-3 w-3" /> Piedāvājumi
          </p>
          <p className="text-[14px] font-semibold text-foreground">
            {request.responses.length > 0 ? `${request.responses.length} saņemts` : 'Vēl nav'}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
            <MapPin className="h-3 w-3" /> Piegādes vieta
          </p>
          <div className="relative pl-6">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="absolute left-0 size-2.5 rounded-full border-2 border-foreground/30 bg-card" />
              <p className="text-[14px] font-semibold text-foreground">{request.deliveryCity}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="absolute left-0 size-2.5 rounded-full bg-foreground ring-4 ring-card" />
              <p className="text-[14px] text-muted-foreground font-medium">
                {request.deliveryAddress}
              </p>
            </div>
            <div className="absolute left-[0.28rem] top-2.5 bottom-2.5 w-0.5 bg-border/40" />
          </div>
        </div>
        {request.notes && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
              <StickyNote className="h-3 w-3" /> Piezīmes
            </p>
            <p className="text-[14px] text-foreground/80">{request.notes}</p>
          </div>
        )}
      </div>

      {/* Responses */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          {request.responses.length > 0
            ? `${request.responses.length} Piegādātāja piedāvājum${request.responses.length === 1 ? 's' : 'i'}`
            : 'Piegādātāji'}
        </h2>

        {request.responses.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center border border-border/40 rounded-xl">
            <Truck className="mb-4 h-10 w-10 text-muted-foreground/25" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-foreground tracking-tight">
              Gaidām piedāvājumus
            </p>
            <p className="mt-1.5 text-[13px] text-muted-foreground max-w-70">
              Piegādātāji sagatavo cenas. Tiklīdz tās tiks iesniegtas, tās parādīsies šeit.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedResponses.map((resp) => (
              <ResponseCard
                key={resp.id}
                resp={resp}
                canAccept={canAccept}
                onAccept={handleAccept}
                accepting={accepting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
