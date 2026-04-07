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
  | 'HAZARDOUS';

// ── Vehicle / truck types ──────────────────────────────────────────────────
// DisposalTruckType: tipper trucks used for waste removal orders.
// TransportVehicleType: all vehicle types available for freight transport orders.
// These must stay in sync with the backend Prisma enum VehicleType.

export type DisposalTruckType =
  | 'TIPPER_SMALL'
  | 'TIPPER_LARGE'
  | 'ARTICULATED_TIPPER';

export type TransportVehicleType =
  | 'TIPPER_SMALL'
  | 'TIPPER_LARGE'
  | 'ARTICULATED_TIPPER'
  | 'FLATBED'
  | 'BOX_TRUCK';

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
  | 'CANCELLED';

// ── Order statuses ─────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'LOADING'
  | 'LOADED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';
