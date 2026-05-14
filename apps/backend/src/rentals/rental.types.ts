/**
 * rental.types.ts — Shared types for all generic rental services.
 *
 * These types are used by the RentalsModule which handles all new rental
 * service types: SCAFFOLDING, TEMP_FENCING, SITE_OFFICE, GENERATOR,
 * LIGHTING_TOWER, WATER_BOWSER, and construction equipment
 * (MINI_EXCAVATOR, EXCAVATOR, DUMPER, COMPACTOR, TELEHANDLER, AERIAL_PLATFORM).
 *
 * SkipHireOrder and ToiletCabinOrder keep their dedicated modules for
 * backward compatibility. New services always go through RentalOrder.
 */

import { RentalServiceType, RentalOrderStatus, PaymentMethod } from '@prisma/client';

// ── Service metadata shapes ───────────────────────────────────────────────────

/** Metadata for SCAFFOLDING orders */
export interface ScaffoldingMetadata {
  heightMetres: number;
  lengthMetres: number;
  accessRequired: boolean;
}

/** Metadata for TEMP_FENCING orders */
export interface TempFencingMetadata {
  panelCount: number;
  fenceType?: 'STANDARD' | 'HOARDING' | 'CROWD_BARRIER';
}

/** Metadata for GENERATOR orders */
export interface GeneratorMetadata {
  powerKva: number;
  fuelIncluded: boolean;
}

/** Metadata for LIGHTING_TOWER orders */
export interface LightingTowerMetadata {
  areaCoveredM2?: number;
}

/** Metadata for WATER_BOWSER orders */
export interface WaterBowserMetadata {
  capacityLitres: number;
}

/** Metadata for SITE_OFFICE orders */
export interface SiteOfficeMetadata {
  officeType: 'WELFARE' | 'OFFICE' | 'DRYING_ROOM';
  hasToilet: boolean;
}

/** Metadata for construction equipment orders */
export interface EquipmentMetadata {
  /** Whether an operator/driver is required alongside the machine */
  operatorRequired?: boolean;
  /** Machine weight class or sub-type for display (e.g. '1.5t mini' for excavator) */
  weightClass?: string;
  /** Whether fuel/power is included in the day rate */
  fuelIncluded?: boolean;
}

export type RentalMetadata =
  | ScaffoldingMetadata
  | TempFencingMetadata
  | GeneratorMetadata
  | LightingTowerMetadata
  | WaterBowserMetadata
  | SiteOfficeMetadata
  | EquipmentMetadata;

// ── Canonical rental status lifecycle ────────────────────────────────────────

export const RENTAL_STATUS_FLOW: Record<RentalOrderStatus, RentalOrderStatus | null> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'DELIVERED',
  DELIVERED: 'IN_USE',
  IN_USE: 'COLLECTED',
  COLLECTED: 'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
};

/** Services that skip the IN_USE step (deliver directly to COLLECTED on pickup) */
export const SERVICES_WITHOUT_IN_USE: RentalServiceType[] = [
  'SCAFFOLDING',
  'TEMP_FENCING',
  'WATER_BOWSER',
  'DUMPER',
  'COMPACTOR',
];

// ── Service display config (mirrors mobile rental-services.ts) ────────────────

export interface RentalServiceConfig {
  type: RentalServiceType;
  label: string;
  unitLabel: string;
  hasInUseStep: boolean;
}

export const RENTAL_SERVICE_CONFIG: Record<RentalServiceType, RentalServiceConfig> = {
  SCAFFOLDING:     { type: 'SCAFFOLDING',     label: 'Sastatnes',              unitLabel: 'sekcijas',  hasInUseStep: false },
  TEMP_FENCING:    { type: 'TEMP_FENCING',    label: 'Pagaidu žogi',           unitLabel: 'paneļi',    hasInUseStep: false },
  SITE_OFFICE:     { type: 'SITE_OFFICE',     label: 'Mobilās biroja kabīnes', unitLabel: 'kabīnes',   hasInUseStep: true  },
  GENERATOR:       { type: 'GENERATOR',       label: 'Ģeneratori',             unitLabel: 'agregāti',  hasInUseStep: true  },
  LIGHTING_TOWER:  { type: 'LIGHTING_TOWER',  label: 'Apgaismojuma torņi',     unitLabel: 'torņi',     hasInUseStep: true  },
  WATER_BOWSER:    { type: 'WATER_BOWSER',    label: 'Ūdens piegāde',          unitLabel: 'cisternas', hasInUseStep: false },
  SKIP_HIRE:       { type: 'SKIP_HIRE',       label: 'Konteineri',             unitLabel: 'konteineri',hasInUseStep: false },
  TOILET_CABIN:    { type: 'TOILET_CABIN',    label: 'Tualetes kabīnes',       unitLabel: 'kabīnes',   hasInUseStep: true  },
  MINI_EXCAVATOR:  { type: 'MINI_EXCAVATOR',  label: 'Mini ekskavatoru noma',  unitLabel: 'ekskavatoru', hasInUseStep: true },
  EXCAVATOR:       { type: 'EXCAVATOR',       label: 'Ekskavators',            unitLabel: 'ekskavatoru', hasInUseStep: true },
  DUMPER:          { type: 'DUMPER',          label: 'Dempera pašizgāzēji',    unitLabel: 'mašīnas',   hasInUseStep: false },
  COMPACTOR:       { type: 'COMPACTOR',       label: 'Kompaktori un rullīši',  unitLabel: 'vienības',  hasInUseStep: false },
  TELEHANDLER:     { type: 'TELEHANDLER',     label: 'Teleskopiskās iekrāvējas',unitLabel: 'iekrāvējas',hasInUseStep: true },
  AERIAL_PLATFORM:      { type: 'AERIAL_PLATFORM',      label: 'Pacēlāji un platformas',    unitLabel: 'vienības',     hasInUseStep: true  },
  AIR_COMPRESSOR:       { type: 'AIR_COMPRESSOR',       label: 'Gaisa kompresori',           unitLabel: 'kompresori',   hasInUseStep: true  },
  POWER_TOOLS:          { type: 'POWER_TOOLS',          label: 'Elektroinstrumenti',          unitLabel: 'komplekti',    hasInUseStep: true  },
  WELDER:               { type: 'WELDER',               label: 'Metināšanas iekārtas',        unitLabel: 'iekārtas',     hasInUseStep: true  },
  HEATER:               { type: 'HEATER',               label: 'Sildītāji',                  unitLabel: 'vienības',     hasInUseStep: true  },
  CONCRETE_EQUIPMENT:   { type: 'CONCRETE_EQUIPMENT',   label: 'Betona iekārtas',             unitLabel: 'iekārtas',     hasInUseStep: true  },
  REBAR_EQUIPMENT:      { type: 'REBAR_EQUIPMENT',      label: 'Armatūras iekārtas',          unitLabel: 'iekārtas',     hasInUseStep: true  },
  ALUMINUM_TOWER:       { type: 'ALUMINUM_TOWER',       label: 'Alumīnija darba platformas', unitLabel: 'platformas',   hasInUseStep: true  },
};
