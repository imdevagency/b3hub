/**
 * Skip-hire API module.
 * Functions wrapping /api/v1/skip-hire/* for browsing skips and managing bookings.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type SkipWasteCategory =
  | 'MIXED'
  | 'GREEN_GARDEN'
  | 'CONCRETE_RUBBLE'
  | 'WOOD'
  | 'METAL_SCRAP'
  | 'ELECTRONICS_WEEE';

export type SkipSize = 'MINI' | 'MIDI' | 'BUILDERS' | 'LARGE';

export type SkipHireStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface SkipHireOrder {
  id: string;
  orderNumber: string;
  location: string;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  price: number;
  currency: string;
  status: SkipHireStatus;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkipHireInput {
  location: string;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string; // ISO date string
  carrierId?: string; // selected from quotes
  /** Preferred delivery time window: 'AM' (8–13), 'PM' (13–18), or 'ANY'. */
  deliveryWindow?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface SkipHireQuote {
  carrierId: string;
  carrierName: string;
  carrierLogo: string | null;
  carrierRating: number | null;
  price: number;
  currency: string;
}

export type SkipHireMapStatus = 'CONFIRMED' | 'DELIVERED';

export interface SkipMapOrder {
  id: string;
  orderNumber: string;
  location: string;
  lat: number | null;
  lng: number | null;
  skipSize: SkipSize;
  wasteCategory: SkipWasteCategory;
  status: SkipHireMapStatus;
  deliveryDate: string;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  price: number;
  currency: string;
  createdAt: string;
}

// Frontend → backend waste category mapping
const WASTE_CATEGORY_MAP: Record<string, SkipWasteCategory> = {
  mixed: 'MIXED',
  green: 'GREEN_GARDEN',
  rubble: 'CONCRETE_RUBBLE',
  wood: 'WOOD',
  metal: 'METAL_SCRAP',
  electronics: 'ELECTRONICS_WEEE',
};

// Frontend → backend skip size mapping
const SKIP_SIZE_MAP: Record<string, SkipSize> = {
  mini: 'MINI',
  midi: 'MIDI',
  builders: 'BUILDERS',
  large: 'LARGE',
};

export function mapWasteCategory(frontendId: string): SkipWasteCategory {
  return WASTE_CATEGORY_MAP[frontendId] ?? 'MIXED';
}

export function mapSkipSize(frontendId: string): SkipSize {
  return SKIP_SIZE_MAP[frontendId] ?? 'MIDI';
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function createSkipHireOrder(
  data: CreateSkipHireInput,
  token?: string,
): Promise<SkipHireOrder> {
  return apiFetch<SkipHireOrder>('/skip-hire', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function getMySkipHireOrders(token: string): Promise<SkipHireOrder[]> {
  return apiFetch<SkipHireOrder[]>('/skip-hire/my', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSkipHireQuotes(
  size: SkipSize,
  location: string,
  date: string,
): Promise<SkipHireQuote[]> {
  const params = new URLSearchParams({ size, location, date });
  return apiFetch<SkipHireQuote[]>(`/skip-hire/quotes?${params}`);
}

export async function getSkipCarrierMap(token: string): Promise<SkipMapOrder[]> {
  return apiFetch<SkipMapOrder[]>('/skip-hire/carrier-map', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type SkipMarketPrices = Record<SkipSize, number>;

/** Public — minimum price per skip size across verified carriers. */
export async function getSkipHireMarketPrices(): Promise<SkipMarketPrices> {
  return apiFetch<SkipMarketPrices>('/skip-hire/market-prices');
}
