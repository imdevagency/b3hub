/**
 * Quote requests page — /dashboard/quote-requests
 * Lists the buyer's RFQs and received offers. Suppliers see open RFQs they can bid on.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth-context';
import {
  getMyQuoteRequests,
  createQuoteRequest,
  acceptQuoteResponse,
  type QuoteRequest,
  type QuoteResponse,
  type MaterialCategory,
  type MaterialUnit,
  type CreateQuoteRequestInput,
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

const STATUS_CFG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  PENDING: {
    label: 'Gaida atbildes',
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  QUOTED: {
    label: 'Ir atbildes',
    icon: MessageSquare,
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
  },
  ACCEPTED: {
    label: 'Pieņemts',
    icon: CheckCircle2,
    color: 'text-green-700',
    bg: 'bg-green-50 border-green-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
  EXPIRED: {
    label: 'Beidzies',
    icon: XCircle,
    color: 'text-slate-600',
    bg: 'bg-slate-50 border-slate-200',
  },
};

function fmtEur(n: number) {
  return new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR' }).format(n);
}

// ── New RFQ modal ─────────────────────────────────────────────────────────────

const CATEGORIES: MaterialCategory[] = [
  'SAND',
  'GRAVEL',
  'STONE',
  'CONCRETE',
  'SOIL',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'ASPHALT',
  'CLAY',
  'OTHER',
];
const UNITS: MaterialUnit[] = ['TONNE', 'M3', 'PIECE', 'LOAD'];

interface NewRfqModalProps {
  onClose: () => void;
  onCreated: (r: QuoteRequest) => void;
  token: string;
}

function NewRfqModal({ onClose, onCreated, token }: NewRfqModalProps) {
  const [form, setForm] = useState<CreateQuoteRequestInput>({
    materialCategory: 'SAND',
    materialName: '',
    quantity: 1,
    unit: 'TONNE',
    deliveryAddress: '',
    deliveryCity: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateQuoteRequestInput, v: CreateQuoteRequestInput[typeof k]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.materialName.trim() || !form.deliveryAddress.trim() || !form.deliveryCity.trim()) {
      setError('Aizpildiet visus obligātos laukus');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createQuoteRequest(form, token);
      onCreated(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kļūda nosūtot pieprasījumu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold">Jauns Cenu Pieprasījums</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category + name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Kategorija *</label>
              <select
                value={form.materialCategory}
                onChange={(e) => set('materialCategory', e.target.value as MaterialCategory)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LV[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Materiāla nosaukums *
              </label>
              <input
                value={form.materialName}
                onChange={(e) => set('materialName', e.target.value)}
                placeholder="piem. Smalkas smiltis"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Quantity + unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Daudzums *</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.quantity}
                onChange={(e) => set('quantity', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Mērvienība *</label>
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

          {/* Delivery */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Piegādes adrese *
              </label>
              <input
                value={form.deliveryAddress}
                onChange={(e) => set('deliveryAddress', e.target.value)}
                placeholder="Iela 1"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Pilsēta *</label>
              <input
                value={form.deliveryCity}
                onChange={(e) => set('deliveryCity', e.target.value)}
                placeholder="Rīga"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Piezīmes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Papildus prasības, termiņš u.c."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Atcelt
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Sūta...' : 'Nosūtīt Pieprasījumu'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

interface RequestCardProps {
  request: QuoteRequest;
  onAccept: (requestId: string, responseId: string) => Promise<void>;
}

function RequestCard({ request, onAccept }: RequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const cfg = STATUS_CFG[request.status] ?? STATUS_CFG.PENDING;
  const Icon = cfg.icon;

  const handleAccept = async (responseId: string) => {
    setAccepting(responseId);
    await onAccept(request.id, responseId);
    setAccepting(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{request.requestNumber}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-1">
            {request.materialName}
            <span className="text-muted-foreground font-normal ml-2 text-xs">
              {CATEGORY_LV[request.materialCategory]}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {request.quantity} {UNIT_LV[request.unit]} · {request.deliveryCity}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {request.responses.length > 0 && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100">
              {request.responses.length} atbild{request.responses.length === 1 ? 'e' : 'es'}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{fmtDate(request.createdAt)}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Responses */}
      {expanded && (
        <div className="border-t border-slate-100">
          {request.notes && (
            <div className="px-5 py-3 bg-slate-50/50 text-xs text-slate-600 italic">
              &quot;{request.notes}&quot;
            </div>
          )}

          {request.responses.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-muted-foreground">
              Vēl nav saņemtu piedāvājumu
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {request.responses.map((resp) => (
                <ResponseRow
                  key={resp.id}
                  response={resp}
                  canAccept={request.status === 'PENDING' || request.status === 'QUOTED'}
                  accepting={accepting === resp.id}
                  onAccept={() => handleAccept(resp.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ResponseRowProps {
  response: QuoteResponse;
  canAccept: boolean;
  accepting: boolean;
  onAccept: () => void;
}

function ResponseRow({ response, canAccept, accepting, onAccept }: ResponseRowProps) {
  const isAccepted = response.status === 'ACCEPTED';

  return (
    <div className={`flex items-center gap-4 px-5 py-3 ${isAccepted ? 'bg-green-50/60' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">
          {fmtEur(response.pricePerUnit)} / {UNIT_LV[response.unit]}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {response.supplier.name} · {response.supplier.city}
          {response.supplier.rating && ` · ⭐ ${response.supplier.rating.toFixed(1)}`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Piegāde {response.etaDays} d{response.etaDays === 1 ? 'ienā' : 'ienās'}
          {response.validUntil && ` · Derīgs līdz ${fmtDate(response.validUntil)}`}
        </p>
        {response.notes && (
          <p className="text-xs text-slate-500 mt-0.5 italic">&quot;{response.notes}&quot;</p>
        )}
      </div>
      <div className="shrink-0">
        {isAccepted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2.5 py-0.5 text-xs font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Pieņemts
          </span>
        ) : canAccept ? (
          <Button size="sm" onClick={onAccept} disabled={accepting} className="h-8 text-xs">
            {accepting ? 'Pieņem...' : 'Pieņemt'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QuoteRequestsPage() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  const handleCreated = (r: QuoteRequest) => {
    setShowModal(false);
    setRequests((prev) => [r, ...prev]);
  };

  const handleAccept = async (requestId: string, responseId: string) => {
    if (!token) return;
    try {
      const updated = await acceptQuoteResponse(requestId, responseId, token);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Kļūda pieņemot piedāvājumu');
    }
  };

  const pending = requests.filter((r) => r.status === 'PENDING' || r.status === 'QUOTED').length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <PageHeader
        title="Cenu Pieprasījumi"
        description="Pieprasiet cenas no piegādātājiem un salīdziniet piedāvājumus"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Atjaunot
            </Button>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Jauns Pieprasījums
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {requests.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Kopā', value: requests.length, color: 'text-slate-700' },
            { label: 'Aktīvie', value: pending, color: 'text-amber-600' },
            {
              label: 'Pieņemtie',
              value: requests.filter((r) => r.status === 'ACCEPTED').length,
              color: 'text-green-600',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-white p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-red-600" />
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
          <p className="text-sm font-medium text-muted-foreground">Nav cenu pieprasījumu</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Izveidojiet jaunu pieprasījumu, lai saņemtu cenas no piegādātājiem.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Izveidot Pieprasījumu
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} onAccept={handleAccept} />
          ))}
        </div>
      )}

      {/* New RFQ modal */}
      {showModal && token && (
        <NewRfqModal token={token} onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
