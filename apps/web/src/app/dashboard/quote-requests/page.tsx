/**
 * Quote requests page — /dashboard/quote-requests
 * Lists the buyer's RFQs and received offers. Suppliers see open RFQs they can bid on.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Truck,
  Star,
  Info,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/page-spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth-context';
import {
  getMyQuoteRequests,
  createQuoteRequest,
  acceptQuoteResponse,
  type QuoteRequest,
  type MaterialCategory,
  type MaterialUnit,
  type CreateQuoteRequestInput,
} from '@/lib/api';
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
    color: 'text-slate-700',
    bg: 'bg-slate-100 border-slate-200',
  },
  QUOTED: {
    label: 'Saņemti piedāvājumi',
    icon: Truck,
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
  },
  ACCEPTED: {
    label: 'Apstiprināts',
    icon: CheckCircle2,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
  },
  EXPIRED: {
    label: 'Beidzies',
    icon: Archive,
    color: 'text-slate-500',
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kur un ko jums vajag?</DialogTitle>
          <DialogDescription>Izveidojiet jaunu cenu pieprasījumu piegādātājiem</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Category + name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rfq-category">Materiāla kategorija</Label>
              <Select
                value={form.materialCategory}
                onValueChange={(v) => set('materialCategory', v as MaterialCategory)}
              >
                <SelectTrigger id="rfq-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LV[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rfq-name">Precīzs nosaukums</Label>
              <Input
                id="rfq-name"
                value={form.materialName}
                onChange={(e) => set('materialName', e.target.value)}
                placeholder="piem. Skalotas smiltis 0-2mm"
              />
            </div>
          </div>

          {/* Quantity + unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rfq-qty">Daudzums</Label>
              <Input
                id="rfq-qty"
                type="number"
                min={0.1}
                step={0.1}
                value={form.quantity}
                onChange={(e) => set('quantity', parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rfq-unit">Mērvienība</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v as MaterialUnit)}>
                <SelectTrigger id="rfq-unit">
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

          {/* Delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rfq-city">Pilsēta / Novads</Label>
              <Input
                id="rfq-city"
                value={form.deliveryCity}
                onChange={(e) => set('deliveryCity', e.target.value)}
                placeholder="Rīga"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rfq-address">Precīza adrese</Label>
              <Input
                id="rfq-address"
                value={form.deliveryAddress}
                onChange={(e) => set('deliveryAddress', e.target.value)}
                placeholder="Brīvības iela 1"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="rfq-notes">
              <Info className="inline h-3 w-3 mr-1" />
              Komentāri piegādātājam{' '}
              <span className="text-muted-foreground font-normal">(neobligāti)</span>
            </Label>
            <Textarea
              id="rfq-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Papildus prasības vai termiņi..."
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" type="button" onClick={onClose} className="w-1/3">
              Atcelt
            </Button>
            <Button type="submit" disabled={saving} className="w-2/3">
              {saving ? 'Sūta...' : 'Pieprasīt Cenas'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
    <div
      className={`bg-white rounded-3xl border ${expanded ? 'border-slate-300 shadow-md' : 'border-slate-100 shadow-sm'} overflow-hidden transition-all hover:shadow-md hover:border-slate-200`}
    >
      {/* Header (Clickable) */}
      <div
        className="p-5 cursor-pointer flex flex-col gap-4 relative"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Material Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-700 border border-slate-100">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 truncate">
                {request.materialName || CATEGORY_LV[request.materialCategory]}
              </p>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                {request.quantity}{' '}
                <span className="text-xs uppercase">{UNIT_LV[request.unit]}</span> •{' '}
                {CATEGORY_LV[request.materialCategory]}
              </p>
            </div>
          </div>

          {/* Badge */}
          <div className="shrink-0 text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border ${cfg.bg} ${cfg.color}`}
            >
              <Icon className="h-3 w-3" /> {cfg.label}
            </span>
          </div>
        </div>

        {/* Location / Route row */}
        <div className="flex items-center gap-3 bg-slate-50/80 rounded-xl p-3 border border-slate-100/50">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
          <p className="text-sm text-slate-800 font-semibold truncate leading-none">
            {request.deliveryCity}
          </p>
          {/* separator dot */}
          <div className="h-1 w-1 rounded-full bg-slate-300 mx-1 shrink-0"></div>
          <p className="text-sm text-slate-500 truncate leading-none">{request.deliveryAddress}</p>
        </div>

        {/* Meta info */}
        <div className="flex items-center justify-between mt-1">
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-slate-400">
            ID: {request.requestNumber}
          </span>
          <div className="flex items-center gap-3">
            {request.responses.length > 0 && (
              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                {request.responses.length} piedāvājum{request.responses.length === 1 ? 's' : 'i'}
              </span>
            )}
            <span className="text-xs font-medium text-slate-400">{fmtDate(request.createdAt)}</span>
            <div className="h-6 w-6 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              {expanded ? (
                <ChevronUp className="h-3 w-3 text-slate-600" />
              ) : (
                <ChevronDown className="h-3 w-3 text-slate-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Actions & Responses */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50">
          {request.notes && (
            <div className="px-5 pt-4 pb-0 text-sm text-slate-600">
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-400 block mb-1">
                Piezīmes
              </span>
              &quot;{request.notes}&quot;
            </div>
          )}

          <div className="p-4 space-y-3">
            {request.responses.length === 0 ? (
              <div className="py-8 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
                <Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">Meklējam labākos pārvadātājus...</p>
                <p className="mt-1 text-xs text-slate-500">
                  Tiklīdz saņemsim cenas, tās parādīsies šeit.
                </p>
              </div>
            ) : (
              request.responses.map((resp) => (
                <div
                  key={resp.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    resp.status === 'ACCEPTED'
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm relative overflow-hidden'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {resp.status === 'ACCEPTED' && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shrink-0 z-10 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Izvēlēts
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center shrink-0">
                        <Truck className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          {resp.supplier.name}
                          {resp.supplier.rating && (
                            <span className="flex items-center gap-0.5 text-xs bg-slate-100 rounded-full px-1.5 py-0.5 font-semibold text-slate-700 border border-slate-200">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />{' '}
                              {resp.supplier.rating.toFixed(1)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                          Piegāde {resp.etaDays}d laikā
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5">
                      <div className="text-left sm:text-right">
                        <p className="text-xl font-bold text-slate-900 leading-none">
                          {fmtEur(resp.pricePerUnit)}
                          <span className="text-sm font-medium text-slate-500">
                            /{UNIT_LV[resp.unit]}
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">
                          Cena ar piegādi
                        </p>
                      </div>

                      {resp.status !== 'ACCEPTED' &&
                        (request.status === 'PENDING' || request.status === 'QUOTED') && (
                          <Button
                            onClick={() => handleAccept(resp.id)}
                            disabled={accepting === resp.id}
                            className="rounded-xl h-10 px-5 bg-black text-white hover:bg-slate-800 font-bold transition-all shadow-sm"
                          >
                            {accepting === resp.id ? 'Pieņem...' : 'Izvēlēties'}
                          </Button>
                        )}
                    </div>
                  </div>

                  {resp.notes && (
                    <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border border-slate-100">
                      <span className="font-semibold block mb-0.5">Piegādātāja komentārs:</span>
                      {resp.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
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
  const accepted = requests.filter((r) => r.status === 'ACCEPTED').length;

  return (
    <div className="w-full max-w-5xl mx-auto h-full pb-20 space-y-6 sm:space-y-8 px-4 sm:px-6 md:px-8 mt-4 sm:mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Cenu Pieprasījumi
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-md">
            Iegūsti labākos piedāvājumus no piegādātājiem visām vajadzībām.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="h-11 px-4 rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atjaunot</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="h-11 px-5 rounded-xl bg-black text-white hover:bg-slate-800 font-bold shadow-md"
          >
            <Plus className="h-5 w-5 sm:mr-1.5" />
            <span className="hidden sm:inline">Jauns Pieprasījums</span>
            <span className="sm:hidden">Pieprasīt</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {requests.length > 0 && !error && (
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">
              Visi
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-slate-900">{requests.length}</p>
          </div>
          <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5 shadow-sm relative overflow-hidden">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-600/80 mb-1">
              Aktīvie
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-blue-700">{pending}</p>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5 shadow-sm">
            <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-600/80 mb-1">
              Izvēlētie
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-emerald-700">{accepted}</p>
          </div>
        </div>
      )}

      {loading ? (
        <PageSpinner className="h-64" />
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center shadow-sm">
          <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-red-900">{error}</p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl bg-white border-red-200 hover:bg-red-100 text-red-800 font-bold"
            onClick={load}
          >
            Mēģināt vēlreiz
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center flex flex-col items-center justify-center">
          <div className="h-20 w-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-5">
            <Package className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nekas nav pieprasīts</h3>
          <p className="mt-2 text-sm font-medium text-slate-500 max-w-sm">
            Izveidojiet savu pirmo cenu pieprasījumu, lai ātri un ērti saņemtu piedāvājumus no
            labākajiem piegādātājiem.
          </p>
          <Button
            className="mt-6 h-12 px-6 rounded-xl bg-black text-white hover:bg-slate-800 font-bold shadow-md"
            onClick={() => setShowModal(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Izveidot Pieprasījumu
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5">
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
