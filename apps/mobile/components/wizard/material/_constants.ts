/**
 * Shared constants and types for the material order wizard.
 * Consumed by the wizard root (app/order-request-new.tsx) and individual steps.
 */
import type { MaterialCategory, MaterialUnit } from '@/lib/materials';
import type { TruckType } from '@/components/ui/TruckIllustration';

// ── Order type ─────────────────────────────────────────────────────────────

export type OrderType = 'BY_WEIGHT' | 'BY_VOLUME' | 'BY_LOAD';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  BY_WEIGHT: 'Pēc svara (tonnas)',
  BY_VOLUME: 'Pēc apjoma (m³)',
  BY_LOAD: 'Kravas pēc skaita',
};

export const ORDER_TYPE_UNIT_MAP: Record<OrderType, MaterialUnit> = {
  BY_WEIGHT: 'TONNE',
  BY_VOLUME: 'M3',
  BY_LOAD: 'LOAD',
};

export const ORDER_TYPE_UNIT_LABEL: Record<OrderType, string> = {
  BY_WEIGHT: 'tonnas',
  BY_VOLUME: 'm³',
  BY_LOAD: 'kravas',
};

// ── Truck options ──────────────────────────────────────────────────────────

export type TruckOption = {
  id: string;
  label: string;
  subtitle: string;
  capacity: number;
  truckType: TruckType;
};

export const TRUCK_OPTIONS: TruckOption[] = [
  {
    id: 'SEMI_26',
    label: '26 t',
    subtitle: 'Piekabes',
    capacity: 26,
    truckType: 'ARTICULATED_TIPPER',
  },
  { id: 'TIPPER_17', label: '17 t', subtitle: '8×4', capacity: 17, truckType: 'TIPPER_LARGE' },
  {
    id: 'TIPPER_12',
    label: '12 t',
    subtitle: 'Standarta',
    capacity: 12,
    truckType: 'TIPPER_SMALL',
  },
];

// ── Fractions per material category ────────────────────────────────────────

export const CATEGORY_FRACTIONS: Record<MaterialCategory, string[]> = {
  SAND: ['Smalkā', 'Rupjā', 'Betonsmilts', '0–4 mm', 'Nav norādīts'],
  GRAVEL: ['0–4 mm', '4–8 mm', '8–16 mm', '16–32 mm', '32–63 mm', 'Nav norādīts'],
  STONE: ['0–4 mm', '4–8 mm', '8–16 mm', '16–32 mm', '32–63 mm', '63+ mm', 'Nav norādīts'],
  CONCRETE: ['B15', 'B20', 'B22.5', 'B25', 'B30', 'Nav norādīts'],
  SOIL: ['Izmestā augsne', 'Melnzeme', 'Dārza zeme', 'Nav norādīts'],
  RECYCLED_CONCRETE: ['0–8 mm', '8–32 mm', '32–63 mm', 'Nav norādīts'],
  RECYCLED_SOIL: ['Nav norādīts'],
  ASPHALT: ['Karstais asfalts', 'Aukstais asfalts', 'Nav norādīts'],
  CLAY: ['Nav norādīts'],
  OTHER: ['Nav norādīts'],
};

// ── Bulk density t/m³ for volume → weight conversion ──────────────────────

export const MATERIAL_DENSITY: Partial<Record<string, number>> = {
  SAND: 1.6,
  GRAVEL: 1.8,
  STONE: 2.7,
  CONCRETE: 2.4,
  SOIL: 1.7,
  RECYCLED_CONCRETE: 1.5,
  RECYCLED_SOIL: 1.5,
  ASPHALT: 2.3,
  CLAY: 1.8,
  OTHER: 1.7,
};

/** Category-specific default unit; all others default to TONNE. */
export const CATEGORY_DEFAULT_UNIT: Partial<Record<string, MaterialUnit>> = {
  CONCRETE: 'M3',
};
