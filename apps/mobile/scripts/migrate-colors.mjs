/**
 * migrate-colors.mjs
 *
 * Replaces hardcoded hex color strings inside StyleSheet.create blocks
 * (and other inline style objects) with their semantic token equivalents
 * from lib/tokens.js.
 *
 * Run from apps/mobile:  node scripts/migrate-colors.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

// ── Colour maps ────────────────────────────────────────────────────────────

/** color / tintColor / borderColor / outlineColor → textual colour tokens */
const TEXT_COLOR_MAP = {
  "'#111827'": 'colors.textPrimary',
  '"#111827"': 'colors.textPrimary',
  "'#374151'": 'colors.textSecondary',
  '"#374151"': 'colors.textSecondary',
  "'#6b7280'": 'colors.textMuted',
  '"#6b7280"': 'colors.textMuted',
  "'#6B7280'": 'colors.textMuted',
  '"#6B7280"': 'colors.textMuted',
  "'#9ca3af'": 'colors.textDisabled',
  '"#9ca3af"': 'colors.textDisabled',
  "'#9CA3AF'": 'colors.textDisabled',
  '"#9CA3AF"': 'colors.textDisabled',
  "'#e5e7eb'": 'colors.border',
  '"#e5e7eb"': 'colors.border',
  "'#E5E7EB'": 'colors.border',
  '"#E5E7EB"': 'colors.border',
  "'#ffffff'": 'colors.white',
  '"#ffffff"': 'colors.white',
  "'#FFFFFF'": 'colors.white',
  '"#FFFFFF"': 'colors.white',
  "'#dc2626'": 'colors.danger',
  '"#dc2626"': 'colors.danger',
  "'#b91c1c'": 'colors.dangerText',
  '"#b91c1c"': 'colors.dangerText',
  "'#059669'": 'colors.success',
  '"#059669"': 'colors.success',
  "'#15803d'": 'colors.successText',
  '"#15803d"': 'colors.successText',
};

/** backgroundColor → background colour tokens */
const BG_COLOR_MAP = {
  "'#111827'": 'colors.primary',
  '"#111827"': 'colors.primary',
  "'#374151'": 'colors.primaryMid',
  '"#374151"': 'colors.primaryMid',
  "'#f3f4f6'": 'colors.bgMuted',
  '"#f3f4f6"': 'colors.bgMuted',
  "'#F3F4F6'": 'colors.bgMuted',
  '"#F3F4F6"': 'colors.bgMuted',
  "'#f9fafb'": 'colors.bgSubtle',
  '"#f9fafb"': 'colors.bgSubtle',
  "'#ffffff'": 'colors.bgCard',
  '"#ffffff"': 'colors.bgCard',
  "'#FFFFFF'": 'colors.bgCard',
  '"#FFFFFF"': 'colors.bgCard',
  "'#d1fae5'": 'colors.successBg',
  '"#d1fae5"': 'colors.successBg',
  "'#fee2e2'": 'colors.dangerBg',
  '"#fee2e2"': 'colors.dangerBg',
  "'#fef3c7'": 'colors.warningBg',
  '"#fef3c7"': 'colors.warningBg',
  "'#dc2626'": 'colors.danger',
  '"#dc2626"': 'colors.danger',
};

// Properties that carry a text/border colour
const TEXT_PROPS = [
  'color',
  'tintColor',
  'borderColor',
  'borderTopColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderRightColor',
  'outlineColor',
];
// Properties that carry a background colour
const BG_PROPS = ['backgroundColor'];

// ── Regex builders ─────────────────────────────────────────────────────────

function buildPropRegex(prop, hexQuoted) {
  // Matches:  prop: '#111827'  or  prop: "#111827"
  // Escaped hex: '#111827' is already quoted in the map key
  const hexLiteral = hexQuoted.slice(1, -1); // strip outer quotes
  const quoteChar = hexQuoted[0] === "'" ? "'" : '"';
  return new RegExp(
    `(\\b${prop}\\s*:\\s*)${quoteChar}${hexLiteral.replace(/#/, '#')}${quoteChar}`,
    'g',
  );
}

// ── Process one file ───────────────────────────────────────────────────────

function processFile(filePath) {
  let src = readFileSync(filePath, 'utf8');
  const original = src;
  let mutations = 0;

  for (const prop of TEXT_PROPS) {
    for (const [hexQuoted, token] of Object.entries(TEXT_COLOR_MAP)) {
      const re = buildPropRegex(prop, hexQuoted);
      const replaced = src.replace(re, `$1${token}`);
      if (replaced !== src) {
        mutations += (src.match(re) ?? []).length;
        src = replaced;
      }
    }
  }

  for (const prop of BG_PROPS) {
    for (const [hexQuoted, token] of Object.entries(BG_COLOR_MAP)) {
      const re = buildPropRegex(prop, hexQuoted);
      const replaced = src.replace(re, `$1${token}`);
      if (replaced !== src) {
        mutations += (src.match(re) ?? []).length;
        src = replaced;
      }
    }
  }

  if (src === original) return 0;

  // Ensure `colors` is imported from '@/lib/theme'
  if (!src.includes("from '@/lib/theme'") && !src.includes('from "@/lib/theme"')) {
    // Insert after the last import from 'react-native' or any import block
    const lastImportMatch = [...src.matchAll(/^import .+from .+;$/gm)].pop();
    if (lastImportMatch) {
      const insertAt = lastImportMatch.index + lastImportMatch[0].length;
      src = src.slice(0, insertAt) + "\nimport { colors } from '@/lib/theme';" + src.slice(insertAt);
    }
  } else if (src.includes("from '@/lib/theme'") || src.includes('from "@/lib/theme"')) {
    // File already imports from '@/lib/theme' — make sure `colors` is in the destructure
    src = src.replace(
      /import\s+\{([^}]+)\}\s+from\s+['"]@\/lib\/theme['"]/,
      (match, imports) => {
        const parts = imports.split(',').map((s) => s.trim()).filter(Boolean);
        if (!parts.includes('colors')) {
          parts.unshift('colors');
        }
        return `import { ${parts.join(', ')} } from '@/lib/theme'`;
      },
    );
  }

  writeFileSync(filePath, src, 'utf8');
  return mutations;
}

// ── Main ───────────────────────────────────────────────────────────────────

const files = globSync('**/*.{tsx,ts}', {
  cwd: process.cwd(),
  ignore: [
    'node_modules/**',
    'scripts/**',
    'lib/tokens.js',
    'lib/theme.ts',
    '.expo/**',
    'dist/**',
  ],
});

let totalMutations = 0;
let totalFiles = 0;

for (const file of files) {
  const abs = path.resolve(process.cwd(), file);
  const count = processFile(abs);
  if (count > 0) {
    console.log(`  ${count} replacement(s) — ${file}`);
    totalFiles++;
    totalMutations += count;
  }
}

console.log(`\nDone: ${totalMutations} replacements across ${totalFiles} files.`);
