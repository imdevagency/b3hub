/**
 * tailwind.config.js
 *
 * Custom tokens are declared once in lib/theme.ts and referenced here so that
 * every NativeWind className in the app can use semantic names instead of raw
 * hex values or magic numbers.
 *
 * Usage examples in components:
 *   className="bg-card text-primary"           ← colors
 *   className="text-sm font-semibold"          ← typography (Tailwind defaults)
 *   className="p-base rounded-lg"              ← spacing / radius
 *
 * When a design value changes, update lib/theme.ts — it propagates everywhere.
 */

const { colors, spacing, radius } = require('./lib/tokens.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ── Brand ────────────────────────────────────────────────────────────
        primary:        colors.primary,       // bg-primary / text-primary
        'primary-dark': colors.primaryDark,
        'primary-mid':  colors.primaryMid,

        // ── Backgrounds ──────────────────────────────────────────────────────
        screen:         colors.bgScreen,      // bg-screen  (tab screen bg)
        card:           colors.bgCard,        // bg-card    (white card)
        subtle:         colors.bgSubtle,      // bg-subtle
        muted:          colors.bgMuted,       // bg-muted

        // ── Borders ───────────────────────────────────────────────────────────
        border:         colors.border,        // border-border
        'border-focus': colors.borderFocus,

        // ── Text ──────────────────────────────────────────────────────────────
        'text-primary':   colors.textPrimary,   // text-text-primary
        'text-secondary': colors.textSecondary,
        'text-muted':     colors.textMuted,
        'text-disabled':  colors.textDisabled,

        // ── Semantic ──────────────────────────────────────────────────────────
        success:          colors.success,
        'success-bg':     colors.successBg,
        'success-text':   colors.successText,
        warning:          colors.warning,
        'warning-bg':     colors.warningBg,
        danger:           colors.danger,
        'danger-bg':      colors.dangerBg,
        'danger-text':    colors.dangerText,

        // ── Badge neutrals ────────────────────────────────────────────────────
        'badge-bg':       colors.badgeNeutralBg,
        'badge-text':     colors.badgeNeutralText,

        overlay:          colors.overlay,
      },

      // ── Spacing ─────────────────────────────────────────────────────────────
      // Adds p-xs, p-sm, p-md, p-base, p-lg, p-xl, p-2xl, p-3xl
      // (and gap-*, m-*, etc.)
      spacing: {
        xs:   spacing.xs,   // 4
        sm:   spacing.sm,   // 8
        md:   spacing.md,   // 12
        base: spacing.base, // 16
        lg:   spacing.lg,   // 20
        xl:   spacing.xl,   // 24
        '2xl': spacing['2xl'], // 32
        '3xl': spacing['3xl'], // 40
      },

      // ── Border radius ────────────────────────────────────────────────────────
      // Adds rounded-xs, rounded-md, rounded-lg, rounded-xl, rounded-full
      borderRadius: {
        xs:   radius.sm,   // 6
        md:   radius.md,   // 10
        lg:   radius.lg,   // 14
        xl:   radius.xl,   // 20
        full: radius.full, // 999
      },
    },
  },
  plugins: [],
};
