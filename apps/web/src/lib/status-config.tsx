/**
 * Shared status configuration and badge components.
 *
 * Centralises ORDER_STATUS, JOB_STATUS, SKIP_STATUS, and INVOICE_STATUS
 * colour/label maps that were previously copy-pasted into individual pages.
 *
 * @example
 *   import { ORDER_STATUS, StatusBadgeHex } from '@/lib/status-config';
 *   <StatusBadgeHex cfg={ORDER_STATUS[order.status]} />
 */

import type { PaymentStatus } from '@/lib/api';

// ── Shared badge shape ─────────────────────────────────────────────────────────

/** Colour config used by order / job / skip status badges (hex colours). */
export interface HexBadgeCfg {
  label: string;
  bg: string;
  text: string;
}

/** Colour config used by invoice status badges (Tailwind classes). */
export interface TwBadgeCfg {
  label: string;
  className: string;
}

// ── Order statuses ─────────────────────────────────────────────────────────────

export const ORDER_STATUS: Record<string, HexBadgeCfg> = {
  PENDING: { label: 'Gaidā', bg: '#f1f5f9', text: '#475569' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#ffffff', text: '#020617' },
  IN_PROGRESS: { label: 'Procesā', bg: '#f0fdf4', text: '#15803d' },
  PROCESSING: { label: 'Apstrādē', bg: '#ffffff', text: '#020617' },
  LOADING: { label: 'Iekraušana', bg: '#ffffff', text: '#020617' },
  DISPATCHED: { label: 'Nosūtīts', bg: '#ffffff', text: '#020617' },
  DELIVERING: { label: 'Piegāde', bg: '#ffffff', text: '#020617' },
  DELIVERED: { label: 'Piegādāts', bg: '#ffffff', text: '#020617' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0fdf4', text: '#15803d' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

// ── Transport-job statuses ─────────────────────────────────────────────────────

export const JOB_STATUS: Record<string, HexBadgeCfg> = {
  AVAILABLE: { label: 'Pieejams', bg: '#f1f5f9', text: '#475569' },
  ASSIGNED: { label: 'Piešķirts', bg: '#f8fafc', text: '#334155' },
  ACCEPTED: { label: 'Pieņemts', bg: '#ffffff', text: '#020617' },
  EN_ROUTE_PICKUP: { label: 'Brauc uz Iek.', bg: '#ffffff', text: '#020617' },
  AT_PICKUP: { label: 'Uz vietas', bg: '#ffffff', text: '#020617' },
  LOADED: { label: 'Iekrauts', bg: '#ffffff', text: '#020617' },
  EN_ROUTE_DELIVERY: { label: 'Piegādē', bg: '#ffffff', text: '#020617' },
  AT_DELIVERY: { label: 'Atvedis', bg: '#ffffff', text: '#020617' },
  DELIVERED: { label: 'Piegādāts', bg: '#ffffff', text: '#020617' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

// ── Skip-hire statuses ─────────────────────────────────────────────────────────

export const SKIP_STATUS: Record<string, HexBadgeCfg> = {
  PENDING: { label: 'Gaidā', bg: '#f1f5f9', text: '#475569' },
  CONFIRMED: { label: 'Apst.', bg: '#ffffff', text: '#020617' },
  DELIVERED: { label: 'Piegādāts', bg: '#ffffff', text: '#020617' },
  COLLECTED: { label: 'Savākts', bg: '#ffffff', text: '#020617' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', text: '#b91c1c' },
};

// ── Skip size labels ──────────────────────────────────────────────────────────

export const SKIP_SIZE_LABEL: Record<string, string> = {
  MINI: 'Mini 2 m³',
  MIDI: 'Midi 4 m³',
  BUILDERS: 'Celtn. 6 m³',
  LARGE: 'Liels 8 m³',
};

// ── Invoice / payment statuses ────────────────────────────────────────────────

export const INVOICE_STATUS: Record<PaymentStatus, TwBadgeCfg> = {
  PENDING: {
    label: 'Gaida apmaksu',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  PAID: {
    label: 'Apmaksāts',
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  OVERDUE: {
    label: 'Kavēts',
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
  CANCELLED: {
    label: 'Atcelts',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
};

// ── Badge components ──────────────────────────────────────────────────────────

const FALLBACK_HEX: HexBadgeCfg = { label: '—', bg: '#ffffff', text: '#020617' };

/**
 * Renders a pill badge from a hex-colour config (orders / jobs / skips).
 *
 * @example
 *   <StatusBadgeHex cfg={ORDER_STATUS[order.status]} />
 */
export function StatusBadgeHex({ cfg }: { cfg: HexBadgeCfg | undefined }) {
  const resolved = cfg ?? FALLBACK_HEX;
  return (
    <span
      style={{ backgroundColor: resolved.bg, color: resolved.text }}
      className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap border border-border shadow-sm"
    >
      {resolved.label}
    </span>
  );
}

/**
 * Renders a pill badge from an invoice PaymentStatus value.
 *
 * @example
 *   <InvoiceStatusBadge status={invoice.paymentStatus} />
 */
export function InvoiceStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = INVOICE_STATUS[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

/**
 * Generic Tailwind-class badge.
 * Pass a `TwBadgeCfg` (from any of the status maps below) directly.
 *
 * @example
 *   <StatusBadgeTw cfg={CONSTRUCTION_PROJECT_STATUS[project.status]} />
 *   <StatusBadgeTw cfg={COMPANY_TYPE_CONFIG[company.companyType]} />
 */
export function StatusBadgeTw({ cfg }: { cfg: TwBadgeCfg | undefined }) {
  const resolved = cfg ?? { label: '—', className: 'bg-gray-100 text-gray-500' };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${resolved.className}`}
    >
      {resolved.label}
    </span>
  );
}

// ── Construction project statuses ─────────────────────────────────────────────

export const CONSTRUCTION_PROJECT_STATUS: Record<string, TwBadgeCfg> = {
  PLANNING: { label: 'Plānošana', className: 'bg-gray-100 text-gray-600' },
  ACTIVE: { label: 'Aktīvs', className: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Pabeigts', className: 'bg-green-100 text-green-700' },
  ON_HOLD: { label: 'Apturēts', className: 'bg-amber-100 text-amber-700' },
};

// ── Daily-report (DPR) statuses ───────────────────────────────────────────────

export const DPR_STATUS: Record<string, TwBadgeCfg> = {
  DRAFT: { label: 'Melnraksts', className: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'Iesniegts', className: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: 'Apstiprināts', className: 'bg-green-100 text-green-700' },
};

// ── Skip-hire order statuses (Tailwind) ───────────────────────────────────────
// (SKIP_STATUS above uses hex colours for the mobile app; this set uses Tailwind for web tables)

export const SKIP_HIRE_STATUS: Record<string, TwBadgeCfg> = {
  PENDING: { label: 'Gaidā', className: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Apstiprināts', className: 'bg-blue-100 text-blue-700' },
  DELIVERED: { label: 'Piegādāts', className: 'bg-teal-100 text-teal-700' },
  IN_USE: { label: 'Izmantošanā', className: 'bg-purple-100 text-purple-700' },
  AWAITING_COLLECTION: { label: 'Gaida savākšanu', className: 'bg-orange-100 text-orange-700' },
  COLLECTED: { label: 'Savākts', className: 'bg-green-100 text-green-700' },
  COMPLETED: { label: 'Pabeigts', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Atcelts', className: 'bg-red-100 text-red-500' },
};

// ── Skip-hire payment statuses ────────────────────────────────────────────────

export const SKIP_PAYMENT_STATUS: Record<string, TwBadgeCfg> = {
  PENDING: { label: 'Gaida', className: 'bg-gray-100 text-gray-500' },
  AUTHORIZED: { label: 'Autorizēts', className: 'bg-yellow-100 text-yellow-700' },
  CAPTURED: { label: 'Iekasēts', className: 'bg-blue-100 text-blue-700' },
  PAID: { label: 'Apmaksāts', className: 'bg-green-100 text-green-700' },
  REFUNDED: { label: 'Atmaksāts', className: 'bg-orange-100 text-orange-700' },
  FAILED: { label: 'Kļūda', className: 'bg-red-100 text-red-600' },
};

// ── Payout processing statuses ────────────────────────────────────────────────

export const PAYOUT_STATUS: Record<string, TwBadgeCfg> = {
  PENDING: { label: 'Gaida', className: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Apstrādā', className: 'bg-blue-100 text-blue-800' },
  PAID: { label: 'Izmaksāts', className: 'bg-emerald-100 text-emerald-800' },
  FAILED: { label: 'Kļūda', className: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Atcelts', className: 'bg-gray-100 text-gray-600' },
};

// ── Framework-contract statuses ───────────────────────────────────────────────

export const FRAMEWORK_CONTRACT_STATUS: Record<string, TwBadgeCfg> = {
  DRAFT: { label: 'Melnraksts', className: 'bg-gray-100 text-gray-600' },
  ACTIVE: { label: 'Aktīvs', className: 'bg-green-100 text-green-700' },
  COMPLETED: { label: 'Pabeigts', className: 'bg-slate-100 text-slate-600' },
  EXPIRED: { label: 'Beidzies', className: 'bg-gray-100 text-gray-400' },
  CANCELLED: { label: 'Atcelts', className: 'bg-red-100 text-red-600' },
};

// ── Company types ─────────────────────────────────────────────────────────────

export const COMPANY_TYPE_CONFIG: Record<string, TwBadgeCfg> = {
  SUPPLIER: { label: 'Piegādātājs', className: 'bg-blue-50 text-blue-700' },
  CARRIER: { label: 'Pārvadātājs', className: 'bg-purple-50 text-purple-700' },
  CONSTRUCTION: { label: 'Celtniecība', className: 'bg-amber-50 text-amber-700' },
  RECYCLER: { label: 'Pārstrāde', className: 'bg-green-50 text-green-700' },
  HYBRID: { label: 'Jaukts', className: 'bg-pink-50 text-pink-700' },
};
