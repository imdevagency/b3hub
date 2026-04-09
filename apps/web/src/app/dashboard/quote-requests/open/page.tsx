/**
 * Open quote requests page — /dashboard/quote-requests/open
 * Marketplace view of all active RFQs a supplier or carrier can respond to.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, MessageSquare, MapPin, Package, Clock3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import {
  getOpenQuoteRequests,
  respondToQuoteRequest,
  type QuoteRequest,
  type MaterialUnit,
  type CreateQuoteResponseInput,
} from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { CATEGORY_LABELS, UNIT_SHORT } from '@b3hub/shared';

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_LV = CATEGORY_LABELS;
const UNIT_LV = UNIT_SHORT;

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

const isNewRequest = (request: QuoteRequest) =>
  hoursSince(request.createdAt) <= NEW_REQUEST_WINDOW_HOURS;

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

  const setParams = (k: keyof CreateQuoteResponseInput, v: CreateQuoteResponseInput[typeof k]) =>
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
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col h-full right-0 w-full sm:max-w-md border-l shadow-2xl p-0">
        <div className="flex-1 overflow-y-auto">
          <SheetHeader className="px-6 py-6 border-b">
            <SheetTitle>Sniegt Piedāvājumu</SheetTitle>
            <SheetDescription>
              {request.requestNumber} · {request.materialName}
            </SheetDescription>
          </SheetHeader>

          {/* Request summary */}
          <div className="px-6 py-4 bg-muted/20 text-xs text-muted-foreground space-y-2 border-b">
            <p>
              <span className="font-semibold text-foreground">Pieprasīts:</span> {request.quantity}{' '}
              {UNIT_LV[request.unit]} {request.materialName}
            </p>
            <p>
              <span className="font-semibold text-foreground">Piegāde:</span>{' '}
              {request.deliveryAddress}, {request.deliveryCity}
            </p>
            {request.notes && (
              <p>
                <span className="font-semibold text-foreground">Piezīmes:</span> {request.notes}
              </p>
            )}
          </div>

          {/* Form fields */}
          <form id="respond-form" onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Cena par vienību (€) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.pricePerUnit || ''}
                  onChange={(e) => setParams('pricePerUnit', parseFloat(e.target.value))}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="w-1/3 space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Mērvienība
                </label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setParams('unit', v as MaterialUnit)}
                >
                  <SelectTrigger className="h-11 bg-muted/40 border-transparent transition-all focus:bg-background focus:ring-1 focus:ring-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LV[u]} ({u})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Piegādes laiks (dienas) *
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={form.etaDays || ''}
                onChange={(e) => setParams('etaDays', parseInt(e.target.value, 10))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Derīgums (neobligāts)
              </label>
              <Input
                type="date"
                value={form.validUntil || ''}
                onChange={(e) => setParams('validUntil', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Piezīmes
              </label>
              <Textarea
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setParams('notes', e.target.value)}
                placeholder="Pieejamība, minimālais pasūtījums u.c."
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t shrink-0 flex justify-between items-center bg-card">
          {error ? (
            <p className="text-sm text-red-600 font-medium truncate pr-4">{error}</p>
          ) : (
            <div />
          )}
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
              Atcelt
            </Button>
            <Button type="submit" form="respond-form" disabled={saving}>
              {saving ? 'Sūta...' : 'Piedāvāt'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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
    <Card className="border-transparent bg-muted/40 py-0 shadow-none hover:bg-muted/60 transition-colors">
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
              Pieprasīts {fmtDate(request.createdAt)} (
              {getRelativeRequestedLabel(request.createdAt)})
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
    <Card className="border-transparent bg-muted/40 py-0 shadow-none">
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
    <div className="w-full h-full pb-20 space-y-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Atvērtie Pieprasījumi
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-xl">
            Iesniedziet cenu piedāvājumus reāllaikā un saņemiet pasūtījumus
          </p>
        </div>
        <Button variant="default" className="w-full sm:w-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atjaunot sarakstu
        </Button>
      </div>

      {/* Success toast */}
      {successId && (
        <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm font-medium">
          ✓ Piedāvājums veiksmīgi nosūtīts!
        </div>
      )}

      {!loading && !error && safeRequests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 p-2 border border-transparent">
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
          <p className="text-xs text-muted-foreground">
            Rādām {filteredRequests.length} pieprasījumus
          </p>
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
