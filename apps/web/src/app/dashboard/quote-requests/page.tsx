/**
 * Quote requests page — /dashboard/quote-requests
 * Lists the buyer's RFQs. Tapping a card navigates to /dashboard/quote-requests/[id]
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Package,
  Truck,
  Archive,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/page-spinner';
import { useAuth } from '@/lib/auth-context';
import { getMyQuoteRequests, type QuoteRequest } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { CATEGORY_LABELS, UNIT_SHORT } from '@b3hub/shared';

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_LV = CATEGORY_LABELS;
const UNIT_LV = UNIT_SHORT;

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

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' }).format(n);
}

// ── Request card ──────────────────────────────────────────────────────────────

interface RequestCardProps {
  request: QuoteRequest;
}

function RequestCard({ request }: RequestCardProps) {
  const router = useRouter();
  const cfg = STATUS_CFG[request.status] ?? STATUS_CFG.PENDING;

  return (
    <button
      type="button"
      onClick={() => router.push(`/dashboard/quote-requests/${request.id}`)}
      className="w-full text-left bg-card md:rounded-xl border border-border/40 hover:border-border/70 hover:bg-muted/10 overflow-hidden transition-all duration-150 mb-3 relative group"
    >
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Material */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-muted text-foreground">
            <Package className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground truncate tracking-tight">
              {request.materialName || CATEGORY_LV[request.materialCategory]}
            </p>
            <p className="text-[13px] font-medium text-muted-foreground mt-0.5">
              {request.quantity} <span className="uppercase">{UNIT_LV[request.unit]}</span>
              {' · '}
              {CATEGORY_LV[request.materialCategory]}
            </p>
          </div>
        </div>

        {/* Route */}
        <div className="flex flex-col justify-center relative pl-8 sm:pl-0 sm:flex-1">
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full border-2 border-foreground/30 shrink-0 bg-card z-10" />
            <p className="text-[13px] text-foreground font-medium truncate leading-none">
              {request.deliveryCity}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="size-2.5 rounded-full bg-foreground shrink-0 z-10 ring-4 ring-card" />
            <p className="text-[13px] text-muted-foreground truncate leading-none font-medium">
              {request.deliveryAddress}
            </p>
          </div>
          <div className="absolute w-0.5 bg-border/40 left-[0.27rem] top-3 bottom-3 z-0 group-hover:bg-border/60 transition-colors" />
        </div>

        {/* Status + arrow */}
        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}
            >
              {cfg.label}
            </span>
            {request.responses.length > 0 && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                {request.responses.length} piedāvājum{request.responses.length === 1 ? 's' : 'i'}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground/60 font-medium">
              {fmtDate(request.createdAt)}
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground/60 transition-colors shrink-0" />
        </div>
      </div>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuoteRequestsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const goToWizard = () => router.push('/dashboard/catalog');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyQuoteRequests(token);
      setRequests(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kļūda ielādējot datus');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'QUOTED').length;
  const accepted = requests.filter((r) => r.status === 'ACCEPTED').length;

  return (
    <div className="w-full max-w-5xl mx-auto h-full pb-20 space-y-8 px-4 sm:px-6 md:px-8 pt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-border/30 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Cenu pieprasījumi
          </h1>
          <p className="text-[14px] font-medium text-muted-foreground mt-2 max-w-md">
            Iegūsti labākos piedāvājumus no piegādātājiem.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-10 px-4 rounded-lg border-border/60 bg-transparent hover:bg-muted/50 text-foreground font-semibold shadow-none text-[13px]"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atjaunot</span>
          </Button>
          <Button
            size="sm"
            onClick={goToWizard}
            className="h-10 px-5 rounded-lg bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-none text-[13px]"
          >
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Jauns Pieprasījums</span>
            <span className="sm:hidden">Pieprasīt</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {requests.length > 0 && !error && (
        <div className="flex flex-wrap gap-x-12 gap-y-5 pb-4 border-b border-border/20">
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest">
              Visi
            </p>
            <p className="text-3xl font-medium text-foreground tracking-tight">{requests.length}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest">
              Aktīvie
            </p>
            <p className="text-3xl font-medium text-foreground tracking-tight">{pending}</p>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-widest">
              Izvēlētie
            </p>
            <p className="text-3xl font-medium text-foreground tracking-tight">{accepted}</p>
          </div>
        </div>
      )}

      {loading ? (
        <PageSpinner className="h-64" />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-sm">
          <XCircle className="h-10 w-10 text-destructive/80 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-destructive">{error}</p>
          <Button
            variant="outline"
            className="mt-5 rounded-lg bg-background border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold h-9 px-4 text-[13px]"
            onClick={load}
          >
            Mēģināt vēlreiz
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="py-32 text-center flex flex-col items-center">
          <div className="h-20 w-20 bg-muted/30 text-muted-foreground/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-border/30">
            <Package className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Nav neviena pieprasījuma
          </h2>
          <p className="text-[14.5px] text-muted-foreground mt-2 max-w-sm mx-auto">
            Izveidojiet jaunu pieprasījumu, lai saņemtu labākos piedāvājumus.
          </p>
          <Button
            onClick={goToWizard}
            className="mt-8 rounded-lg h-11 px-6 bg-foreground text-background font-semibold text-[14px] shadow-none hover:bg-foreground/90 mx-auto flex"
          >
            <Plus className="h-4 w-4 mr-2" />
            Izveidot Pieprasījumu
          </Button>
        </div>
      ) : (
        <div className="flex flex-col mt-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </div>
  );
}
