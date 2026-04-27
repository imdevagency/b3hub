/**
 * tokens.js — Design token primitives (plain JS, no TypeScript).
 *
 * This file is required by tailwind.config.js at build time, and imported
 * by lib/theme.ts at runtime, keeping a single source of truth for all
 * design values while satisfying both Node.js (Tailwind) and TypeScript
 * (components) build pipelines.
 *
 * DO NOT add TypeScript syntax to this file.
 */

// ── Palette ───────────────────────────────────────────────────────────────────
const colors = {
  // Brand / primary
  primary: '#F9423A',
  primaryDark: '#030712',
  primaryMid: '#374151',

  // Backgrounds
  bgScreen: '#f2f2f7',
  bgCard: '#ffffff',
  bgSubtle: '#f9fafb',
  bgMuted: '#f3f4f6',

  // Borders
  border: '#e5e7eb',
  borderFocus: '#111827',

  // Text
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textDisabled: '#9ca3af',

  // Semantic
  success: '#059669',
  successBg: '#d1fae5',
  successText: '#15803d',
  warning: '#b45309',
  warningBg: '#fef3c7',
  warningText: '#78350f',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',

  // Neutral badge
  badgeNeutralBg: '#f3f4f6',
  badgeNeutralText: '#6b7280',

  // Misc
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
};

// ── Spacing ───────────────────────────────────────────────────────────────────
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
};

// ── Border radius ─────────────────────────────────────────────────────────────
const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

// ── Typography ────────────────────────────────────────────────────────────────
const fontSizes = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
};

const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

// ── Shadows ───────────────────────────────────────────────────────────────────
const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
};

module.exports = { colors, spacing, radius, fontSizes, fontWeights, shadows };
