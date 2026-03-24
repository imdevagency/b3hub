/**
 * Types, constants and static data for the order-request flow.
 */

import { CATEGORY_LABELS } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type MaterialCategoryAll = MaterialCategory | 'ALL';

export type Step =
  | 'map'
  | 'material'
  | 'configure'
  | 'offers'
  | 'sent'       // RFQ submitted — fire-and-forget confirmation
  | 'quotes'
  | 'confirm'
  | 'success';

// ── Constants ────────────────────────────────────────────────────

export const RIGA: LatLng = { latitude: 56.9496, longitude: 24.1052 };

// CATEGORY_LABELS imported from @/lib/materials
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as MaterialCategoryAll[];

export const CATEGORY_COLOR: Record<string, string> = {
  ALL: '#6b7280',
  SAND: '#6b7280',
  GRAVEL: '#64748b',
  STONE: '#6b7280',
  CONCRETE: '#4b5563',
  SOIL: '#6b7280',
  RECYCLED_CONCRETE: '#059669',
  RECYCLED_SOIL: '#111827',
  ASPHALT: '#374151',
  CLAY: '#6b7280',
  OTHER: '#6b7280',
};

// UNIT_SHORT — imported from @/lib/materials

export const FRACTIONS: Record<string, string[]> = {
  DEFAULT: ['0/4', '0/8', '0/16', '0/32', '0/45', '4/16', '8/32', '16/45'],
  SAND: ['0/4', '0/8', '0.1/0.3', '0.5/1', 'Smalkas', 'Rupjas'],
  GRAVEL: ['0/8', '0/16', '0/32', '4/8', '8/16', '16/32', '16/45', '32/63'],
  STONE: ['0/32', '0/45', '16/45', '32/63', '45/90'],
  CONCRETE: ['B20', 'B25', 'B30', 'B35', 'B40'],
  ASPHALT: ['0/8', '0/11', '0/16', 'SMA-11', 'SMA-16'],
  RECYCLED_CONCRETE: ['0/32', '0/45', '16/45', '32/63'],
  RECYCLED_SOIL: ['0/45', '0/63', 'Jaukta'],
};

export const VEHICLES = [
  { id: 'TIPPER_26T', label: '26 t', emoji: '🚛', sub: '6×4' },
  { id: 'TIPPER_20T', label: '20 t', emoji: '🚚', sub: '8×4' },
  { id: 'TIPPER_15T', label: '15 t', emoji: '🚜', sub: '4×4' },
];
