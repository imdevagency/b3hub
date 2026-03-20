import { apiFetch } from './common';
import type { MaterialUnit } from './materials';

// ─── Types ─────────────────────────────────────────────────────────────────

export type QuoteRequestStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
export type QuoteResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

/** Shape returned by GET /quote-requests/open (supplier view — no buyer address, only city) */
export interface OpenQuoteRequest {
  id: string;
  requestNumber: string;
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryCity: string;
  notes: string | null;
  status: QuoteRequestStatus;
  createdAt: string;
  buyer: { firstName: string; lastName: string };
  /** Array of supplier IDs that already responded */
  responses: { supplierId: string }[];
}

export interface QuoteResponse {
  id: string;
  supplierId: string;
  pricePerUnit: number;
  totalPrice: number;
  unit: MaterialUnit;
  etaDays: number;
  notes: string | null;
  validUntil: string | null;
  status: QuoteResponseStatus;
  supplier: {
    id: string;
    name: string;
    city: string | null;
    rating: number | null;
  };
}

export interface QuoteRequest {
  id: string;
  requestNumber: string;
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryAddress: string;
  deliveryCity: string;
  status: QuoteRequestStatus;
  responses: QuoteResponse[];
  createdAt: string;
}

type Paginated<T> = {
  data?: T[];
  pagination?: {
    total: number;
    limit: number;
    skip: number;
    hasMore: boolean;
  };
};

function normalizeList<T>(payload: T[] | Paginated<T> | null | undefined): T[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// ─── API ──────────────────────────────────────────────────────────────────

export const quoteRequestsApi = {
  quoteRequests: {
    create: (
      dto: {
        materialCategory: string;
        materialName: string;
        quantity: number;
        unit: MaterialUnit;
        deliveryAddress: string;
        deliveryCity: string;
        deliveryLat?: number;
        deliveryLng?: number;
        notes?: string;
      },
      token: string,
    ) =>
      apiFetch<QuoteRequest>('/quote-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    get: (id: string, token: string) =>
      apiFetch<QuoteRequest>(`/quote-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    list: (token: string) =>
      apiFetch<QuoteRequest[] | Paginated<QuoteRequest>>('/quote-requests', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(normalizeList),

    accept: (id: string, responseId: string, token: string) =>
      apiFetch<{ id: string; orderNumber: string }>(`/quote-requests/${id}/accept/${responseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Supplier: list all open requests they can respond to. */
    openRequests: (token: string) =>
      apiFetch<OpenQuoteRequest[] | Paginated<OpenQuoteRequest>>('/quote-requests/open', {
        headers: { Authorization: `Bearer ${token}` },
      }).then(normalizeList),

    /** Supplier: submit a price proposal for a quote request. */
    respond: (
      id: string,
      dto: {
        pricePerUnit: number;
        unit: MaterialUnit;
        etaDays: number;
        notes?: string;
        validUntil?: string;
      },
      token: string,
    ) =>
      apiFetch<QuoteResponse>(`/quote-requests/${id}/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),
  },
};
