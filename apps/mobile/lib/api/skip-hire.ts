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
  lat?: number | null;
  lng?: number | null;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  price: number;
  currency: string;
  status: SkipHireStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  unloadingPointPhotoUrl?: string | null;
  carrierId?: string | null;
  deliveryWindow?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkipHireInput {
  location: string;
  lat?: number;
  lng?: number;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  /** 'AM' | 'PM' | 'ANY' — preferred delivery window */
  deliveryWindow?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  unloadingPointPhotoUrl?: string;
  /** Selected carrier id from a /quotes response — backend derives price from carrier pricing */
  carrierId?: string;
}

export interface SkipHireQuote {
  carrierId: string;
  carrierName: string;
  carrierLogo: string | null;
  carrierRating: number | null;
  price: number;
  currency: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const skipHireApi = {
  skipHire: {
    create: (data: CreateSkipHireInput, token?: string) =>
      apiFetch<SkipHireOrder>('/skip-hire', {
        method: 'POST',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify(data),
      }),

    /** Public — returns minimum prices per skip size across verified carriers. */
    getMarketPrices: () =>
      apiFetch<Record<SkipSize, number>>('/skip-hire/market-prices'),

    /** Public — returns carrier quotes for given size, location and date. */
    getQuotes: (params: { size: SkipSize; location: string; date: string }) =>
      apiFetch<SkipHireQuote[]>(
        `/skip-hire/quotes?size=${params.size}&location=${encodeURIComponent(params.location)}&date=${params.date}`,
      ),

    getById: (id: string, token: string) =>
      apiFetch<SkipHireOrder>(`/skip-hire/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myOrders: (token: string) =>
      apiFetch<SkipHireOrder[]>('/skip-hire/my', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Carrier: list all CONFIRMED + DELIVERED skips for this carrier company. */
    carrierOrders: (token: string) =>
      apiFetch<SkipHireOrder[]>('/skip-hire/carrier-map', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Buyer: cancel a pending/confirmed skip hire order. */
    cancel: (id: string, token: string) =>
      apiFetch<SkipHireOrder>(`/skip-hire/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Carrier: advance a skip order status (CONFIRMED→DELIVERED or DELIVERED→COLLECTED). */
    updateCarrierStatus: (id: string, status: SkipHireStatus, token: string) =>
      apiFetch<SkipHireOrder>(`/skip-hire/${id}/carrier-status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      }),
  },
};
