/**
 * Guest Orders API — public endpoints, no auth required.
 */
import { API_URL, apiFetch } from './common';
import type { AuthResponse } from './auth';

export interface CreateGuestOrderPayload {
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: string;
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
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  deliveryWindow: string | null;
  contactName: string;
  createdAt: string;
  updatedAt: string;
}

/** Submit a new guest order (no account required). */
export async function createGuestOrder(
  payload: CreateGuestOrderPayload,
): Promise<GuestOrderCreatedResult> {
  return apiFetch('/guest-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Fetch public tracking data for a guest order by token. */
export async function getGuestOrderByToken(
  token: string,
): Promise<GuestOrderTracking> {
  const res = await fetch(`${API_URL}/guest-orders/track/${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error('Pasūtījums nav atrasts');
  }
  return res.json();
}

/**
 * Claim a guest order by creating a real account pre-filled with the
 * order's contact info. Returns the same shape as registerUser/loginUser
 * (User + JWT) so callers can persist auth and redirect to the dashboard.
 */
export interface ClaimGuestOrderPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export async function claimGuestOrder(
  token: string,
  payload: ClaimGuestOrderPayload,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>(
    `/guest-orders/track/${encodeURIComponent(token)}/claim`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
