/**
 * MatStep4Who — Materials order wizard step 4 (Who: contact details + confirm).
 * Shows a full order summary and collects contact info before final submission.
 */
'use client';

import { CalendarDays, Loader2, MapPin, ShoppingCart } from 'lucide-react';
import type { ApiMaterial, MaterialUnit } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SelectedItem {
  material: ApiMaterial;
  qty: number;
}

interface ContactValues {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface Props extends ContactValues {
  items: SelectedItem[];
  address: string;
  deliveryDate: string;
  onChange: (k: keyof ContactValues, v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const UNIT_LABEL: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gb.',
  LOAD: 'krāvums',
};

function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('lv-LV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MatStep4Who({
  items,
  address,
  deliveryDate,
  name,
  email,
  phone,
  notes,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
}: Props) {
  const set =
    (k: keyof ContactValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(k, e.target.value);

  const subtotal = items.reduce((s, i) => s + i.material.basePrice * i.qty, 0);
  const vat = subtotal * 0.21;
  const total = subtotal + vat;

  const canSubmit =
    name.trim().length >= 2 && email.trim().includes('@') && phone.trim().length >= 6;

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-gray-900">Apstipriniet pasūtījumu</h2>
        <p className="text-gray-500 text-sm">
          Pārbaudiet kopsavilkumu un aizpildiet kontaktinformāciju
        </p>
      </div>

      {/* ── Order summary ── */}
      <div className="rounded-2xl border-2 border-gray-100 bg-gray-50 overflow-hidden">
        <div className="bg-primary px-4 py-3">
          <p className="text-sm font-bold text-white">Pasūtījuma kopsavilkums</p>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Items */}
          {items.map((item) => (
            <div key={item.material.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <ShoppingCart className="size-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-900 truncate block">
                  {item.material.name}
                </span>
                <span className="text-gray-500 text-xs">
                  {item.qty} {UNIT_LABEL[item.material.unit]} · {item.material.supplier.name}
                </span>
              </div>
              <span className="font-semibold text-gray-900 shrink-0">
                €{(item.qty * item.material.basePrice).toFixed(2)}
              </span>
            </div>
          ))}

          {/* Delivery address */}
          <div className="flex items-start gap-3 px-4 py-3 text-sm">
            <MapPin className="size-4 text-gray-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-500">Piegādes adrese: </span>
              <span className="font-semibold text-gray-900">{address}</span>
            </div>
          </div>

          {/* Delivery date */}
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <CalendarDays className="size-4 text-gray-400 shrink-0" />
            <div>
              <span className="text-gray-500">Piegādes datums: </span>
              <span className="font-semibold text-gray-900">{fmtDate(deliveryDate)}</span>
            </div>
          </div>

          {/* Totals */}
          <div className="px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Starpsumma</span>
              <span>€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>PVN 21%</span>
              <span>€{vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-gray-900 pt-1.5 border-t mt-0.5">
              <span>Kopā</span>
              <span className="text-primary">€{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact form ── */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Kontaktinformācija</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Vārds, uzvārds *
            </label>
            <input
              type="text"
              placeholder="Jānis Bērziņš"
              value={name}
              onChange={set('name')}
              required
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tālrunis *</label>
            <input
              type="tel"
              placeholder="+371 2000 0000"
              value={phone}
              onChange={set('phone')}
              required
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">E-pasts *</label>
          <input
            type="email"
            placeholder="janis@example.lv"
            value={email}
            onChange={set('email')}
            required
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Piezīmes (piegādes instrukcijas, u.c.)
          </label>
          <textarea
            rows={2}
            placeholder="Piekļuves instrukcijas, vārtejas kods, kontaktpersona uz vietas..."
            value={notes}
            onChange={set('notes')}
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* ── Nav ── */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border-2 border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          Atpakaļ
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="flex-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'Apstrādā...' : 'Apstiprināt pasūtījumu'}
        </button>
      </div>
    </div>
  );
}
