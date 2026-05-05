/**
 * Toilet Cabin Orders — public + authenticated endpoints.
 * POST /toilet-cabins uses OptionalJwtAuthGuard — works without a token.
 */
import { apiFetch } from './common';

export interface CreateToiletCabinPayload {
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  cabinCount: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string;
  paymentMethod?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface ToiletCabinOrderResult {
  id: string;
  orderNumber: string;
  status: string;
  price: number;
  currency: string;
  payseraPaymentUrl?: string | null;
}

export async function createToiletCabinOrder(
  payload: CreateToiletCabinPayload,
  token?: string,
): Promise<ToiletCabinOrderResult> {
  return apiFetch<ToiletCabinOrderResult>('/toilet-cabins', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
