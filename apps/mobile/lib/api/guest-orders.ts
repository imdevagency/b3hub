/**
 * Guest Orders API — public endpoints, no auth required.
 *
 * Mirrors apps/web/src/lib/api/guest-orders.ts. Used by the mobile
 * `WizardAuthGate` "Continue as guest" path and the public tracking screen.
 */
import { API_URL, apiFetch } from './common';

// ── Shared contact + location fields ──────────────────────────────────────

interface GuestContactBase {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDate?: string;
  deliveryWindow?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  notes?: string;
}

// ── Category-specific payloads ────────────────────────────────────────────

export interface CreateGuestMaterialPayload extends GuestContactBase {
  category: 'MATERIAL';
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface CreateGuestSkipHirePayload extends GuestContactBase {
  category: 'SKIP_HIRE';
  skipSize: string;
  skipWasteCategory: string;
  hireDays: number;
  collectionDate?: string;
}

export interface CreateGuestTransportPayload extends GuestContactBase {
  category: 'TRANSPORT';
  pickupAddress: string;
  pickupCity: string;
  pickupLat?: number;
  pickupLng?: number;
  vehicleType: string;
  cargoDescription?: string;
  estimatedWeight?: number;
}

export interface CreateGuestDisposalPayload extends GuestContactBase {
  category: 'DISPOSAL';
  wasteTypes: string;       // JSON array string e.g. '["CONCRETE","SOIL"]'
  disposalVolume?: number;
  truckType?: string;
  bisNumber?: string;       // BIS case reference — required for construction waste under Latvian law
}

/** Union of all supported guest order payloads */
export type CreateGuestOrderPayload =
  | CreateGuestMaterialPayload
  | CreateGuestSkipHirePayload
  | CreateGuestTransportPayload
  | CreateGuestDisposalPayload;

export interface GuestOrderCreatedResult {
  orderNumber: string;
  token: string;
  trackingUrl: string;
  status: string;
}

export interface GuestOrderTracking {
  orderNumber: string;
  token: string;
  status: string;
  category: string;
  materialCategory: string | null;
  materialName: string | null;
  quantity: number | null;
  unit: string | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  deliveryWindow: string | null;
  contactName: string;
  createdAt: string;
  updatedAt: string;
}

/** Submit a new guest order (no account required). */
async function createGuestOrder(
  payload: CreateGuestOrderPayload,
): Promise<GuestOrderCreatedResult> {
  return apiFetch<GuestOrderCreatedResult>('/guest-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Fetch public tracking data for a guest order by token. */
async function getGuestOrderByToken(token: string): Promise<GuestOrderTracking> {
  const res = await fetch(`${API_URL}/guest-orders/track/${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error('Pasūtījums nav atrasts');
  }
  return res.json();
}

export const guestOrdersApi = {
  guestOrders: {
    create: createGuestOrder,
    track: getGuestOrderByToken,
  },
};
