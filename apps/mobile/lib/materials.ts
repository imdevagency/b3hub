/**
 * Mobile material constants.
 * CATEGORY_LABELS and UNIT_SHORT are re-exported from @b3hub/shared — the
 * monorepo's single source of truth for these values.
 * Update packages/shared/src/materials.ts to change labels across all apps.
 */

export {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_MATERIAL_NAMES,
  UNIT_SHORT,
  UNIT_LONG,
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  MATERIAL_DENSITY,
  type MaterialFraction,
  type MaterialCategory,
  type MaterialCategoryAll,
  type MaterialUnit,
} from '@b3hub/shared';

import { colors } from '@/lib/theme';

// ── Category accent colors (used for icon tints, pill highlights) ──

export const CATEGORY_ACCENT: Record<string, string> = {
  ALL: '#111827',
  SAND: '#d97706',
  GRAVEL: '#475569',
  STONE: '#334155',
  CONCRETE: '#6b7280',
  SOIL: '#92400e',
  RECYCLED_CONCRETE: '#16a34a',
  RECYCLED_SOIL: '#059669',
  ASPHALT: '#44403c',
  CLAY: '#c2410c',
  OTHER: '#6b7280',
};

// ── Category icon emoji (used in order-request flow) ──────────

export const CATEGORY_ICON: Record<string, string> = {
  ALL: '📦',
  SAND: '🏜️',
  GRAVEL: '🪨',
  STONE: '🗿',
  CONCRETE: '🧱',
  SOIL: '🌱',
  RECYCLED_CONCRETE: '♻️',
  RECYCLED_SOIL: '🌿',
  ASPHALT: '🛣️',
  CLAY: '🟤',
  OTHER: '📦',
};

// ── Order status label maps ────────────────────────────────────

export const MAT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'Gaida',        bg: '#f3f4f6', color: colors.textMuted },
  CONFIRMED:  { label: 'Apstiprināts',  bg: '#e5e7eb', color: colors.textPrimary },
  PROCESSING: { label: 'Apstrādā',      bg: '#e5e7eb', color: colors.textPrimary },
  SHIPPED:    { label: 'Ceļā',           bg: '#e5e7eb', color: colors.textPrimary },
  DELIVERED:  { label: 'Piegādāts',     bg: '#111827', color: '#f9fafb' },
  CANCELLED:  { label: 'Atcelts',      bg: '#f9fafb', color: colors.textDisabled },
};

export const TJB_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  AVAILABLE:         { label: 'Gaida pārvadātāju',  bg: '#f3f4f6', color: colors.textMuted },
  ASSIGNED:          { label: 'Pārvadātājs atrasts', bg: '#e5e7eb', color: colors.textPrimary },
  ACCEPTED:          { label: 'Apstiprināts',            bg: '#e5e7eb', color: colors.textPrimary },
  EN_ROUTE_PICKUP:   { label: 'Brauc uz iekraušanu',          bg: '#e5e7eb', color: colors.textPrimary },
  AT_PICKUP:         { label: 'Iekraujas',                          bg: '#e5e7eb', color: colors.textPrimary },
  LOADED:            { label: 'Iekrauts',                           bg: '#e5e7eb', color: colors.textPrimary },
  EN_ROUTE_DELIVERY: { label: 'Ceļā',                     bg: '#e5e7eb', color: colors.textPrimary },
  AT_DELIVERY:       { label: 'Piegādā',                  bg: '#e5e7eb', color: colors.textPrimary },
  DELIVERED:         { label: 'Piegādāts',                          bg: '#111827', color: '#f9fafb' },
  CANCELLED:         { label: 'Atcelts',                            bg: '#f9fafb', color: colors.textDisabled },
};

/** User account status labels (profile screens). */
export const ACCOUNT_STATUS: Record<string, string> = {
  ACTIVE:    'Aktīvs',
  PENDING:   'Gaida apstiprināšanu',
  SUSPENDED: 'Apturēts',
  INACTIVE:  'Neaktīvs',
};

// ── Skip-hire container size labels ──────────────────────────────────
export const SIZE_LABEL: Record<string, string> = {
  MINI:     'Mini · 2 m³',
  MIDI:     'Midi · 4 m³',
  BUILDERS: 'Celtniec. · 6 m³',
  LARGE:    'Liels · 8 m³',
};
