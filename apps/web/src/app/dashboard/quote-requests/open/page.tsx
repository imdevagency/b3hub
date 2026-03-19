/**
 * Open quote requests page — /dashboard/quote-requests/open
 * Marketplace view of all active RFQs a supplier or carrier can respond to.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, MessageSquare, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-muted-foreground">{request.requestNumber}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-xs font-medium">
              <Package className="h-3 w-3" />
              {CATEGORY_LV[request.materialCategory]}
            </span>
            {responseCount > 0 && (
              <span className="text-xs text-slate-500">
                {responseCount} piedāvājum{responseCount === 1 ? 's' : 'i'}
              </span>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-900">
            {request.quantity} {UNIT_LV[request.unit]} {request.materialName}
          </p>

          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {request.deliveryAddress}, {request.deliveryCity}
          </div>

          {request.notes && (
            <p className="text-xs text-slate-500 mt-1 italic">&quot;{request.notes}&quot;</p>
          )}

          <p className="text-[11px] text-muted-foreground/60 mt-2">
            Pieprasīts {fmtDate(request.createdAt)}
          </p>
        </div>

        <div className="shrink-0">
          <Button size="sm" onClick={() => onRespond(request)}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Piedāvāt Cenu
          </Button>
        </div>
      </div>
    </div>
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

  return (
    <div className="space-y-6 max-w-3xl">
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

      {/* Content */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
          <Button variant="outline" size="sm" className="mt-3 block mx-auto" onClick={load}>
            Mēģināt vēlreiz
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground">Nav atvērtu pieprasījumu</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Kad pasūtītāji izveidos jaunus pieprasījumus, tie parādīsies šeit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
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
