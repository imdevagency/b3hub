'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  Loader2,
  QrCode,
  AlertCircle,
  Scale,
  RotateCcw,
  Search,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getB3Fields, getTodayArrivals, type ApiB3Field, type ApiTodayArrivals } from '@/lib/api';

// ─── PIN auth (simple client-side gate lock — real auth on API) ──────────────

const GATE_PIN = '1234'; // TODO: move to env or per-field DB setting

// ─── Weighing slip form ──────────────────────────────────────────────────────

interface WeighingFormState {
  passId: string;
  passNumber: string;
  vehiclePlate: string;
  grossTonnes: string;
  tareTonnes: string;
  operatorName: string;
  notes: string;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function GatePage() {
  const [pinInput, setPinInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  const [fields, setFields] = useState<ApiB3Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState('');
  const [token, setToken] = useState('');

  const [arrivals, setArrivals] = useState<ApiTodayArrivals | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [searchValue, setSearchValue] = useState('');
  const [weighingSheet, setWeighingSheet] = useState(false);
  const [weighForm, setWeighForm] = useState<WeighingFormState>({
    passId: '',
    passNumber: '',
    vehiclePlate: '',
    grossTonnes: '',
    tareTonnes: '',
    operatorName: '',
    notes: '',
  });
  const [savingWeigh, setSavingWeigh] = useState(false);
  const [weighSuccess, setWeighSuccess] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── PIN auth ────────────────────────────────────────────────────────────────

  const handlePinSubmit = () => {
    if (pinInput === GATE_PIN) {
      setAuthenticated(true);
      // Get a token from localStorage (operator must have logged in)
      const stored = localStorage.getItem('sb-access-token') ?? '';
      setToken(stored);
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 1500);
    }
  };

  // ── Load fields ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authenticated) return;
    getB3Fields(true).then((data) => {
      setFields(data);
      if (data.length === 1) setSelectedFieldId(data[0].id);
    });
  }, [authenticated]);

  // ── Load arrivals ────────────────────────────────────────────────────────────

  const loadArrivals = useCallback(async () => {
    if (!selectedFieldId || !token) return;
    setLoading(true);
    try {
      const data = await getTodayArrivals(token, selectedFieldId);
      setArrivals(data);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [selectedFieldId, token]);

  useEffect(() => {
    loadArrivals();
    // Auto-refresh every 60 seconds
    refreshTimer.current = setInterval(loadArrivals, 60_000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [loadArrivals]);

  // ── Weigh pass ───────────────────────────────────────────────────────────────

  const openWeighSheet = (passId: string, passNumber: string, vehiclePlate: string) => {
    setWeighForm({
      passId,
      passNumber,
      vehiclePlate,
      grossTonnes: '',
      tareTonnes: '',
      operatorName: '',
      notes: '',
    });
    setWeighSuccess(false);
    setWeighingSheet(true);
  };

  const saveWeighingSlip = async () => {
    const { passId, grossTonnes, tareTonnes, operatorName } = weighForm;
    const gross = parseFloat(grossTonnes);
    const tare = parseFloat(tareTonnes);
    if (!gross || !tare || gross <= tare) return;

    setSavingWeigh(true);
    try {
      const res = await fetch(`${apiBase}/weighing-slips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fieldPassId: passId,
          grossTonnes: gross,
          tareTonnes: tare,
          netTonnes: gross - tare,
          vehiclePlate: weighForm.vehiclePlate,
          operatorName: operatorName || undefined,
          notes: weighForm.notes || undefined,
          weighingPoint: 'UNLOADING',
        }),
      });
      if (res.ok) {
        setWeighSuccess(true);
        setTimeout(() => {
          setWeighingSheet(false);
          loadArrivals();
        }, 1500);
      }
    } finally {
      setSavingWeigh(false);
    }
  };

  const netTonnes =
    parseFloat(weighForm.grossTonnes) && parseFloat(weighForm.tareTonnes)
      ? (parseFloat(weighForm.grossTonnes) - parseFloat(weighForm.tareTonnes)).toFixed(2)
      : null;

  // ── Filter arrivals ──────────────────────────────────────────────────────────

  const q = searchValue.trim().toUpperCase();
  const filteredOrders = (arrivals?.orders ?? []).filter(
    (o) =>
      !q ||
      o.orderNumber.includes(q) ||
      o.buyer.name.toUpperCase().includes(q) ||
      o.fieldPasses.some((p) => p.vehiclePlate.includes(q)),
  );
  const filteredPasses = (arrivals?.passes ?? []).filter(
    (p) =>
      !q ||
      p.passNumber.includes(q) ||
      p.vehiclePlate.includes(q) ||
      p.company.name.toUpperCase().includes(q),
  );

  // ── PIN screen ────────────────────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">B3 Field</h1>
            <p className="text-slate-400 mt-1 text-sm">Vārtu operators — ievadi PIN</p>
          </div>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="PIN kods"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
              className={`text-center text-2xl tracking-widest h-14 bg-white/10 border-white/20 text-white placeholder:text-slate-500 ${pinError ? 'border-red-500' : ''}`}
              maxLength={8}
            />
            {pinError && <p className="text-red-400 text-center text-sm">Nepareizs PIN</p>}
            <Button
              onClick={handlePinSubmit}
              className="w-full h-12 bg-white text-black font-bold hover:bg-slate-100"
            >
              Ienākt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Field selector (if multiple fields) ─────────────────────────────────────

  if (fields.length > 1 && !selectedFieldId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Izvēlies B3 Field</h1>
          {fields.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFieldId(f.id)}
              className="w-full bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl p-4 text-left text-white transition-colors"
            >
              <p className="font-bold">{f.name}</p>
              <p className="text-sm text-slate-400">
                {f.address}, {f.city}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // ── Gate main screen ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-black border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-yellow-400" />
            <span className="font-bold text-lg">{selectedField?.name ?? 'B3 Field'}</span>
          </div>
          <p className="text-slate-400 text-xs">
            Šodienas saraksts —{' '}
            {loading
              ? 'Atjaunina...'
              : lastRefresh
                ? `Atjaunots ${lastRefresh.toLocaleTimeString('lv')}`
                : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadArrivals}
            className="border-white/20 text-white hover:bg-white/10"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
          </Button>
          {fields.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFieldId('')}
              className="border-white/20 text-white hover:bg-white/10 text-xs"
            >
              Mainīt
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Meklēt pēc nr., numura zīmes vai uzņēmuma..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Orders with PICKUP fulfillment */}
        {filteredOrders.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              Materiālu paņemšana ({filteredOrders.length})
            </p>
            <div className="space-y-2">
              {filteredOrders.map((order) => {
                const pass = order.fieldPasses[0];
                const slotTime = order.pickupSlot
                  ? new Date(order.pickupSlot.slotStart).toLocaleTimeString('lv', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null;
                return (
                  <div
                    key={order.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-sm">{order.orderNumber}</p>
                        <p className="text-slate-400 text-xs truncate">{order.buyer.name}</p>
                        {order.items.map((item, i) => (
                          <p key={i} className="text-slate-300 text-xs">
                            {item.quantity} {item.unit} — {item.material.name}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {slotTime && (
                        <div className="text-right">
                          <Clock className="w-3.5 h-3.5 text-slate-400 inline-block mr-1" />
                          <span className="text-sm font-bold text-yellow-400">{slotTime}</span>
                        </div>
                      )}
                      {pass ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-mono text-xs">
                          {pass.vehiclePlate}
                        </Badge>
                      ) : null}
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Waste disposal passes */}
        {filteredPasses.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              Atkritumu nodošana ({filteredPasses.length})
            </p>
            <div className="space-y-2">
              {filteredPasses.map((pass) => {
                const hasWeighing = pass.weighingSlips.length > 0;
                return (
                  <div key={pass.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center">
                          <QrCode className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-sm">{pass.passNumber}</p>
                          <p className="text-slate-400 text-xs truncate">{pass.company.name}</p>
                          {pass.driverName && (
                            <p className="text-slate-300 text-xs">{pass.driverName}</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-mono text-xs">
                          {pass.vehiclePlate}
                        </Badge>
                        {hasWeighing ? (
                          <div className="text-right">
                            <p className="text-green-400 text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {pass.weighingSlips[0].netTonnes.toFixed(2)} t
                            </p>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              openWeighSheet(pass.id, pass.passNumber, pass.vehiclePlate)
                            }
                            className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-8"
                          >
                            <Scale className="w-3.5 h-3.5 mr-1" />
                            Svērt
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Walk-in entry */}
        {filteredOrders.length === 0 && filteredPasses.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-500">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {searchValue ? 'Nav rezultātu' : 'Šodienai nav ieplānotu ierašanās'}
            </p>
            {!searchValue && (
              <p className="text-xs mt-1 text-slate-600">
                Walk-in klienti var ienākt jebkurā laikā darba laikā
              </p>
            )}
          </div>
        )}

        {loading && !arrivals && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* Weighing slip sheet */}
      <Sheet open={weighingSheet} onOpenChange={setWeighingSheet}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-slate-900 border-white/10 text-white"
        >
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-orange-400" />
              Svēršanas talons
            </SheetTitle>
          </SheetHeader>

          {weighSuccess ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <CheckCircle2 className="w-16 h-16 text-green-400" />
              <p className="text-xl font-bold text-green-400">Saglabāts!</p>
            </div>
          ) : (
            <div className="space-y-5 mt-6">
              <div className="bg-white/5 rounded-lg p-3 space-y-1">
                <p className="text-xs text-slate-400">Caurlaides Nr.</p>
                <p className="font-mono font-bold text-yellow-400">{weighForm.passNumber}</p>
                <p className="text-sm font-bold tracking-widest">{weighForm.vehiclePlate}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Bruto (t) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={weighForm.grossTonnes}
                    onChange={(e) => setWeighForm((p) => ({ ...p, grossTonnes: e.target.value }))}
                    className="bg-white/5 border-white/20 text-white text-xl font-bold text-center h-14"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">Tara (t) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={weighForm.tareTonnes}
                    onChange={(e) => setWeighForm((p) => ({ ...p, tareTonnes: e.target.value }))}
                    className="bg-white/5 border-white/20 text-white text-xl font-bold text-center h-14"
                  />
                </div>
              </div>

              {netTonnes && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Neto svars</p>
                  <p className="text-4xl font-black text-green-400">{netTonnes} t</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Operators (nav obligāts)</Label>
                <Input
                  placeholder="Jānis Bērziņš"
                  value={weighForm.operatorName}
                  onChange={(e) => setWeighForm((p) => ({ ...p, operatorName: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Piezīmes (nav obligātas)</Label>
                <Input
                  placeholder="..."
                  value={weighForm.notes}
                  onChange={(e) => setWeighForm((p) => ({ ...p, notes: e.target.value }))}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <Button
                onClick={saveWeighingSlip}
                disabled={
                  savingWeigh ||
                  !weighForm.grossTonnes ||
                  !weighForm.tareTonnes ||
                  parseFloat(weighForm.grossTonnes) <= parseFloat(weighForm.tareTonnes)
                }
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base"
              >
                {savingWeigh ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Saglabāt svēršanu'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Status badge helper ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: 'Gaida', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    CONFIRMED: { label: 'Apstiprināts', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    IN_PROGRESS: { label: 'Procesā', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    DELIVERED: { label: 'Izsniegts', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    COMPLETED: { label: 'Pabeigts', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    CANCELLED: { label: 'Atcelts', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const m = map[status] ?? {
    label: status,
    cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return <Badge className={`${m.cls} text-xs border`}>{m.label}</Badge>;
}
