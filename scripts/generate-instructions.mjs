#!/usr/bin/env node
/**
 * generate-instructions.mjs
 *
 * Single source of truth for all AI instruction files.
 * Reads real source code and injects accurate, up-to-date sections
 * into the scoped instruction files that Copilot loads automatically.
 *
 * What is GENERATED (this script) vs HAND-WRITTEN (humans maintain):
 *   GENERATED  — model shapes, enum values, prop interfaces, CVA variants,
 *                route groups, RequestingUser type, API prefix, module list
 *   HAND-WRITTEN — product context, "when to use" guidance, code examples,
 *                  architectural decisions, rules
 *
 * Outputs:
 *   .github/instructions/backend-schema.instructions.md   <- fully generated
 *   .github/instructions/web-components.instructions.md   <- markers injected
 *   .github/instructions/mobile-components.instructions.md<- markers injected
 *   .github/copilot-instructions.md                       <- markers injected
 *
 * Auto-runs on: npm run prisma:generate  and  npm run prisma:push
 * Manual run:   node scripts/generate-instructions.mjs
 *               npm run docs:generate
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Source files (truth)
const SCHEMA_FILE           = resolve(ROOT, 'apps/backend/prisma/schema.prisma');
const MAIN_TS               = resolve(ROOT, 'apps/backend/src/main.ts');
const APP_MODULE            = resolve(ROOT, 'apps/backend/src/app.module.ts');
const REQUESTING_USER_FILE  = resolve(ROOT, 'apps/backend/src/common/types/requesting-user.interface.ts');
const MOBILE_APP_DIR        = resolve(ROOT, 'apps/mobile/app');
const WEB_COMPONENTS_DIR    = resolve(ROOT, 'apps/web/src/components/ui');
const MOBILE_COMPONENTS_DIR = resolve(ROOT, 'apps/mobile/components/ui');

// Output files
const OUT_BACKEND = resolve(ROOT, '.github/instructions/backend-schema.instructions.md');
const OUT_WEB     = resolve(ROOT, '.github/instructions/web-components.instructions.md');
const OUT_MOBILE  = resolve(ROOT, '.github/instructions/mobile-components.instructions.md');
const OUT_COPILOT = resolve(ROOT, '.github/copilot-instructions.md');
const OUT_STATUS  = resolve(ROOT, 'STATUS.md');

// Non-feature backend dirs — excluded from module listing
const BACKEND_NON_FEATURE_DIRS = new Set([
  '@types', 'common', 'config', 'prisma', 'supabase',
]);

// ─── Marker injection ─────────────────────────────────────────────────────────
// Instruction files use <!-- GEN:key --> … <!-- END GEN --> markers.
// Content between them is replaced on every run.

function inject(filePath, key, content) {
  if (!existsSync(filePath)) {
    console.warn(`  skip: ${filePath} not found`);
    return;
  }
  const start = `<!-- GEN:${key} -->`;
  const end   = `<!-- END GEN -->`;
  const block = `${start}\n${content.trim()}\n${end}`;
  let text = readFileSync(filePath, 'utf8');
  if (text.includes(start)) {
    text = text.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    text = text.trimEnd() + `\n\n${block}\n`;
  }
  writeFileSync(filePath, text);
}

// ─── TypeScript interface parser ──────────────────────────────────────────────

function extractInterface(source, name) {
  const lines = source.split('\n');
  let depth = 0, inside = false;
  const result = [];
  for (const line of lines) {
    if (!inside && new RegExp(`(export\\s+)?interface\\s+${name}\\b`).test(line)) {
      inside = true; depth = 0;
    }
    if (inside) {
      result.push(line);
      depth += (line.match(/\{/g) || []).length;
      depth -= (line.match(/\}/g) || []).length;
      if (depth === 0 && result.length > 1) break;
    }
  }
  return result.join('\n').trim();
}

function extractPropsInterface(source, componentName) {
  const candidates = [
    `${componentName}Props`,
    ...[...source.matchAll(/(?:export\s+)?(?:interface|type)\s+(\w+Props)\b/g)].map(m => m[1]),
  ];
  for (const name of [...new Set(candidates)]) {
    const block = extractInterface(source, name);
    if (block) return { name, block };
  }
  return null;
}

function propsToTable(interfaceBlock) {
  // Strip JSDoc comments before scanning for fields
  const clean = interfaceBlock.replace(/\/\*\*[\s\S]*?\*\//g, '');
  const fieldRe = /^\s+(readonly\s+)?(\w+)(\??)\s*:\s*([^;\n]+);/gm;
  const rows = [];
  let m;
  while ((m = fieldRe.exec(clean)) !== null) {
    const field    = m[2];
    const optional = m[3] === '?';
    const type     = m[4].trim().replace(/\s+/g, ' ');
    rows.push(`| \`${field}\` | \`${type}\` | ${optional ? 'optional' : '**required**'} |`);
  }
  if (!rows.length) return null;
  return `| Prop | Type | |\n|------|------|---|\n${rows.join('\n')}`;
}

// ─── CVA variant extractor (shadcn web components) ───────────────────────────

function extractCvaVariants(source) {
  const result = {};
  const blockM = source.match(/variants:\s*\{([\s\S]*?)},\s*defaultVariants/);
  if (!blockM) return result;
  const sectRe = /(\w+):\s*\{([^}]+)\}/g;
  let m;
  while ((m = sectRe.exec(blockM[1])) !== null) {
    const keys = [...m[2].matchAll(/['"]([\w-]+)['"]\s*:/g)].map(k => k[1]);
    if (keys.length) result[m[1]] = keys;
  }
  return result;
}

// ─── Prisma schema parser ─────────────────────────────────────────────────────

function extractBlocks(lines, keyword) {
  const blocks = [];
  let inBlock = false, name = '', body = [];
  for (const line of lines) {
    if (!inBlock) {
      const m = line.match(new RegExp(`^${keyword}\\s+(\\w+)\\s*\\{`));
      if (m) { inBlock = true; name = m[1]; body = []; }
    } else {
      if (line === '}') { blocks.push({ name, body }); inBlock = false; }
      else body.push(line);
    }
  }
  return blocks;
}

function parseEnums(lines) {
  const enums = {};
  for (const { name, body } of extractBlocks(lines, 'enum')) {
    enums[name] = body.map(l => l.trim().replace(/\/\/.*/, '').trim()).filter(Boolean);
  }
  return enums;
}

function parseModels(lines, enumNames, modelNames) {
  return extractBlocks(lines, 'model').map(({ name, body }) => {
    let tableMap = name.toLowerCase() + 's';
    const scalars = [], enumFields = [], relations = [];
    for (const raw of body) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      const mapM = line.match(/^@@map\("(.+?)"\)/);
      if (mapM) { tableMap = mapM[1]; continue; }
      if (line.startsWith('@@')) continue;
      const fieldM = line.match(/^(\w+)\s+(\w+)(\??|\[\]?)\s*(.*)/);
      if (!fieldM) continue;
      const [, fieldName, rawType, modifier, annotations] = fieldM;
      const mods = [];
      if (annotations.includes('@id'))     mods.push('@id');
      if (annotations.includes('@unique')) mods.push('@unique');
      const defM = annotations.match(/@default\(([^)]+)\)/);
      if (defM) mods.push(`@default(${defM[1]})`);
      if (modelNames.has(rawType)) {
        relations.push(modifier === '[]' ? `${rawType}[]` : modifier === '?' ? `${rawType}?` : rawType);
      } else if (enumNames.has(rawType)) {
        enumFields.push(`\`${fieldName}\`${modifier === '?' ? '?' : ''}: ${rawType}${mods.length ? ` (${mods.join(', ')})` : ''}`);
      } else {
        scalars.push(`\`${fieldName}\`: ${modifier === '[]' ? rawType + '[]' : modifier === '?' ? rawType + '?' : rawType}${mods.length ? ' ' + mods.join(' ') : ''}`);
      }
    }
    return { name, tableMap, scalars, enumFields, relations };
  });
}

// ─── 1. Backend schema (fully generated) ─────────────────────────────────────

function generateBackendDocs() {
  const raw   = readFileSync(SCHEMA_FILE, 'utf8');
  const lines = raw.split('\n');
  const enums      = parseEnums(lines);
  const enumNames  = new Set(Object.keys(enums));
  const modelNames = new Set(extractBlocks(lines, 'model').map(b => b.name));
  const models     = parseModels(lines, enumNames, modelNames);

  const mainTs    = readFileSync(MAIN_TS, 'utf8');
  const prefixM   = mainTs.match(/setGlobalPrefix\(['"]([^'"]+)['"]\)/);
  const apiPrefix = prefixM ? prefixM[1] : 'api/v1';

  const appModule = readFileSync(APP_MODULE, 'utf8');
  const featureModules = [...appModule.matchAll(/import\s*\{\s*(\w+Module)\s*\}/g)]
    .map(m => m[1])
    .filter(m => !['Module', 'ThrottlerModule', 'ConfigModule', 'PrismaModule', 'SupabaseModule'].includes(m));

  const enumTable = `| Enum | Values |\n|------|--------|\n` +
    Object.entries(enums).map(([n, v]) => `| \`${n}\` | ${v.join(' ')} |`).join('\n');

  const modelSections = models.map(m => {
    const parts = [`### ${m.name} — \`@@map("${m.tableMap}")\``];
    if (m.scalars.length)    parts.push(`**Fields:** ${m.scalars.join(', ')}`);
    if (m.enumFields.length) parts.push(`**Enum fields:** ${m.enumFields.join(', ')}`);
    if (m.relations.length)  parts.push(`**Relations:** → ${m.relations.join(', ')}`);
    return parts.join('  \n');
  }).join('\n\n---\n\n');

  const doc = `---
applyTo: "apps/backend/**"
---

# Backend — DB Schema & Prisma Workflow

> **Auto-generated** from \`apps/backend/prisma/schema.prisma\` by \`scripts/generate-instructions.mjs\`.
> Do not edit manually — run \`npm run docs:generate\` (or \`prisma:generate\`) to refresh.
>
> **Trust contract:** regenerated automatically on every \`prisma:generate\` and \`prisma:push\`.
> Treat as accurate. Only regenerate manually if a field looks missing (means schema was edited without running generate).

Schema: \`apps/backend/prisma/schema.prisma\` (${lines.length} lines, ${models.length} models, ${Object.keys(enums).length} enums).
API prefix: \`/${apiPrefix}\` — all routes start with this (e.g. \`POST /${apiPrefix}/orders\`).
ORM: **Prisma**. Always inject \`PrismaService\` from \`src/prisma/prisma.module.ts\` — never import \`@prisma/client\` directly.
DB: PostgreSQL on Supabase. \`DATABASE_URL\` = pooler (transactions), \`DIRECT_URL\` = direct (migrations only).

---

## Registered feature modules

${featureModules.map(m => `- \`${m}\``).join('\n')}

---

## Prisma workflow commands (run from \`apps/backend/\`)

\`\`\`bash
npm run prisma:generate   # regenerates client typings + this docs file
npm run prisma:migrate    # creates migration file + applies to DB (you name it)
npm run prisma:push       # dev shortcut — sync schema without a migration file
npm run prisma:studio     # visual database browser
npm run db:seed           # reseed demo data
\`\`\`

**Rule:** always run \`prisma:generate\` after editing \`schema.prisma\`.

---

## Enums quick-reference

${enumTable}

---

## Model map

${modelSections}

---

## Common Prisma patterns

\`\`\`typescript
// Include nested relations
const order = await this.prisma.order.findUnique({
  where: { id },
  include: { items: { include: { material: true } }, transportJobs: true },
});

// Filtered list with pagination
const jobs = await this.prisma.transportJob.findMany({
  where: { carrierId, status: { in: ['AVAILABLE', 'ASSIGNED'] } },
  orderBy: { pickupDate: 'asc' },
  skip: (page - 1) * limit,
  take: limit,
});

// Atomic multi-table write
await this.prisma.$transaction([
  this.prisma.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED' } }),
  this.prisma.transportJob.create({ data: { ...jobData } }),
]);
\`\`\`

---

## Adding a new feature — checklist

1. Add/alter models in \`schema.prisma\`
2. \`npm run prisma:migrate\` — name it meaningfully (e.g. \`add_payment_method\`)
3. \`npm run prisma:generate\` — regenerates client typings **and this docs file**
4. Create \`src/<feature>/<feature>.module.ts|controller.ts|service.ts\` + DTOs
5. Import the new module in \`src/app.module.ts\` → \`imports: [...]\`
6. If the feature emits notifications, add a \`NotificationType\` enum value before migrating
`;

  writeFileSync(OUT_BACKEND, doc);
  console.log(`✓ backend-schema.instructions.md (${models.length} models, ${Object.keys(enums).length} enums)`);
}

// ─── 2. Web component API (marker injection) ──────────────────────────────────

function generateWebComponentApi() {
  const files = readdirSync(WEB_COMPONENTS_DIR).filter(f => /\.(tsx|ts)$/.test(f)).sort();
  const sections = files.map(file => {
    const name   = file.replace(/\.(tsx|ts)$/, '');
    const source = readFileSync(resolve(WEB_COMPONENTS_DIR, file), 'utf8');
    const parts  = [`#### \`${name}\` — \`@/components/ui/${name}\``];

    const variants = extractCvaVariants(source);
    for (const [k, vals] of Object.entries(variants)) {
      parts.push(`- **${k}:** ${vals.map(v => `\`${v}\``).join(' | ')}`);
    }

    const propsInfo = extractPropsInterface(source, name.charAt(0).toUpperCase() + name.slice(1));
    if (propsInfo) {
      const table = propsToTable(propsInfo.block);
      if (table) parts.push('\n' + table);
    }

    const exports = [...source.matchAll(/^export\s+(?:function|const|class)\s+(\w+)/gm)].map(m => m[1]);
    if (exports.length) parts.push(`\n**Exports:** ${exports.map(e => `\`${e}\``).join(', ')}`);

    return parts.join('\n');
  });

  inject(OUT_WEB, 'component-api', sections.join('\n\n---\n\n'));
  console.log(`✓ web-components.instructions.md (${files.length} components)`);
}

// ─── 3. Mobile component API (marker injection) ───────────────────────────────

function generateMobileComponentApi() {
  const files = readdirSync(MOBILE_COMPONENTS_DIR).filter(f => /\.(tsx|ts)$/.test(f)).sort();
  const sections = files.map(file => {
    const name   = file.replace(/\.(tsx|ts)$/, '');
    const source = readFileSync(resolve(MOBILE_COMPONENTS_DIR, file), 'utf8');
    const parts  = [`#### \`${name}\` — \`@/components/ui/${name}\``];

    const propsInfo = extractPropsInterface(source, name.charAt(0).toUpperCase() + name.slice(1));
    if (propsInfo) {
      const table = propsToTable(propsInfo.block);
      if (table) parts.push('\n' + table);
      else parts.push(`_Props: \`${propsInfo.name}\` (see source file)_`);
    } else {
      parts.push('_No props interface — check source file._');
    }

    const exports = [...source.matchAll(/^export\s+(?:function|const|class)\s+(\w+)/gm)].map(m => m[1]);
    if (exports.length) parts.push(`\n**Exports:** ${exports.map(e => `\`${e}\``).join(', ')}`);

    return parts.join('\n');
  });

  inject(OUT_MOBILE, 'component-api', sections.join('\n\n---\n\n'));
  console.log(`✓ mobile-components.instructions.md (${files.length} components)`);
}

// ─── 4. copilot-instructions.md — inject dynamic sections ─────────────────────

function generateCopilotSections() {
  // RequestingUser — from the actual TS source file
  const ruSource    = readFileSync(REQUESTING_USER_FILE, 'utf8');
  const ruInterface = extractInterface(ruSource, 'RequestingUser');
  inject(OUT_COPILOT, 'requesting-user', `\`\`\`ts\n${ruInterface}\n\`\`\``);

  // Mobile route groups — from filesystem
  const appDirs = readdirSync(MOBILE_APP_DIR, { withFileTypes: true });
  const groups  = appDirs
    .filter(d => d.isDirectory() && d.name.startsWith('('))
    .map(d => {
      let screens = [];
      try {
        screens = readdirSync(resolve(MOBILE_APP_DIR, d.name), { withFileTypes: true })
          .filter(e => e.name !== '_layout.tsx')
          .map(e => e.isDirectory() ? `${e.name}/` : e.name.replace(/\.(tsx|ts)$/, ''))
          .sort();
      } catch { /* ignore */ }
      return `- \`${d.name}\` — ${screens.join(', ')}`;
    });
  inject(OUT_COPILOT, 'mobile-routes', groups.join('\n'));

  // API prefix — from main.ts
  const mainTs    = readFileSync(MAIN_TS, 'utf8');
  const prefixM   = mainTs.match(/setGlobalPrefix\(['"]([^'"]+)['"]\)/);
  const apiPrefix = prefixM ? prefixM[1] : 'api/v1';
  inject(OUT_COPILOT, 'api-prefix', `All routes prefixed with \`/${apiPrefix}\` (e.g. \`POST /${apiPrefix}/orders\`).`);

  console.log(`✓ copilot-instructions.md (RequestingUser, mobile routes, API prefix)`);
}

// ─── 5. STATUS.md — inject live file listings ────────────────────────────────

function generateStatusFileLists() {
  // Backend modules: directories in src/ that are actual feature modules
  const backendSrcDir = resolve(ROOT, 'apps/backend/src');
  const backendModules = readdirSync(backendSrcDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !BACKEND_NON_FEATURE_DIRS.has(d.name))
    .map(d => d.name)
    .sort();
  inject(OUT_STATUS, 'status-backend-modules', backendModules.map(m => `- ${m}`).join('\n'));

  // Web pages: all page.tsx files under apps/web/src/app/
  const webAppDir = resolve(ROOT, 'apps/web/src/app');
  function walkWebPages(dir, base = '') {
    const entries = readdirSync(dir, { withFileTypes: true });
    const pages = [];
    for (const e of entries) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) pages.push(...walkWebPages(resolve(dir, e.name), rel));
      else if (e.name === 'page.tsx') {
        // Use parent dir as label; strip trailing /page.tsx
        const label = base || '(root)';
        pages.push(label);
      }
    }
    return pages;
  }
  const webPages = walkWebPages(webAppDir).sort();
  inject(OUT_STATUS, 'status-web-pages', webPages.map(p => `- ${p}`).join('\n'));

  // Mobile screens: all .tsx files under apps/mobile/app/ excluding _layout.tsx
  function walkMobileScreens(dir, base = '') {
    const entries = readdirSync(dir, { withFileTypes: true });
    const screens = [];
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) {
        screens.push(...walkMobileScreens(resolve(dir, e.name), rel));
      } else if (e.name.endsWith('.tsx') && e.name !== '_layout.tsx') {
        screens.push(rel.replace(/\.tsx$/, ''));
      }
    }
    return screens;
  }
  const mobileScreens = walkMobileScreens(MOBILE_APP_DIR).sort();
  inject(OUT_STATUS, 'status-mobile-screens', mobileScreens.map(s => `- ${s}`).join('\n'));

  console.log(`✓ STATUS.md (${backendModules.length} modules, ${webPages.length} web pages, ${mobileScreens.length} mobile screens)`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

generateBackendDocs();
generateWebComponentApi();
generateMobileComponentApi();
generateCopilotSections();
generateStatusFileLists();

console.log('\nAll instruction files are in sync with source code.');
