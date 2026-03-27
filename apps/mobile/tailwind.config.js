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
      // ── Fonts ────────────────────────────────────────────────────────────────
      // Map each weight class to the matching Expo-loaded Inter font face name.
      // On iOS, fontFamily must be the exact loaded face — fontWeight alone
      // cannot synthesize bold from a custom font. This makes font-bold etc.
      // set { fontFamily: 'Inter_700Bold' } in addition to fontWeight, so
      // both iOS (fontFamily) and Android (fontWeight) work correctly.
      fontFamily: {
        // Only font-sans is safe here — all other weight keys (bold, semibold
        // etc.) conflict with Tailwind's built-in fontWeight plugin and get
        // overridden. Weight → fontFamily mapping is done in the plugin below.
        sans: ['Inter_400Regular'],
      },

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
  plugins: [
    // Override Tailwind's built-in font-weight utilities to ALSO set the
    // correct Expo-loaded Inter font-family face. On iOS, React Native cannot
    // synthesise bold/semibold weights from a custom font-family name — you
    // must reference the exact loaded face (e.g. Inter_700Bold).
    // User plugins run after all built-in plugins, so these definitions win.
    function ({ addUtilities }) {
      addUtilities({
        '.font-light':     { 'font-family': 'Inter_300Light',     'font-weight': '300' },
        '.font-normal':    { 'font-family': 'Inter_400Regular',   'font-weight': '400' },
        '.font-medium':    { 'font-family': 'Inter_500Medium',    'font-weight': '500' },
        '.font-semibold':  { 'font-family': 'Inter_600SemiBold',  'font-weight': '600' },
        '.font-bold':      { 'font-family': 'Inter_700Bold',      'font-weight': '700' },
        '.font-extrabold': { 'font-family': 'Inter_800ExtraBold', 'font-weight': '800' },
        '.font-black':     { 'font-family': 'Inter_800ExtraBold', 'font-weight': '900' },
      });
    },
  ],
};
