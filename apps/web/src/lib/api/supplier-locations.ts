/**
 * Supplier Locations API module.
 * Functions wrapping /api/v1/supplier-locations/* for managing quarry / loading sites.
 */
import { apiFetch } from './common';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiSupplierLocation {
  id: string;
  name: string;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  country: string;
  lat?: number | null;
  lng?: number | null;
  active: boolean;
  supplierId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierLocationInput {
  name: string;
  address: string;
  city?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export type UpdateSupplierLocationInput = Partial<CreateSupplierLocationInput> & {
  active?: boolean;
};

// ─── API functions ────────────────────────────────────────────────────────────

export async function getMySupplierLocations(
  token: string,
): Promise<ApiSupplierLocation[]> {
  return apiFetch<ApiSupplierLocation[]>('/supplier-locations/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createSupplierLocation(
  input: CreateSupplierLocationInput,
  token: string,
): Promise<ApiSupplierLocation> {
  return apiFetch<ApiSupplierLocation>('/supplier-locations', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateSupplierLocation(
  id: string,
  input: UpdateSupplierLocationInput,
  token: string,
): Promise<ApiSupplierLocation> {
  return apiFetch<ApiSupplierLocation>(`/supplier-locations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteSupplierLocation(
  id: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/supplier-locations/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
