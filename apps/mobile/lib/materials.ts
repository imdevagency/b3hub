/**
 * Shared constants for material data used across catalog, order-request, and orders screens.
 * Single source of truth — update here to affect all screens.
 */

// ── Unit labels ────────────────────────────────────────────────

export const UNIT_SHORT: Record<string, string> = {
  TONNE: 't',
  M3: 'm\u00b3',
  PIECE: 'gab.',
  LOAD: 'krava',
};

// ── Category labels ────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'Visi',
  SAND: 'Smiltis',
  GRAVEL: '\u0160\u0137embas',
  STONE: 'Akmens',
  CONCRETE: 'Betons',
  SOIL: 'Zeme',
  RECYCLED_CONCRETE: 'Rec. betons',
  RECYCLED_SOIL: 'Rec. zeme',
  ASPHALT: 'Asfalta gran.',
  CLAY: 'M\u0101ls',
  OTHER: 'Cits',
};

// ── Category accent colors (used for icon tints, pill highlights) ──

export const CATEGORY_ACCENT: Record<string, string> = {
  ALL: '#111827',
  SAND: '#d97706',
  GRAVEL: '#475569',
  STONE: '#334155',
  CONCRETE: '#6b7280',
  SOIL: '#92400e',
  RECYCLED_CONCRETE: '#16a34a',
  RECYCLED_SOIL: '#059669',
  ASPHALT: '#44403c',
  CLAY: '#c2410c',
  OTHER: '#6b7280',
};

// ── Category icon emoji (used in order-request flow) ──────────

export const CATEGORY_ICON: Record<string, string> = {
  ALL: '\ud83d\udce6',
  SAND: '\ud83c\udfdc\ufe0f',
  GRAVEL: '\ud83e\udea8',
  STONE: '\ud83d\uddff',
  CONCRETE: '\ud83e\uddf1',
  SOIL: '\ud83c\udf31',
  RECYCLED_CONCRETE: '\u267b\ufe0f',
  RECYCLED_SOIL: '\ud83c\udf3f',
  ASPHALT: '\ud83d\udee3\ufe0f',
  CLAY: '\ud83d\udfe4',
  OTHER: '\ud83d\udce6',
};

// ── Order status label maps ────────────────────────────────────

export const MAT_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'Gaida',        bg: '#f3f4f6', color: '#6b7280' },
  CONFIRMED:  { label: 'Apstipr\u0101n\u0101ts',  bg: '#f3f4f6', color: '#374151' },
  PROCESSING: { label: 'Apstr\u0101d\u0101',      bg: '#f3f4f6', color: '#374151' },
  SHIPPED:    { label: 'Ce\u013c\u0101',           bg: '#fef3c7', color: '#92400e' },
  DELIVERED:  { label: 'Pieg\u0101d\u0101ts',     bg: '#dcfce7', color: '#15803d' },
  CANCELLED:  { label: 'Atcelts',      bg: '#fee2e2', color: '#b91c1c' },
};

export const TJB_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  AVAILABLE:         { label: 'Gaida p\u0101rvad\u0101t\u0101ju',  bg: '#f3f4f6', color: '#6b7280' },
  ASSIGNED:          { label: 'P\u0101rvad\u0101t\u0101js atrasts', bg: '#f3f4f6', color: '#374151' },
  ACCEPTED:          { label: 'Apstipr\u0101n\u0101ts',            bg: '#f3f4f6', color: '#374151' },
  EN_ROUTE_PICKUP:   { label: 'Brauc uz iekrau\u0161anu',          bg: '#fef3c7', color: '#92400e' },
  AT_PICKUP:         { label: 'Iekraujas',                          bg: '#fef3c7', color: '#92400e' },
  LOADED:            { label: 'Iekrauts',                           bg: '#fef3c7', color: '#92400e' },
  EN_ROUTE_DELIVERY: { label: 'Ce\u013c\u0101',                     bg: '#dcfce7', color: '#15803d' },
  AT_DELIVERY:       { label: 'Pieg\u0101d\u0101',                  bg: '#dcfce7', color: '#15803d' },
  DELIVERED:         { label: 'Piegādāts',                          bg: '#f0fdf4', color: '#15803d' },
  CANCELLED:         { label: 'Atcelts',                            bg: '#fee2e2', color: '#b91c1c' },
};

export const CONTAINER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:         { label: 'Gaida',            bg: '#f3f4f6', color: '#6b7280' },
  CONFIRMED:       { label: 'Apstiprānāts',    bg: '#dbeafe', color: '#1d4ed8' },
  DELIVERED:       { label: 'Nogādāts',         bg: '#d1fae5', color: '#059669' },
  AWAITING_PICKUP: { label: 'Gaida izņemšanu', bg: '#fef3c7', color: '#d97706' },
  COLLECTED:       { label: 'Savākts',          bg: '#e0e7ff', color: '#4338ca' },
  COMPLETED:       { label: 'Pabeigts',          bg: '#dcfce7', color: '#15803d' },
  CANCELLED:       { label: 'Atcelts',           bg: '#fee2e2', color: '#b91c1c' },
};

/** Seller-side incoming order statuses (PENDING → DISPATCHED pipeline). */
export const SELLER_ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'Jauns',        bg: '#f3f4f6', color: '#6b7280' },
  CONFIRMED:  { label: 'Apstiprānāts', bg: '#f3f4f6', color: '#111827' },
  LOADING:    { label: 'Iekraušana',   bg: '#f3f4f6', color: '#374151' },
  DISPATCHED: { label: 'Nosūtīts',    bg: '#dcfce7', color: '#111827' },
};

/** User account status labels (profile screens). */
export const ACCOUNT_STATUS: Record<string, string> = {
  ACTIVE:    'Aktīvs',
  PENDING:   'Gaida apstiprināšanu',
  SUSPENDED: 'Apturēts',
  INACTIVE:  'Neaktīvs',
};

// ── Skip-hire container size labels ──────────────────────────────────
export const SIZE_LABEL: Record<string, string> = {
  MINI:     'Mini · 2 m³',
  MIDI:     'Midi · 4 m³',
  BUILDERS: 'Celtniec. · 6 m³',
  LARGE:    'Liels · 8 m³',
};
