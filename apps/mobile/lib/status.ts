/**
 * status.ts — Shared status label + colour maps.
 *
 * Single source of truth for translating raw DB enum strings into human-
 * readable Latvian labels and StatusPill colours. Replaces the scattered
 * getStatusStyle / getStatusColors / getStatusMeta / formatStatus helpers
 * that were copy-pasted across messages.tsx, orders.tsx, seller/order/[id].tsx,
 * seller/incoming.tsx, and buyer/order/[id].tsx.
 *
 * Usage:
 *   import { ORDER_STATUS_MAP, JOB_STATUS_MAP, getOrderStatus, getJobStatus } from '@/lib/status';
 *
 *   // Direct map lookup (returns { label, bg, color }):
 *   const st = getOrderStatus(order.status);
 *   <StatusPill label={st.label} bg={st.bg} color={st.color} />
 */

import { colors } from '@/lib/theme';

export interface StatusEntry {
  label: string;
  bg: string;
  color: string;
}

// ─── Order status ─────────────────────────────────────────────────────────────

export const ORDER_STATUS_MAP: Record<string, StatusEntry> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: '#6b7280' },
  PENDING: { label: 'Gaida', bg: '#fffbeb', color: '#92400e' },
  SUBMITTED: { label: 'Iesniegts', bg: '#fffbeb', color: '#92400e' },
  CONFIRMED: { label: 'Apstiprināts', bg: '#eff6ff', color: '#1d4ed8' },
  IN_PROGRESS: { label: 'Izpildē', bg: '#eff6ff', color: '#1d4ed8' },
  LOADING: { label: 'Iekraujas', bg: '#ede9fe', color: '#6d28d9' },
  IN_TRANSIT: { label: 'Ceļā', bg: '#eff6ff', color: '#1d4ed8' },
  DELIVERED: { label: 'Piegādāts', bg: colors.successBg, color: colors.successText },
  COLLECTED: { label: 'Savākts', bg: colors.successBg, color: colors.successText },
  COMPLETED: { label: 'Pabeigts', bg: colors.successBg, color: colors.successText },
  ACCEPTED: { label: 'Pieņemts', bg: '#eff6ff', color: '#1d4ed8' },
  REJECTED: { label: 'Noraidīts', bg: colors.dangerBg, color: colors.dangerText },
  CANCELLED: { label: 'Atcelts', bg: colors.dangerBg, color: colors.dangerText },
};

export function getOrderStatus(status: string): StatusEntry {
  return (
    ORDER_STATUS_MAP[status] ?? {
      label: status,
      bg: colors.badgeNeutralBg,
      color: colors.badgeNeutralText,
    }
  );
}

// ─── Transport job status ─────────────────────────────────────────────────────

export const JOB_STATUS_MAP: Record<string, StatusEntry> = {
  PENDING: { label: 'Gaida', bg: '#f3f4f6', color: colors.textMuted },
  ACCEPTED: { label: 'Pieņemts', bg: '#eff6ff', color: '#1d4ed8' },
  EN_ROUTE_PICKUP: { label: 'Dodas uz iekraušanu', bg: '#fffbeb', color: '#92400e' },
  AT_PICKUP: { label: 'Pie iekraušanas', bg: '#fffbeb', color: '#92400e' },
  LOADED: { label: 'Iekrauts', bg: '#f0fdf4', color: '#166534' },
  EN_ROUTE_DELIVERY: { label: 'Dodas pie jums', bg: colors.successBg, color: colors.successText },
  AT_DELIVERY: { label: 'Pie jums', bg: colors.successBg, color: colors.successText },
  DELIVERED: { label: 'Piegādāts', bg: '#f0fdf4', color: '#166534' },
  COMPLETED: { label: 'Pabeigts', bg: '#f0fdf4', color: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: colors.dangerBg, color: colors.dangerText },
  FAILED: { label: 'Neizdevās', bg: colors.dangerBg, color: colors.dangerText },
};

export function getJobStatus(status: string): StatusEntry {
  return (
    JOB_STATUS_MAP[status] ?? {
      label: status,
      bg: colors.badgeNeutralBg,
      color: colors.badgeNeutralText,
    }
  );
}

// ─── Framework contract status ────────────────────────────────────────────────

export const FRAMEWORK_CONTRACT_STATUS_MAP: Record<string, StatusEntry> = {
  DRAFT: { label: 'Melnraksts', bg: '#f3f4f6', color: colors.textMuted },
  ACTIVE: { label: 'Aktīvs', bg: '#ecfdf5', color: '#10b981' },
  COMPLETED: { label: 'Pabeigts', bg: '#f8fafc', color: '#64748b' },
  EXPIRED: { label: 'Beidzies', bg: '#f3f4f6', color: colors.textDisabled },
  CANCELLED: { label: 'Atcelts', bg: '#fef2f2', color: '#ef4444' },
};

export function getFrameworkContractStatus(status: string): StatusEntry {
  return FRAMEWORK_CONTRACT_STATUS_MAP[status] ?? { label: status, bg: '#f3f4f6', color: colors.textMuted };
}

// ─── Quote response status ────────────────────────────────────────────────────

export const QUOTE_RESPONSE_STATUS_MAP: Record<string, StatusEntry> = {
  PENDING: { label: 'Gaida', bg: '#f3f4f6', color: colors.textMuted },
  ACCEPTED: { label: 'Pieņemts', bg: '#dcfce7', color: '#16a34a' },
  REJECTED: { label: 'Noraidīts', bg: '#fee2e2', color: colors.danger },
  EXPIRED: { label: 'Beidzies', bg: '#f9fafb', color: colors.textDisabled },
};

export function getQuoteResponseStatus(status: string): StatusEntry {
  return QUOTE_RESPONSE_STATUS_MAP[status] ?? QUOTE_RESPONSE_STATUS_MAP.PENDING;
}

// ─── Document status (driver/documents) ──────────────────────────────────────

export const DOCUMENT_STATUS_MAP: Record<string, string> = {
  DRAFT: 'Melnraksts',
  ISSUED: 'Izdots',
  SIGNED: 'Parakstīts',
  ARCHIVED: 'Arhivēts',
  EXPIRED: 'Beidzies',
};

export function getDocumentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_MAP[status] ?? status;
}

// ─── Recycler job status (recycler/incoming) ──────────────────────────────────

export const RECYCLER_JOB_STATUS_MAP: Record<string, StatusEntry> = {
  AVAILABLE: { label: 'Gaida', bg: '#fef3c7', color: '#92400e' },
  ASSIGNED: { label: 'Piešķirts', bg: '#dbeafe', color: '#1d4ed8' },
  IN_PROGRESS: { label: 'Ceļā', bg: '#e0f2fe', color: '#0369a1' },
  DELIVERED: { label: 'Piegādāts', bg: '#dcfce7', color: '#166534' },
  COMPLETED: { label: 'Pabeigts', bg: '#dcfce7', color: '#166534' },
  CANCELLED: { label: 'Atcelts', bg: '#fee2e2', color: colors.danger },
};

export function getRecyclerJobStatus(status: string): StatusEntry {
  return RECYCLER_JOB_STATUS_MAP[status] ?? { label: status, bg: '#f3f4f6', color: colors.textMuted };
}

// ─── Driver job labels (buyer/orders — shown to buyer about their driver) ─────
// These override the generic JOB_STATUS_MAP labels with buyer-facing phrasing.

export const DRIVER_JOB_BUYER_LABELS: Record<string, string> = {
  ACCEPTED: 'Šoferis apstiprināja',
  EN_ROUTE_PICKUP: 'Uz iekraušanu',
  AT_PICKUP: 'Iekraujas',
  LOADED: 'Krava iekrauta',
  EN_ROUTE_DELIVERY: 'Piegādē',
  AT_DELIVERY: 'Šoferis uz vietas',
};
