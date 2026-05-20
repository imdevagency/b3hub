/**
 * @b3hub/shared — canonical enum types used across mobile, web, and backend.
 *
 * Update here to affect all surfaces. Never redefine these locally.
 */

// ── Materials ──────────────────────────────────────────────────────────────
// MaterialCategory and MaterialUnit live in materials.ts (already shared).
// Re-exported here for convenience when importing from a single place.
export type { MaterialCategory, MaterialCategoryAll, MaterialUnit } from './materials';

// ── Waste types ────────────────────────────────────────────────────────────

export type WasteType =
  | 'CONCRETE'
  | 'BRICK'
  | 'WOOD'
  | 'METAL'
  | 'PLASTIC'
  | 'SOIL'
  | 'MIXED'
  | 'HAZARDOUS'
  | 'ASPHALT'
  | 'GREEN_WASTE'
  | 'WEEE'
  | 'OIL_WASTE'
  | 'TIRES'
  | 'PACKAGING_WASTE';

// ── Skip-hire waste categories ─────────────────────────────────────────────
// The 3 active waste streams offered in the skip-hire wizard.
// These values map 1-to-1 to the backend SkipWasteCategory enum.
// Single source of truth for mobile wizard, web wizard, and admin dashboard.

export type SkipWasteCategory =
  | 'MIXED'           // Jaukti celtniecības atkritumi
  | 'CONCRETE_RUBBLE' // Tīri būvgruži (betons, ķieģeļi)
  | 'WOOD';           // Koka atkritumi (dēļi, sijas, paletes)

/** Active waste streams shown in the skip-hire wizard (ordered for display). */
export const SKIP_WASTE_CATEGORIES: SkipWasteCategory[] = [
  'MIXED',
  'CONCRETE_RUBBLE',
  'WOOD',
];

export const SKIP_WASTE_LABELS: Record<SkipWasteCategory, { label: string; sub: string }> = {
  MIXED:           { label: 'Jaukti atkritumi',  sub: 'Dažādu veidu celtniecības atkritumi' },
  CONCRETE_RUBBLE: { label: 'Betons / Ķieģeļi',  sub: 'Smagi būvgruži un plāksnes' },
  WOOD:            { label: 'Koksne',             sub: 'Dēļi, sijas, logi, durvis' },
};

// ── Vehicle / truck types ──────────────────────────────────────────────────
// DisposalTruckType: tipper trucks used for waste removal orders.
// TransportVehicleType: all vehicle types available for freight transport orders.
// These must stay in sync with the backend Prisma enum VehicleType.

export type DisposalTruckType =
  | 'DUMP_TRUCK_10T'
  | 'DUMP_TRUCK_18T'
  | 'DUMP_TRUCK_26T';

export type TransportVehicleType =
  | 'DUMP_TRUCK_10T'
  | 'DUMP_TRUCK_18T'
  | 'DUMP_TRUCK_26T'
  | 'FLATBED_TRUCK'
  | 'SEMI_TRAILER'
  | 'SKIP_LOADER'
  | 'TANKER';

// ── Transport job statuses ──────────────────────────────────────────────────

export type TransportJobStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'AT_PICKUP'
  | 'LOADED'
  | 'EN_ROUTE_DELIVERY'
  | 'AT_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'DELIVERY_REFUSED';

// ── Order statuses ─────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'LOADING'
  | 'LOADED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';
