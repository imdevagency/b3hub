/**
 * Types, constants and static data for the order-request flow.
 */

import { CATEGORY_LABELS } from '@/lib/materials';
import type { MaterialCategory, MaterialUnit } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type MaterialCategoryAll = MaterialCategory | 'ALL';

export type Step =
  | 'map'
  | 'material'
  | 'configure'
  | 'offers'
  | 'sent'       // RFQ submitted — fire-and-forget confirmation
  | 'quotes'
  | 'confirm'
  | 'success';

// ── Constants ────────────────────────────────────────────────────

export const RIGA: LatLng = { latitude: 56.9496, longitude: 24.1052 };

// CATEGORY_LABELS imported from @/lib/materials
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as MaterialCategoryAll[];

export const CATEGORY_COLOR: Record<string, string> = {
  ALL: '#6b7280',
  SAND: '#6b7280',
  GRAVEL: '#64748b',
  STONE: '#6b7280',
  CONCRETE: '#4b5563',
  SOIL: '#6b7280',
  RECYCLED_CONCRETE: '#059669',
  RECYCLED_SOIL: '#111827',
  ASPHALT: '#374151',
  CLAY: '#6b7280',
  OTHER: '#6b7280',
};

// ── Global material catalogue ────────────────────────────────────

export type GlobalMaterial = {
  id: string;
  name: string;
  description: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  isRecycled: boolean;
};

export const GLOBAL_MATERIALS: GlobalMaterial[] = [
  {
    id: 'sand-0-5',
    name: 'Smiltis 0/5',
    description: 'Celtniecības smiltis, frakc. 0–5 mm',
    category: 'SAND',
    unit: 'TONNE',
    basePrice: 8,
    isRecycled: false,
  },
  {
    id: 'sand-lake',
    name: 'Ezersmiltis',
    description: 'Sīkgraudaina filtrēta ezersmiltis',
    category: 'SAND',
    unit: 'TONNE',
    basePrice: 10,
    isRecycled: false,
  },
  {
    id: 'sand-fine',
    name: 'Smalka smiltis',
    description: 'Apbērsmes un apdares smiltis',
    category: 'SAND',
    unit: 'TONNE',
    basePrice: 7,
    isRecycled: false,
  },
  {
    id: 'gravel-816',
    name: 'Šķembas 8/16',
    description: 'Granīta šķembas, frakc. 8–16 mm',
    category: 'GRAVEL',
    unit: 'TONNE',
    basePrice: 15,
    isRecycled: false,
  },
  {
    id: 'gravel-1632',
    name: 'Šķembas 16/32',
    description: 'Granīta šķembas, frakc. 16–32 mm',
    category: 'GRAVEL',
    unit: 'TONNE',
    basePrice: 14,
    isRecycled: false,
  },
  {
    id: 'gravel-3263',
    name: 'Šķembas 32/63',
    description: 'Grants, frakc. 32–63 mm',
    category: 'GRAVEL',
    unit: 'TONNE',
    basePrice: 13,
    isRecycled: false,
  },
  {
    id: 'stone-granite',
    name: 'Granīta šķemba 5/40',
    description: 'Universāla šķemba ceļu un pamatu darbiem',
    category: 'STONE',
    unit: 'TONNE',
    basePrice: 18,
    isRecycled: false,
  },
  {
    id: 'stone-field',
    name: 'Lauku akmeņi',
    description: 'Dabīgi akmeņi ainavaim, d = 10–40 cm',
    category: 'STONE',
    unit: 'TONNE',
    basePrice: 20,
    isRecycled: false,
  },
  {
    id: 'soil-black',
    name: 'Augsne (melnzeme)',
    description: 'Auglīga melnzeme dārziem un apzaļumošanai',
    category: 'SOIL',
    unit: 'TONNE',
    basePrice: 12,
    isRecycled: false,
  },
  {
    id: 'soil-sandclay',
    name: 'Smilšmāls',
    description: 'Smilšmāls pamatu un terases izbēršanai',
    category: 'SOIL',
    unit: 'TONNE',
    basePrice: 9,
    isRecycled: false,
  },
  {
    id: 'clay',
    name: 'Māls',
    description: 'Blīvēšanas māls dambju celtniecībai',
    category: 'CLAY',
    unit: 'TONNE',
    basePrice: 11,
    isRecycled: false,
  },
  {
    id: 'recycled-conc',
    name: 'Pārstrādāts betons',
    description: 'Sasmalcināts betona materiāls pamatu izbēršanai',
    category: 'RECYCLED_CONCRETE',
    unit: 'TONNE',
    basePrice: 7,
    isRecycled: true,
  },
  {
    id: 'recycled-soil',
    name: 'Pārstrādāta augsne',
    description: 'Kompostēta organiskā augsne',
    category: 'RECYCLED_SOIL',
    unit: 'TONNE',
    basePrice: 6,
    isRecycled: true,
  },
  {
    id: 'asphalt-milled',
    name: 'Frēzēts asfalts',
    description: 'Pārstrādāts asfalts ceļu remontdarbiem',
    category: 'ASPHALT',
    unit: 'TONNE',
    basePrice: 9,
    isRecycled: true,
  },
  {
    id: 'concrete-fill',
    name: 'Apbērsmes grants',
    description: 'Smalka šķemba pamatu un ietvju izbēršanai',
    category: 'CONCRETE',
    unit: 'TONNE',
    basePrice: 13,
    isRecycled: false,
  },
];

// UNIT_SHORT — imported from @/lib/materials

export const FRACTIONS: Record<string, string[]> = {
  DEFAULT: ['0/4', '0/8', '0/16', '0/32', '0/45', '4/16', '8/32', '16/45'],
  SAND: ['0/4', '0/8', '0.1/0.3', '0.5/1', 'Smalkas', 'Rupjas'],
  GRAVEL: ['0/8', '0/16', '0/32', '4/8', '8/16', '16/32', '16/45', '32/63'],
  STONE: ['0/32', '0/45', '16/45', '32/63', '45/90'],
  CONCRETE: ['B20', 'B25', 'B30', 'B35', 'B40'],
  ASPHALT: ['0/8', '0/11', '0/16', 'SMA-11', 'SMA-16'],
  RECYCLED_CONCRETE: ['0/32', '0/45', '16/45', '32/63'],
  RECYCLED_SOIL: ['0/45', '0/63', 'Jaukta'],
};

export const VEHICLES = [
  { id: 'TIPPER_26T', label: '26 t', emoji: '🚛', sub: '6×4' },
  { id: 'TIPPER_20T', label: '20 t', emoji: '🚚', sub: '8×4' },
  { id: 'TIPPER_15T', label: '15 t', emoji: '🚜', sub: '4×4' },
];
