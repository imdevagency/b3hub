/**
 * Step4ContactForm — Order wizard step 4 (contact details).
 * Collects contact name, phone, and any special delivery instructions.
 * When preFilledFromProfile is true, shows a "pre-filled from profile" badge
 * and lets the user collapse the contact section.
 */
'use client';

import { useState } from 'react';
import { Loader2, MapPin, Package, CalendarDays, Tag, UserCheck, ChevronDown } from 'lucide-react';
import { SKIP_SIZES, WASTE_TYPES } from './Step1Container';

interface OrderSummary {
  size: string;
  wasteType: string;
  address: string;
  deliveryDate: string;
  hirePeriodDays: number;
  offerCarrier: string;
  offerPrice: number;
}

interface ContactValues {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface Props extends ContactValues {
  summary: OrderSummary;
  onChange: (k: keyof ContactValues, v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string;
  /** When true, shows "pre-filled from your profile" chip and collapses the form by default. */
  preFilledFromProfile?: boolean;
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('lv-LV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function addDaysToISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function Step4ContactForm({
  name,
  email,
  phone,
  notes,
  summary,
  onChange,
  onSubmit,
  onBack,
  submitting,
  error,
  preFilledFromProfile = false,
}: Props) {
  const set =
    (k: keyof ContactValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(k, e.target.value);

  // When contact data is pre-filled from profile, collapse the form by default.
  const [contactExpanded, setContactExpanded] = useState(!preFilledFromProfile);

  const sizeInfo = SKIP_SIZES.find((s) => s.id === summary.size);
  const wasteInfo = WASTE_TYPES.find((w) => w.id === summary.wasteType);
  const pickupDate = summary.deliveryDate
    ? addDaysToISO(summary.deliveryDate, summary.hirePeriodDays)
    : '';

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

      {/* Order summary card */}
      <div className="rounded-2xl border-2 border-gray-100 bg-gray-50 overflow-hidden">
        <div className="bg-primary px-4 py-3">
          <p className="text-sm font-bold text-white">Pasūtījuma kopsavilkums</p>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <Package className="size-4 text-gray-400 shrink-0" />
            <div>
              <span className="text-gray-500">Konteiners: </span>
              <span className="font-semibold text-gray-900">
                {sizeInfo?.label} ({sizeInfo?.volume})
              </span>
              {wasteInfo && (
                <span className="text-gray-500 ml-1">
                  — {wasteInfo.emoji} {wasteInfo.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <MapPin className="size-4 text-gray-400 shrink-0" />
            <div>
              <span className="text-gray-500">Adrese: </span>
              <span className="font-semibold text-gray-900">{summary.address}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <CalendarDays className="size-4 text-gray-400 shrink-0" />
            <div>
              <span className="text-gray-500">Piegāde: </span>
              <span className="font-semibold text-gray-900">{fmtDate(summary.deliveryDate)}</span>
              {pickupDate && (
                <span className="text-gray-500"> → savākšana {fmtDate(pickupDate)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="flex items-center gap-3">
              <Tag className="size-4 text-gray-400 shrink-0" />
              <div>
                <span className="text-gray-500">Pārvadātājs: </span>
                <span className="font-semibold text-gray-900">{summary.offerCarrier}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-extrabold text-primary">€{summary.offerPrice}</span>
              <p className="text-xs text-gray-400">iekļ. PVN</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact form */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Kontaktinformācija</p>
          {preFilledFromProfile && (
            <button
              type="button"
              onClick={() => setContactExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <UserCheck className="size-3" />
              No profila
              <ChevronDown
                className={`size-3 transition-transform ${contactExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        {!contactExpanded && preFilledFromProfile && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 space-y-0.5">
            <p className="font-semibold">{name}</p>
            <p className="text-xs text-emerald-600">
              {email} · {phone}
            </p>
          </div>
        )}

        {contactExpanded && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
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
                Piezīmes (neobligāts)
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
        )}
      </div>

      {error && (
        <p className="text-sm text-primary bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Nav */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 rounded-2xl border-2 border-gray-200 py-3.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Atpakaļ
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="flex-2 flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {submitting ? 'Apstiprina...' : 'Apstiprināt pasūtījumu'}
        </button>
      </div>

      <p className="text-xs text-center text-gray-400 -mt-2">
        Pasūtot jūs piekrītat B3Hub lietošanas noteikumiem
      </p>
    </div>
  );
}
