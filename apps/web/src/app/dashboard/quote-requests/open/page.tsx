/**
 * Open quote requests page — /dashboard/quote-requests/open
 * Marketplace view of all active RFQs a supplier or carrier can respond to.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, MessageSquare, MapPin, Package, Clock3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import {
  getOpenQuoteRequests,
  respondToQuoteRequest,
  type QuoteRequest,
  type MaterialCategory,
  type MaterialUnit,
  type CreateQuoteResponseInput,
} from '@/lib/api';
import { fmtDate } from '@/lib/format';

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_LV: Record<MaterialCategory, string> = {
  SAND: 'Smiltis',
  GRAVEL: 'Grants',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Augsne',
  RECYCLED_CONCRETE: 'Pārstrādāts betons',
  RECYCLED_SOIL: 'Pārstrādāta augsne',
  ASPHALT: 'Asfalt',
  CLAY: 'Māls',
  OTHER: 'Cits',
};

const UNIT_LV: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krava',
};

const UNITS: MaterialUnit[] = ['TONNE', 'M3', 'PIECE', 'LOAD'];
type QuickFilter = 'ALL' | 'NEW' | 'NO_OFFERS' | 'WITH_NOTES';

const NEW_REQUEST_WINDOW_HOURS = 24;

const hoursSince = (dateIso: string) => {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
};

const getRelativeRequestedLabel = (dateIso: string) => {
  const h = hoursSince(dateIso);
  if (h < 1) return 'pirms mazāk nekā 1h';
  if (h < 24) return `pirms ${h}h`;
  const d = Math.floor(h / 24);
  return `pirms ${d} d.`;
};

const isNewRequest = (request: QuoteRequest) => hoursSince(request.createdAt) <= NEW_REQUEST_WINDOW_HOURS;

// ── Respond slide-over ────────────────────────────────────────────────────────

interface RespondPanelProps {
  request: QuoteRequest;
  token: string;
  onClose: () => void;
  onResponded: (updated: QuoteRequest) => void;
}

function RespondPanel({ request, token, onClose, onResponded }: RespondPanelProps) {
  const [form, setForm] = useState<CreateQuoteResponseInput>({
    pricePerUnit: 0,
    unit: request.unit,
    etaDays: 1,
    notes: '',
    validUntil: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateQuoteResponseInput, v: CreateQuoteResponseInput[typeof k]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pricePerUnit || form.pricePerUnit <= 0) {
      setError('Ievadiet derīgu cenu');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: CreateQuoteResponseInput = {
        pricePerUnit: form.pricePerUnit,
        unit: form.unit,
        etaDays: form.etaDays,
      };
      if (form.notes?.trim()) payload.notes = form.notes;
      if (form.validUntil?.trim()) payload.validUntil = form.validUntil;
      const updated = await respondToQuoteRequest(request.id, payload, token);
      onResponded(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda nosūtot piedāvājumu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold">Sniegt Piedāvājumu</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {request.requestNumber} · {request.materialName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Request summary */}
        <div className="px-6 py-3 bg-slate-50 text-xs text-slate-600 border-b space-y-1">
          <p>
            <span className="font-medium">Pieprasīts:</span> {request.quantity}{' '}
            {UNIT_LV[request.unit]} {request.materialName}
          </p>
          <p>
            <span className="font-medium">Piegāde:</span> {request.deliveryAddress},{' '}
            {request.deliveryCity}
          </p>
          {request.notes && (
            <p>
              <span className="font-medium">Piezīmes:</span> {request.notes}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Price + unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cena (EUR) *</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={form.pricePerUnit}
                onChange={(e) => set('pricePerUnit', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Par mērvienību *
              </label>
              <select
                value={form.unit}
                onChange={(e) => set('unit', e.target.value as MaterialUnit)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LV[u]} ({u})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ETA */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Piegādes laiks (dienas) *
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={form.etaDays}
              onChange={(e) => set('etaDays', parseInt(e.target.value, 10))}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Valid until */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Piedāvājuma derīgums (neobligāts)
            </label>
            <input
              type="date"
              value={form.validUntil ?? ''}
              onChange={(e) => set('validUntil', e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Piezīmes (neobligāts)
            </label>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Pieejamība, minimālais pasūtījums u.c."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={onClose}>
              Atcelt
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Sūta...' : 'Nosūtīt Piedāvājumu'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

interface OpenRequestCardProps {
  request: QuoteRequest;
  onRespond: (req: QuoteRequest) => void;
}

function OpenRequestCard({ request, onRespond }: OpenRequestCardProps) {
  const responseCount = request.responses.length;
  const isNew = isNewRequest(request);

  return (
    <Card className="border-border/60 bg-card py-0 shadow-none transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              {request.requestNumber}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              <Package className="h-3 w-3" />
              {CATEGORY_LV[request.materialCategory]}
            </Badge>
            {isNew && (
              <Badge className="text-[11px] bg-emerald-600 text-white hover:bg-emerald-600">
                <Sparkles className="h-3 w-3" /> Jauns
              </Badge>
            )}
            {responseCount > 0 && (
              <Badge variant="outline" className="text-[11px]">
                {responseCount} piedāvājum{responseCount === 1 ? 's' : 'i'}
              </Badge>
            )}
          </div>

          <p className="text-base font-semibold text-slate-900 leading-tight">
            {request.quantity} {UNIT_LV[request.unit]} {request.materialName}
          </p>

          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {request.deliveryAddress}, {request.deliveryCity}
          </div>

          {request.notes && (
            <p className="text-xs text-slate-500 mt-1 italic">&quot;{request.notes}&quot;</p>
          )}

          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Clock3 className="h-3 w-3" />
            Pieprasīts {fmtDate(request.createdAt)} ({getRelativeRequestedLabel(request.createdAt)})
          </p>
        </div>

        <div className="shrink-0 flex items-center">
          <Button size="sm" className="min-w-32" onClick={() => onRespond(request)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Piedāvāt Cenu
          </Button>
        </div>
      </div>
      </CardContent>
    </Card>
  );
}

function RequestCardSkeleton() {
  return (
    <Card className="border-border/60 py-0 shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-5 w-72" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OpenQuoteRequestsPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<QuoteRequest | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuickFilter>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getOpenQuoteRequests(token);
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

  const handleResponded = (updated: QuoteRequest) => {
    setResponding(null);
    setSuccessId(updated.id);
    // Remove from list (no longer "open" after responding)
    setRequests((prev) => prev.filter((r) => r.id !== updated.id));
    setTimeout(() => setSuccessId(null), 3000);
  };

  const safeRequests = Array.isArray(requests) ? requests : [];
  const newRequestsCount = safeRequests.filter((r) => isNewRequest(r)).length;
  const noOfferCount = safeRequests.filter((r) => r.responses.length === 0).length;

  const filteredRequests = safeRequests
    .filter((r) => {
      if (filter === 'NEW') return isNewRequest(r);
      if (filter === 'NO_OFFERS') return r.responses.length === 0;
      if (filter === 'WITH_NOTES') return Boolean(r.notes?.trim());
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <PageHeader
        title="Atvērtie Pieprasījumi"
        description="Iesniedziet cenu piedāvājumus pasūtītājiem"
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atjaunot
          </Button>
        }
      />

      {/* Success toast */}
      {successId && (
        <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm font-medium">
          ✓ Piedāvājums veiksmīgi nosūtīts!
        </div>
      )}

      {!loading && !error && safeRequests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              variant={filter === 'ALL' ? 'default' : 'outline'}
              onClick={() => setFilter('ALL')}
            >
              Visi ({safeRequests.length})
            </Button>
            <Button
              size="xs"
              variant={filter === 'NEW' ? 'default' : 'outline'}
              onClick={() => setFilter('NEW')}
            >
              Jaunie ({newRequestsCount})
            </Button>
            <Button
              size="xs"
              variant={filter === 'NO_OFFERS' ? 'default' : 'outline'}
              onClick={() => setFilter('NO_OFFERS')}
            >
              Bez piedāvājumiem ({noOfferCount})
            </Button>
            <Button
              size="xs"
              variant={filter === 'WITH_NOTES' ? 'default' : 'outline'}
              onClick={() => setFilter('WITH_NOTES')}
            >
              Ar piezīmēm
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Rādām {filteredRequests.length} pieprasījumus</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          <RequestCardSkeleton />
          <RequestCardSkeleton />
          <RequestCardSkeleton />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
          <Button variant="outline" size="sm" className="mt-3 block mx-auto" onClick={load}>
            Mēģināt vēlreiz
          </Button>
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nav pieprasījumu šim filtram"
          description="Pamēģiniet citu filtru vai atjaunojiet datus, lai redzētu jaunākos pieprasījumus."
          action={
            <Button variant="outline" size="sm" onClick={() => setFilter('ALL')}>
              Rādīt visus
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((r) => (
            <OpenRequestCard key={r.id} request={r} onRespond={setResponding} />
          ))}
        </div>
      )}

      {/* Respond panel */}
      {responding && token && (
        <RespondPanel
          request={responding}
          token={token}
          onClose={() => setResponding(null)}
          onResponded={handleResponded}
        />
      )}
    </div>
  );
}
