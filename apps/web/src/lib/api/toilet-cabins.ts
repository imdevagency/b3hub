/**
 * Toilet Cabin Orders — public + authenticated endpoints.
 * POST /toilet-cabins uses OptionalJwtAuthGuard — works without a token.
 */
import { apiFetch } from './common';

export type ToiletCabinType = 'STANDARD' | 'DISABLED_ACCESS' | 'VIP' | 'HEATED';

export interface CreateToiletCabinPayload {
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  cabinType?: ToiletCabinType;
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

// ── Carrier-side ──────────────────────────────────────────────────────────────

export type ToiletCabinStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'IN_USE'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CarrierToiletCabinOrder {
  id: string;
  orderNumber: string;
  address: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  cabinCount: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string | null;
  price: number;
  currency: string;
  status: ToiletCabinStatus;
  contactName?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  createdAt: string;
}

export async function getCarrierToiletCabinOrders(
  token: string,
  status?: string,
): Promise<CarrierToiletCabinOrder[]> {
  const qs = status && status !== 'ALL' ? `?status=${status}` : '';
  return apiFetch<CarrierToiletCabinOrder[]>(`/toilet-cabins/carrier/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateToiletCabinCarrierStatus(
  id: string,
  status: ToiletCabinStatus,
  token: string,
): Promise<void> {
  return apiFetch<void>(`/toilet-cabins/${id}/carrier-status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Carrier fleet settings ────────────────────────────────────────────────────

export interface CarrierToiletCabinSettings {
  id: string;
  carrierId: string;
  cabinType: ToiletCabinType;
  pricePerCabinPerDay: number;
  maxCabins: number;
  serviceCities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetToiletCabinSettingsPayload {
  cabinType: ToiletCabinType;
  pricePerCabinPerDay: number;
  maxCabins: number;
  serviceCities: string[];
  isActive: boolean;
}

export async function getCarrierToiletCabinSettings(
  token: string,
): Promise<CarrierToiletCabinSettings[]> {
  return apiFetch<CarrierToiletCabinSettings[]>('/toilet-cabins/carrier/settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function upsertCarrierToiletCabinSettings(
  payload: SetToiletCabinSettingsPayload,
  token: string,
): Promise<CarrierToiletCabinSettings> {
  return apiFetch<CarrierToiletCabinSettings>('/toilet-cabins/carrier/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}` },
  });
}
