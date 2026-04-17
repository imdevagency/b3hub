/**
 * Shared types, constants, data and date helpers for the skip-hire order wizard.
 */

import { Dimensions } from 'react-native';
import type { SkipSize, SkipWasteCategory } from '@/lib/api';
import type { LucideIcon } from 'lucide-react-native';
import { Trash2, Leaf, Hammer, TreePine, Wrench, Cpu } from 'lucide-react-native';
import { colors } from '@/lib/theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Constants ─────────────────────────────────────────────────────────────────

export const RIGA: [number, number] = [24.1052, 56.9496];

/** Map section heights — animates between step 1 (large) and steps 2-4 (small strip) */
export const MAP_FULL = Math.round(SCREEN_H * 0.46);
export const MAP_SMALL = Math.round(SCREEN_H * 0.22);

// ── Data ──────────────────────────────────────────────────────────────────────

export const WASTE_ICONS: Record<SkipWasteCategory, LucideIcon> = {
  MIXED: Trash2,
  GREEN_GARDEN: Leaf,
  CONCRETE_RUBBLE: Hammer,
  WOOD: TreePine,
  METAL_SCRAP: Wrench,
  ELECTRONICS_WEEE: Cpu,
};

export const WASTE_TYPES: SkipWasteCategory[] = [
  'MIXED',
  'GREEN_GARDEN',
  'CONCRETE_RUBBLE',
  'WOOD',
  'METAL_SCRAP',
  'ELECTRONICS_WEEE',
];

export const SIZES: Array<{ id: SkipSize; price: number; color: string; heightPct: number }> = [
  { id: 'MINI', price: 89, color: colors.textSecondary, heightPct: 0.28 },
  { id: 'MIDI', price: 129, color: colors.textPrimary, heightPct: 0.48 },
  { id: 'BUILDERS', price: 169, color: colors.textDisabled, heightPct: 0.68 },
  { id: 'LARGE', price: 199, color: colors.textPrimary, heightPct: 0.88 },
];

export const SKIP_PRICES: Record<string, number> = { MINI: 89, MIDI: 129, BUILDERS: 169, LARGE: 199 };

// ── Date helpers ──────────────────────────────────────────────────────────────

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('lv-LV', {
    day: 'numeric',
    month: 'short',
  });
}
