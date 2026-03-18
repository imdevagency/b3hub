/**
 * Quote requests API module.
 * Functions for creating RFQs, listing quotes, submitting and accepting offers.
 */
import { apiFetch } from './common';
import type { MaterialCategory, MaterialUnit } from './materials';

// ─── Types ─────────────────────────────────────────────────────────────────

export type QuoteRequestStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
export type QuoteResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuoteSupplier {
  id: string;
  name: string;
  city: string;
  rating?: number;
  phone?: string;
}

export interface QuoteResponse {
  id: string;
  pricePerUnit: number;
  unit: MaterialUnit;
  etaDays: number;
  notes?: string;
  validUntil?: string;
  status: QuoteResponseStatus;
  supplier: QuoteSupplier;
  createdAt: string;
}

export interface QuoteRequest {
  id: string;
  requestNumber: string;
  materialCategory: MaterialCategory;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryLat?: number;
  deliveryLng?: number;
  notes?: string;
  status: QuoteRequestStatus;
  responses: QuoteResponse[];
  createdAt: string;
}

export interface CreateQuoteRequestInput {
  materialCategory: MaterialCategory;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryLat?: number;
  deliveryLng?: number;
  notes?: string;
}

export interface CreateQuoteResponseInput {
  pricePerUnit: number;
  unit: MaterialUnit;
  etaDays: number;
  notes?: string;
  validUntil?: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function createQuoteRequest(
  input: CreateQuoteRequestInput,
  token: string,
): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>('/quote-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getMyQuoteRequests(token: string): Promise<QuoteRequest[]> {
  return apiFetch<QuoteRequest[]>('/quote-requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getQuoteRequest(id: string, token: string): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>(`/quote-requests/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getOpenQuoteRequests(token: string): Promise<QuoteRequest[]> {
  return apiFetch<QuoteRequest[]>('/quote-requests/open', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function respondToQuoteRequest(
  id: string,
  input: CreateQuoteResponseInput,
  token: string,
): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>(`/quote-requests/${id}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function acceptQuoteResponse(
  requestId: string,
  responseId: string,
  token: string,
): Promise<QuoteRequest> {
  return apiFetch<QuoteRequest>(`/quote-requests/${requestId}/accept/${responseId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
