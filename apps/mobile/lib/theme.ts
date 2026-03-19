/**
 * theme.ts — Single source of truth for design tokens.
 *
 * All primitive values live in lib/tokens.js (plain JS so tailwind.config.js
 * can require() them at build time). This file re-exports them typed so
 * components get full IntelliSense.
 *
 * Usage in StyleSheet (when you need exact numeric values):
 *   import { colors, spacing, fontSizes, radius, shadows } from '@/lib/theme';
 *   const styles = StyleSheet.create({
 *     label: { fontSize: fontSizes.sm, color: colors.textMuted },
 *     card:  { padding: spacing.base, borderRadius: radius.lg, ...shadows.card },
 *   });
 *
 * Usage in NativeWind className (preferred for new UI code):
 *   <View className="bg-card p-base rounded-lg" />
 *   <Text className="text-text-muted" />
 *   <View className="border-border rounded-md gap-sm" />
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require('./tokens.js') as {
  colors: {
    primary: string; primaryDark: string; primaryMid: string;
    bgScreen: string; bgCard: string; bgSubtle: string; bgMuted: string;
    border: string; borderFocus: string;
    textPrimary: string; textSecondary: string; textMuted: string; textDisabled: string;
    success: string; successBg: string; successText: string;
    warning: string; warningBg: string; warningText: string;
    danger: string; dangerBg: string; dangerText: string;
    badgeNeutralBg: string; badgeNeutralText: string;
    white: string; black: string; overlay: string;
  };
  spacing: { xs: number; sm: number; md: number; base: number; lg: number; xl: number; '2xl': number; '3xl': number };
  radius:  { sm: number; md: number; lg: number; xl: number; full: number };
  fontSizes: { xs: number; sm: number; base: number; md: number; lg: number; xl: number; '2xl': number; '3xl': number; '4xl': number };
  fontWeights: { regular: string; medium: string; semibold: string; bold: string; extrabold: string };
  shadows: {
    card:  { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
    sheet: { shadowColor: string; shadowOffset: { width: number; height: number }; shadowOpacity: number; shadowRadius: number; elevation: number };
  };
};

export const colors      = tokens.colors;
export const spacing     = tokens.spacing;
export const radius      = tokens.radius;
export const fontSizes   = tokens.fontSizes;
export const fontWeights = tokens.fontWeights;
export const shadows     = tokens.shadows;
