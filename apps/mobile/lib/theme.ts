/**
 * theme.ts — Single source of truth for design tokens.
 *
 * Replace any raw hex used across the app with a reference to this file.
 * Changing a value here propagates everywhere.
 */

// ── Palette ───────────────────────────────────────────────────────────────────
export const colors = {
  // Brand / primary
  primary: '#111827',       // almost-black — CTAs, active icons, headlines
  primaryDark: '#030712',   // pressed state for primary
  primaryMid: '#374151',    // secondary labels, dark-gray UI elements

  // Backgrounds
  bgScreen: '#f2f2f7',      // tab-based screen background (iOS system grouped)
  bgCard: '#ffffff',        // card / sheet surface
  bgSubtle: '#f9fafb',      // subtle background (settings scroll area)
  bgMuted: '#f3f4f6',       // muted well, icon backgrounds, skeleton base

  // Borders
  border: '#e5e7eb',        // hairline borders, dividers
  borderFocus: '#111827',   // input focused border

  // Text
  textPrimary: '#111827',   // primary body text
  textSecondary: '#374151', // secondary / label text
  textMuted: '#6b7280',     // placeholder, meta text
  textDisabled: '#9ca3af',  // disabled, inactive tab labels

  // Semantic
  success: '#059669',       // green — delivered, accepted, active
  successBg: '#d1fae5',     // green background tint
  successText: '#15803d',   // green text on light background

  warning: '#d97706',       // amber
  warningBg: '#fef3c7',
  warningText: '#92400e',

  danger: '#dc2626',        // red — destructive, error
  dangerBg: '#fee2e2',
  dangerText: '#b91c1c',

  // Neutral status badges
  badgeNeutralBg: '#f3f4f6',
  badgeNeutralText: '#6b7280',

  // Misc
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
export const fontSizes = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ── Spacing ───────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

// ── Radius ────────────────────────────────────────────────────────────────────
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const shadows = {
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
} as const;
