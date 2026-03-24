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
  RECYCLED_CONCRETE: 'Reciklēts betons',
  RECYCLED_SOIL: 'Reciklēta augsne',
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

// ── Default material names ─────────────────────────────────────────────────
// Canonical Latvian names used to pre-fill the material name input when a
// seller creates a new listing. Single source of truth for both web and mobile.

export const DEFAULT_MATERIAL_NAMES: Record<MaterialCategory, string> = {
  SAND: 'Uzbēruma smiltis',
  GRAVEL: 'Ceļu grants',
  STONE: 'Drupināts akmens',
  CONCRETE: 'Gatavs betons',
  SOIL: 'Augsne uzbēršanai',
  RECYCLED_CONCRETE: 'Reciklēts betons',
  RECYCLED_SOIL: 'Reciklēta augsne',
  ASPHALT: 'Asfalta maisījums',
  CLAY: 'Māls',
  OTHER: '',
};
