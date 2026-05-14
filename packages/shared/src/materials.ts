/**
 * @b3hub/shared — single source of truth for material categories, units,
 * and their Latvian display labels.
 *
 * Used by both the mobile app and the web portal. Update here to affect all surfaces.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type MaterialCategory =
  | 'SAND'
  | 'GRAVEL'
  | 'STONE'
  | 'CONCRETE'
  | 'SOIL'
  | 'RECYCLED_CONCRETE'
  | 'RECYCLED_SOIL'
  | 'ASPHALT'
  | 'CLAY'
  | 'OTHER';

export type MaterialCategoryAll = MaterialCategory | 'ALL';

export type MaterialUnit = 'TONNE' | 'M3' | 'PIECE' | 'LOAD';

// ── Category labels ────────────────────────────────────────────────────────
// Canonical Latvian names for each material category.
// These must match what is shown in the catalog UI on both mobile and web.

export const CATEGORY_LABELS: Record<MaterialCategoryAll, string> = {
  ALL: 'Visi',
  SAND: 'Smiltis',
  GRAVEL: 'Grants',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Augsne',
  RECYCLED_CONCRETE: 'Pārstrādāts betons',
  RECYCLED_SOIL: 'Pārstrādāta augsne',
  ASPHALT: 'Asfalts',
  CLAY: 'Māls',
  OTHER: 'Cits',
};

// ── Category descriptions ──────────────────────────────────────────────────
// Short subtitle shown under the category name in catalog / filter UIs.

export const CATEGORY_DESCRIPTIONS: Record<MaterialCategoryAll, string> = {
  ALL: 'Visi pieejamie materiāli',
  SAND: 'Uzbēruma, celtnieku un filtrācijas smiltis',
  GRAVEL: 'Ceļu grants, drenāžas grants, šķembas',
  STONE: 'Drupināts akmens, bruģakmens, laukakmens',
  CONCRETE: 'Gatavs betona maisījums, betona bloki',
  SOIL: 'Tīrā augsne, melnzeme, dārza zeme',
  RECYCLED_CONCRETE: 'Sasmalcināts betons no nojaukšanas darbiem',
  RECYCLED_SOIL: 'Pārstrādāta augsne celtniecības vajadzībām',
  ASPHALT: 'Asfalts ceļiem un stāvvietām',
  CLAY: 'Māls hidroizolācijai un uzbērumiem',
  OTHER: 'Citi celtniecības pieprasījumi',
};

// ── Unit labels ────────────────────────────────────────────────────────────

export const UNIT_SHORT: Record<MaterialUnit, string> = {
  TONNE: 't',
  M3: 'm³',
  PIECE: 'gab.',
  LOAD: 'krava',
};

export const UNIT_LONG: Record<MaterialUnit, string> = {
  TONNE: 'tonne',
  M3: 'm³',
  PIECE: 'gabals',
  LOAD: 'krāvums',
};

// ── Ordered category list (excludes ALL) ──────────────────────────────────

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'SAND',
  'GRAVEL',
  'STONE',
  'CONCRETE',
  'SOIL',
  'RECYCLED_CONCRETE',
  'RECYCLED_SOIL',
  'ASPHALT',
  'CLAY',
  'OTHER',
];

export const MATERIAL_UNITS: MaterialUnit[] = ['TONNE', 'M3', 'PIECE', 'LOAD'];

// ── Fractions per material category ───────────────────────────────────────
// Offline fallback — the live source of truth is the DB via GET /api/v1/catalogue/material-fractions.
// Update the CatalogueService seed (apps/backend/src/catalogue/catalogue.service.ts) to change.

export type MaterialFraction = {
  code: string;
  label: string;
  labelLv: string;
  unit?: string;
};

export const CATEGORY_FRACTIONS: Record<MaterialCategory, string[]> = {
  SAND:             ['0–1 mm', '0–2 mm (smalkā)', '0–4 mm (rupjā)', 'Betonsmiltis (0–4 mm mazgāta)', 'Uzbēruma smiltis', 'Filtrācijas smiltis', 'Nav norādīts'],
  GRAVEL:           ['0–4 mm', '4–8 mm', '8–16 mm', '16–32 mm', '32–63 mm', '0–32 mm (ceļu grants)', '0–63 mm (šosejas grants)', 'Nav norādīts'],
  STONE:            ['0–4 mm', '4–8 mm', '8–11 mm', '8–16 mm', '11–16 mm', '16–22 mm', '16–32 mm', '32–63 mm', '63–125 mm', 'Bruģakmens', 'Laukakmeņi > 125 mm', 'Nav norādīts'],
  CONCRETE:         ['C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45', 'Betona bloki', 'Nav norādīts'],
  SOIL:             ['Uzbēruma augsne', 'Melnzeme', 'Dārza zeme', 'Smilšainā augsne', 'Nav norādīts'],
  RECYCLED_CONCRETE:['0–8 mm (RC smalks)', '8–32 mm (RC grants)', '32–63 mm (RC rupjais)', '0–63 mm (RC jaukts)', 'Nav norādīts'],
  RECYCLED_SOIL:    ['Sijāta pārstrādāta augsne', 'Uzbērumam', 'Nav norādīts'],
  ASPHALT:          ['Karstais asfalts (AC)', 'Aukstais asfalts (remontam)', 'Asfalta frēzējums (RAP)', 'Nav norādīts'],
  CLAY:             ['Hidroizolācijas māls', 'Uzbēruma māls', 'Nav norādīts'],
  OTHER:            ['Nav norādīts'],
};

// ── Bulk density t/m³ ─────────────────────────────────────────────────────
// Used for volume ↔ weight conversions in order wizards.
// Live source of truth is MaterialCategoryDefinition.densityTM3 in DB.

export const MATERIAL_DENSITY: Record<MaterialCategory, number> = {
  SAND:             1.6,
  GRAVEL:           1.8,
  STONE:            2.7,
  CONCRETE:         2.4,
  SOIL:             1.7,
  RECYCLED_CONCRETE:1.5,
  RECYCLED_SOIL:    1.5,
  ASPHALT:          2.3,
  CLAY:             1.8,
  OTHER:            1.7,
};

// ── Default material names ─────────────────────────────────────────────────
// Canonical Latvian names used to pre-fill the material name input when a
// seller creates a new listing. Single source of truth for both web and mobile.

export const DEFAULT_MATERIAL_NAMES: Record<MaterialCategory, string> = {
  SAND: 'Uzbēruma smiltis',
  GRAVEL: 'Ceļu grants',
  STONE: 'Drupināts akmens',
  CONCRETE: 'Gatavs betons',
  SOIL: 'Augsne uzbēršanai',
  RECYCLED_CONCRETE: 'Pārstrādāts betons',
  RECYCLED_SOIL: 'Pārstrādāta augsne',
  ASPHALT: 'Asfalta maisījums',
  CLAY: 'Māls',
  OTHER: '',
};
