/**
 * Saved Addresses API module.
 * Functions wrapping /api/v1/saved-addresses/*.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedAddressInput {
  label: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export type UpdateSavedAddressInput = Partial<CreateSavedAddressInput>;

// ─── API functions ─────────────────────────────────────────────────────────

export function getSavedAddresses(): Promise<SavedAddress[]> {
  return apiFetch('/saved-addresses', { method: 'GET' });
}

export function createSavedAddress(data: CreateSavedAddressInput): Promise<SavedAddress> {
  return apiFetch('/saved-addresses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateSavedAddress(
  id: string,
  data: UpdateSavedAddressInput,
): Promise<SavedAddress> {
  return apiFetch(`/saved-addresses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteSavedAddress(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/saved-addresses/${id}`, { method: 'DELETE' });
}

export function setDefaultSavedAddress(id: string): Promise<SavedAddress> {
  return apiFetch(`/saved-addresses/${id}/set-default`, { method: 'PATCH' });
}
