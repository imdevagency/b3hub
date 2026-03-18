/**
 * Skip-hire management page — /dashboard/skip-hire
 * Carrier view: list of active skip-hire bookings and status management.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMySkipHireOrders,
  createSkipHireOrder,
  type SkipHireOrder,
  type SkipSize,
  type SkipWasteCategory,
  type CreateSkipHireInput,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle,
  ClipboardList,
  Calendar,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Phone,
  Mail,
  User,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────

const SKIP_SIZES: {
  value: SkipSize;
  label: string;
  volume: string;
  price: string;
  desc: string;
}[] = [
  {
    value: 'MINI',
    label: 'Mini',
    volume: '2 m³',
    price: 'no €89',
    desc: 'Mājas remontam, mazdārzam',
  },
  {
    value: 'MIDI',
    label: 'Midi',
    volume: '4 m³',
    price: 'no €129',
    desc: 'Virtuves/vannas istabas renovācijai',
  },
  {
    value: 'BUILDERS',
    label: 'Celtniecības',
    volume: '6 m³',
    price: 'no €169',
    desc: 'Lielākiem celtniecības projektiem',
  },
  {
    value: 'LARGE',
    label: 'Liels',
    volume: '8 m³',
    price: 'no €199',
    desc: 'Komerciālai lietošanai, lieliem projektiem',
  },
];

const WASTE_CATEGORIES: { value: SkipWasteCategory; label: string; emoji: string }[] = [
  { value: 'MIXED', label: 'Jaukti atkritumi', emoji: '🗑️' },
  { value: 'GREEN_GARDEN', label: 'Zaļie/dārza atkritumi', emoji: '🌿' },
  { value: 'CONCRETE_RUBBLE', label: 'Betons / drupači', emoji: '🧱' },
  { value: 'WOOD', label: 'Koksne', emoji: '🪵' },
  { value: 'METAL_SCRAP', label: 'Metāla lūžņi', emoji: '⚙️' },
  { value: 'ELECTRONICS_WEEE', label: 'Elektronika (EEIA)', emoji: '🖥️' },
];

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: 'Gaidā', bg: '#fef3c7', text: '#b45309' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#dbeafe', text: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: '#dcfce7', text: '#15803d' },
  COLLECTED: { label: 'Savākts', bg: '#f0fdf4', text: '#166534' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0fdf4', text: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtMoney(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('lv-LV', { style: 'currency', currency }).format(n);
}

// ─────────────────────────────────────────────────────────────────────────────

interface BookingForm {
  skipSize: SkipSize | null;
  wasteCategory: SkipWasteCategory;
  location: string;
  deliveryDate: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

const INITIAL_FORM: BookingForm = {
  skipSize: null,
  wasteCategory: 'MIXED',
  location: '',
  deliveryDate: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
};

type BookStep = 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────

export default function SkipHirePage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<'orders' | 'new'>('orders');
  const [orders, setOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<BookStep>(1);
  const [form, setForm] = useState<BookingForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booked, setBooked] = useState<SkipHireOrder | null>(null);

  useEffect(() => {
    if (!isLoading && !token) router.push('/login');
  }, [token, isLoading, router]);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getMySkipHireOrders(token);
      setOrders(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const set = (field: keyof BookingForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const step2Valid = !!form.skipSize && form.location.trim() && form.deliveryDate;
  const step3Valid =
    form.contactName.trim() && (form.contactEmail.trim() || form.contactPhone.trim());

  const handleSubmit = async () => {
    if (!step3Valid || !form.skipSize) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: CreateSkipHireInput = {
        skipSize: form.skipSize,
        wasteCategory: form.wasteCategory,
        location: form.location.trim(),
        deliveryDate: form.deliveryDate,
        contactName: form.contactName.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const result = await createSkipHireOrder(payload, token ?? undefined);
      setBooked(result);
      setOrders((prev) => [result, ...prev]);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Kļūda');
    } finally {
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setForm(INITIAL_FORM);
    setStep(1);
    setBooked(null);
    setSubmitError(null);
    setTab('orders');
  };

  const active = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
  const totalSpent = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((s, o) => s + o.price, 0);

  if (isLoading) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Konteineru noma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pasūtiet konteineru atkritumu izvešanai uz jūsu objektu
          </p>
        </div>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white gap-2"
          onClick={() => {
            setTab('new');
            setStep(1);
          }}
        >
          <Plus className="h-4 w-4" />
          Jauns pasūtījums
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Kopā pasūtījumi', value: String(orders.length), icon: ClipboardList },
          { label: 'Aktīvie', value: String(active), icon: Trash2, alert: active > 0 },
          { label: 'Kopā iztērēts', value: fmtMoney(totalSpent), icon: Banknote },
        ].map(({ label, value, icon: Icon, alert }) => (
          <div
            key={label}
            className={`rounded-xl border bg-card p-4 ${alert ? 'border-amber-300 bg-amber-50' : ''}`}
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Icon className={`h-4 w-4 ${alert ? 'text-amber-600' : ''}`} />
              {label}
            </div>
            <p className={`text-xl font-bold ${alert ? 'text-amber-700' : ''}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b pb-1">
        {(
          [
            ['orders', 'Mani pasūtījumi'],
            ['new', 'Jauns pasūtījums'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 px-1 text-sm font-semibold border-b-2 transition-colors ${
              tab === key
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Orders tab ──────────────────────────────────────────── */}
      {tab === 'orders' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={loadOrders}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atjaunot
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="h-10 w-10 text-red-300" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-bold text-gray-800">Nav neviena pasūtījuma</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Pasūtiet konteineru atkritumu vai celtniecības materiālu izvešanai.
                </p>
              </div>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white gap-2"
                onClick={() => setTab('new')}
              >
                <Plus className="h-4 w-4" />
                Pasūtīt konteineru
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const st = STATUS[order.status] ?? {
                  label: order.status,
                  bg: '#f3f4f6',
                  text: '#374151',
                };
                const sizeObj = SKIP_SIZES.find((s) => s.value === order.skipSize);
                const catObj = WASTE_CATEGORIES.find((c) => c.value === order.wasteCategory);
                return (
                  <div
                    key={order.id}
                    className="bg-white border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-mono font-bold text-sm">#{order.orderNumber}</p>
                        <span
                          style={{ backgroundColor: st.bg, color: st.text }}
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        >
                          {st.label}
                        </span>
                        {sizeObj && (
                          <span className="rounded-full bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5">
                            {sizeObj.label} · {sizeObj.volume}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {order.location}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {fmtDate(order.deliveryDate)}
                        </span>
                        {catObj && (
                          <span className="text-muted-foreground">
                            {catObj.emoji} {catObj.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0">
                      <p className="text-xl font-bold">{fmtMoney(order.price)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtDate(order.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── New order tab ────────────────────────────────────────── */}
      {tab === 'new' && (
        <div className="max-w-2xl">
          {/* Success state */}
          {booked ? (
            <div className="bg-white border rounded-2xl shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Pasūtījums veiksmīgs!</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                Jūsu konteinera pasūtījums <strong>#{booked.orderNumber}</strong> ir saņemts.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Piegāde plānota: <strong>{fmtDate(booked.deliveryDate)}</strong> uz{' '}
                <strong>{booked.location}</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" className="h-11" onClick={resetBooking}>
                  Skatīt pasūtījumus
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white h-11"
                  onClick={() => {
                    setForm(INITIAL_FORM);
                    setStep(1);
                    setBooked(null);
                  }}
                >
                  Jauns pasūtījums
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl shadow-sm p-6 sm:p-8">
              {/* Step indicators */}
              <div className="flex items-center gap-2 mb-8">
                {([1, 2, 3] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        s < step
                          ? 'bg-red-600 text-white'
                          : s === step
                            ? 'bg-red-100 text-red-700 border-2 border-red-600'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {s < step ? <CheckCircle className="h-4 w-4" /> : s}
                    </div>
                    {s < 3 && (
                      <div className={`flex-1 h-0.5 ${s < step ? 'bg-red-600' : 'bg-gray-200'}`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground -mt-6 mb-6">
                {step === 1 && 'Izvēlieties konteinera izmēru'}
                {step === 2 && 'Atkritumu informācija un piegāde'}
                {step === 3 && 'Kontaktinformācija'}
              </p>

              {/* ── Step 1: Size ─────────────── */}
              {step === 1 && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Konteinera izmērs</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {SKIP_SIZES.map((sz) => (
                      <button
                        key={sz.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, skipSize: sz.value }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          form.skipSize === sz.value
                            ? 'border-red-600 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${form.skipSize === sz.value ? 'bg-red-600' : 'bg-gray-100'}`}
                          >
                            <Trash2
                              className={`h-5 w-5 ${form.skipSize === sz.value ? 'text-white' : 'text-gray-400'}`}
                            />
                          </div>
                          <span
                            className={`text-sm font-bold ${form.skipSize === sz.value ? 'text-red-600' : 'text-gray-500'}`}
                          >
                            {sz.price}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-gray-900">
                          {sz.label} · {sz.volume}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sz.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" className="h-11" onClick={() => setTab('orders')}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Atpakaļ
                    </Button>
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white h-11"
                      disabled={!form.skipSize}
                      onClick={() => setStep(2)}
                    >
                      Turpināt <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 2: Location & waste ── */}
              {step === 2 && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Piegādes detaļas</h2>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Atkritumu kategorija
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {WASTE_CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, wasteCategory: cat.value }))}
                            className={`p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                              form.wasteCategory === cat.value
                                ? 'border-red-600 bg-red-50 text-red-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <span className="mr-1">{cat.emoji}</span>
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        <MapPin className="inline h-3.5 w-3.5 mr-1" />
                        Piegādes adrese *
                      </label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => set('location', e.target.value)}
                        placeholder="Brīvības iela 1, Rīga"
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        <Calendar className="inline h-3.5 w-3.5 mr-1" />
                        Piegādes datums *
                      </label>
                      <input
                        type="date"
                        value={form.deliveryDate}
                        onChange={(e) => set('deliveryDate', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Piezīmes (pēc izvēles)
                      </label>
                      <textarea
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        placeholder="Piekļuves instrukcijas, īpašas prasības..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Atpakaļ
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11"
                      disabled={!step2Valid}
                      onClick={() => setStep(3)}
                    >
                      Turpināt <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── Step 3: Contact ──────────── */}
              {step === 3 && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Kontaktinformācija</h2>

                  {/* Summary */}
                  <div className="mb-5 rounded-xl bg-gray-50 border p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Konteiners</span>
                      <span className="font-semibold">
                        {SKIP_SIZES.find((s) => s.value === form.skipSize)?.label} ·{' '}
                        {SKIP_SIZES.find((s) => s.value === form.skipSize)?.volume}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Adrese</span>
                      <span className="font-semibold text-right max-w-[60%]">{form.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Datums</span>
                      <span className="font-semibold">
                        {form.deliveryDate ? fmtDate(form.deliveryDate) : '—'}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Orientējošā cena</span>
                      <span className="text-red-600">
                        {SKIP_SIZES.find((s) => s.value === form.skipSize)?.price}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        <User className="inline h-3.5 w-3.5 mr-1" />
                        Kontaktpersona *
                      </label>
                      <input
                        type="text"
                        value={form.contactName}
                        onChange={(e) => set('contactName', e.target.value)}
                        placeholder="Jānis Bērziņš"
                        className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          <Phone className="inline h-3.5 w-3.5 mr-1" />
                          Tālrunis
                        </label>
                        <input
                          type="tel"
                          value={form.contactPhone}
                          onChange={(e) => set('contactPhone', e.target.value)}
                          placeholder="+371 20 000 000"
                          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          <Mail className="inline h-3.5 w-3.5 mr-1" />
                          E-pasts
                        </label>
                        <input
                          type="email"
                          value={form.contactEmail}
                          onChange={(e) => set('contactEmail', e.target.value)}
                          placeholder="janis@piemers.lv"
                          className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Nepieciešams vismaz tālrunis vai e-pasts.
                    </p>
                  </div>

                  {submitError && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(2)}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Atpakaļ
                    </Button>
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white h-11"
                      disabled={!step3Valid || submitting}
                      onClick={handleSubmit}
                    >
                      {submitting ? 'Apstrādā...' : 'Iesniegt pasūtījumu'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
