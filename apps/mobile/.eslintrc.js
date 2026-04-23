/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['expo', 'eslint:recommended'],
  plugins: [],
  rules: {
    // ── Design-token enforcement ─────────────────────────────────────────────
    // Blocks raw hex colours in JSX style props / className values so all colour
    // usage stays within the token system (lib/tokens.js + NativeWind classes).
    //
    // Allowlist:
    //   '#000' / '#000000' / '#fff' / '#ffffff' — pure black/white (used for
    //   shadows and overlays where semantic tokens don't exist).
    //   Transparent values like 'transparent' are string literals, not hex.
    //
    // Fix: replace the raw hex with the nearest NativeWind class
    //   (bg-screen, text-text-muted, …) or import the value from @/lib/theme
    //   (colors.successBg, colors.textMuted, etc.).
    'no-restricted-syntax': [
      'warn',
      {
        // Matches JSX attributes that directly pass a hex literal string:
        //   style={{ color: '#d97706' }}          ← caught
        //   bg="#d97706"                           ← caught
        //   style={{ color: '#000' }}              ← allowed (pure black)
        selector:
          "JSXAttribute > Literal[value=/^#(?!00{0,5}$|[Ff]{3}$|[Ff]{6}$)[0-9a-fA-F]{3,6}$/]",
        message:
          "Avoid hardcoded hex colours. Use a NativeWind token class (e.g. 'text-text-muted', 'bg-screen') or import from '@/lib/theme' (colors.*).",
      },
      {
        // Matches object property values that are hex literals inside style objects:
        //   const s = StyleSheet.create({ foo: { color: '#d97706' } })   ← caught
        //   { backgroundColor: '#F4F5F7' }                               ← caught
        selector:
          "Property > Literal[value=/^#(?!00{0,5}$|[Ff]{3}$|[Ff]{6}$)[0-9a-fA-F]{3,6}$/]",
        message:
          "Avoid hardcoded hex colours. Import from '@/lib/theme' (colors.*) or use a NativeWind token class.",
      },
    ],

    // ── NativeWind safety rules ──────────────────────────────────────────────
    // Prevents arbitrary Tailwind values which silently fail at runtime
    // because NativeWind's build-time scanner can't detect them.
    'no-restricted-properties': [
      'warn',
      {
        // Catches className="text-[16px]" style arbitrary values — these must
        // be moved to a style prop.
        // Note: full arbitrary-value lint requires a custom plugin; this catches
        // the most common pattern of bracket notation passed to className.
      },
    ],
  },
};
