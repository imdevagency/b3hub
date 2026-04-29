import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type SkipWasteCategory =
  | 'MIXED'
  | 'GREEN_GARDEN'
  | 'CONCRETE_RUBBLE'
  | 'WOOD'
  | 'METAL_SCRAP'
  | 'ELECTRONICS_WEEE';

export type SkipSize = string; // was enum; now a SkipSizeDefinition.code string
export type SkipCategory = 'SKIP' | 'BIG_BAG' | 'CONTAINER';

export interface SkipSizeDefinition {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  volumeM3: number;
  category: SkipCategory;
  description: string | null;
  descriptionLv: string | null;
  heightPct: number;
  basePrice: number | null;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

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
  hireDays?: number | null;
  price: number;
  currency: string;
  status: SkipHireStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  unloadingPointPhotoUrl?: string | null;
  carrierId?: string | null;
  carrier?: { id: string; name: string; phone?: string | null; rating?: number | null } | null;
  paymentMethod?: 'CARD' | 'INVOICE' | null;
  deliveryWindow?: string | null;
  statusTimestamps?: Record<string, string> | null;
  /** Computed server-side on carrier-map endpoint — days past the agreed hire period */
  overdueDays?: number;
  /** Computed server-side — overdue fee in EUR (excl. VAT) */
  overdueFeeEur?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OverdueInvoiceResult {
  invoice: {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    dueDate: string;
  };
  overdueDays: number;
  overdueFeeEur: number;
  total: number;
}

export interface CreateSkipHireInput {
  location: string;
  lat?: number;
  lng?: number;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  /** Hire period in days (7, 14, 28). */
  hireDays?: number;
  /** 'AM' | 'PM' | 'ANY' — preferred delivery window */
  deliveryWindow?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  bisNumber?: string;
  unloadingPointPhotoUrl?: string;
  /** CARD = Paysera redirect; INVOICE = bank transfer. Defaults to CARD. */
  paymentMethod?: 'CARD' | 'INVOICE';
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
      apiFetch<SkipHireOrder & { paymentUrl: string | null; payseraOrderId: string | null }>('/skip-hire', {
        method: 'POST',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify(data),
      }),

    /** Public — returns minimum prices per skip size across verified carriers. */
    getMarketPrices: () =>
      apiFetch<Record<string, number>>('/skip-hire/market-prices'),

    /** Public — returns the active size catalogue ordered by sortOrder. */
    getSizes: () =>
      apiFetch<SkipSizeDefinition[]>('/skip-hire/sizes'),

    /** Public — returns carrier quotes for given size, location and date. */
    getQuotes: (params: { size: string; location: string; date: string; lat?: number | null; lng?: number | null }) => {
      let url = `/skip-hire/quotes?size=${params.size}&location=${encodeURIComponent(params.location)}&date=${params.date}`;
      if (params.lat != null) url += `&lat=${params.lat}`;
      if (params.lng != null) url += `&lng=${params.lng}`;
      return apiFetch<SkipHireQuote[]>(url);
    },

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

    /** Carrier: create an overdue invoice for a DELIVERED skip whose hire period has expired. */
    overdueInvoice: (id: string, token: string) =>
      apiFetch<OverdueInvoiceResult>(`/skip-hire/${id}/overdue-invoice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    /**
     * Upload an unloading-point photo before order creation.
     * Returns a public Supabase Storage URL to include in the create payload.
     */
    uploadPhoto: (base64: string, mimeType: string, token: string) =>
      apiFetch<{ url: string }>('/skip-hire/upload-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, mimeType }),
      }),

    /** Buyer: amend delivery date, window, notes, or contact on a PENDING/CONFIRMED order. */
    amend: (
      id: string,
      data: {
        deliveryDate?: string;
        deliveryWindow?: string;
        notes?: string;
        contactName?: string;
        contactPhone?: string;
      },
      token: string,
    ) =>
      apiFetch<SkipHireOrder>(`/skip-hire/${id}/amend`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    /** Buyer: request early collection of a DELIVERED skip. */
    requestPickup: (id: string, token: string) =>
      apiFetch<{ ok: boolean; message: string }>(`/skip-hire/${id}/request-pickup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Buyer: extend the hire period by N additional days on a DELIVERED order. */
    extendHire: (id: string, additionalDays: number, token: string) =>
      apiFetch<SkipHireOrder>(`/skip-hire/${id}/extend`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ additionalDays }),
      }),
  },
};
