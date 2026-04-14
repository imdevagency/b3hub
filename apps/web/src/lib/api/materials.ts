/**
 * Materials API module.
 * Functions wrapping /api/v1/materials/* for listing, creating, updating, deleting materials.
 */
import { apiFetch } from './common';
import type { MaterialCategory, MaterialUnit } from '@b3hub/shared';

export type { MaterialCategory, MaterialUnit };

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiMaterial {
  id: string;
  name: string;
  description?: string;
  category: MaterialCategory;
  subCategory?: string;
  basePrice: number;
  unit: MaterialUnit;
  currency: string;
  inStock: boolean;
  stockQty?: number | null;
  minOrder?: number;
  maxOrder?: number;
  isRecycled: boolean;
  quality?: string;
  images: string[];
  certificates?: string[];
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    logo?: string;
    rating?: number;
    city?: string;
  };
  createdAt: string;
}

export interface CreateMaterialInput {
  name: string;
  description?: string;
  category: MaterialCategory;
  subCategory?: string;
  basePrice: number;
  unit: MaterialUnit;
  inStock?: boolean;
  stockQty?: number;
  minOrder?: number;
  maxOrder?: number;
  isRecycled?: boolean;
  quality?: string;
  supplierId: string;
}

export interface UpdateMaterialInput {
  name?: string;
  description?: string;
  category?: MaterialCategory;
  subCategory?: string;
  basePrice?: number;
  unit?: MaterialUnit;
  inStock?: boolean;
  stockQty?: number | null;
  minOrder?: number;
  maxOrder?: number;
  isRecycled?: boolean;
  quality?: string;
}

export interface CreateMaterialOrderInput {
  materialId: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal: string;
  deliveryDate?: string;
  notes?: string;
  buyerId: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMaterialCategories(token: string): Promise<MaterialCategory[]> {
  return apiFetch<MaterialCategory[]>('/materials/categories', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMaterials(
  token: string,
  filters?: { category?: MaterialCategory; search?: string },
): Promise<ApiMaterial[]> {
  const qs = new URLSearchParams();
  if (filters?.category) qs.set('category', filters.category);
  const query = qs.toString() ? `?${qs}` : '';
  if (filters?.search) {
    return apiFetch<ApiMaterial[]>(
      `/materials/search?q=${encodeURIComponent(filters.search)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }
  return apiFetch<ApiMaterial[]>(`/materials${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyMaterials(token: string, supplierId: string): Promise<ApiMaterial[]> {
  const res = await apiFetch<{ items: ApiMaterial[] } | ApiMaterial[]>(`/materials?supplierId=${supplierId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(res) ? res : (res as { items: ApiMaterial[] }).items ?? [];
}

export async function createMaterial(
  input: CreateMaterialInput,
  token: string,
): Promise<ApiMaterial> {
  return apiFetch<ApiMaterial>('/materials', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMaterial(
  id: string,
  input: UpdateMaterialInput,
  token: string,
): Promise<ApiMaterial> {
  return apiFetch<ApiMaterial>(`/materials/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteMaterial(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/materials/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function uploadMaterialImage(
  id: string,
  base64: string,
  mimeType: string,
  token: string,
): Promise<{ images: string[] }> {
  return apiFetch<{ images: string[] }>(`/materials/${id}/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType }),
  });
}

export async function uploadMaterialDocument(
  id: string,
  base64: string,
  mimeType: string,
  token: string,
): Promise<{ certificates: string[] }> {
  return apiFetch<{ certificates: string[] }>(`/materials/${id}/upload-document`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mimeType }),
  });
}

export async function removeMaterialDocument(
  id: string,
  url: string,
  token: string,
): Promise<{ certificates: string[] }> {
  return apiFetch<{ certificates: string[] }>(
    `/materials/${id}/documents?url=${encodeURIComponent(url)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

// ─── Price tiers ────────────────────────────────────────────────────────────

export interface PriceTier {
  id?: string;
  minQty: number;
  unitPrice: number;
}

export async function getMaterialTiers(id: string, token: string): Promise<PriceTier[]> {
  return apiFetch<PriceTier[]>(`/materials/${id}/tiers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setMaterialTiers(
  id: string,
  tiers: Omit<PriceTier, 'id'>[],
  token: string,
): Promise<PriceTier[]> {
  return apiFetch<PriceTier[]>(`/materials/${id}/tiers`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(tiers),
  });
}

// ─── Marketplace offers ─────────────────────────────────────────────────────

export interface SupplierOffer {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  effectiveUnitPrice: number;
  deliveryFee: number | null;
  totalPrice: number;
  distanceKm: number | null;
  etaDays: number;
  isInstant: boolean;
  stockQty?: number | null;
  deliveryRadiusKm: number | null;
  images: string[];
  completionRate: number | null;
  totalOrders: number;
  supplier: {
    id: string;
    name: string;
    city: string | null;
    rating: number | null;
    phone: string | null;
  };
}

export async function getMaterialOffers(
  token: string,
  params: { category: MaterialCategory; quantity: number; lat?: number; lng?: number },
): Promise<SupplierOffer[]> {
  const qs = new URLSearchParams();
  qs.set('category', params.category);
  qs.set('quantity', String(params.quantity));
  if (params.lat !== undefined) qs.set('lat', String(params.lat));
  if (params.lng !== undefined) qs.set('lng', String(params.lng));
  return apiFetch<SupplierOffer[]>(`/materials/offers?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Availability blocks ─────────────────────────────────────────────────────

export interface AvailabilityBlock {
  id: string;
  materialId: string;
  startDate: string;
  endDate: string;
  note?: string | null;
  createdAt: string;
}

export async function getMaterialAvailability(
  token: string,
  materialId: string,
): Promise<AvailabilityBlock[]> {
  return apiFetch<AvailabilityBlock[]>(`/materials/${materialId}/availability`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function addMaterialAvailabilityBlock(
  token: string,
  materialId: string,
  dto: { startDate: string; endDate: string; note?: string },
): Promise<AvailabilityBlock> {
  return apiFetch<AvailabilityBlock>(`/materials/${materialId}/availability`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function removeMaterialAvailabilityBlock(
  token: string,
  materialId: string,
  blockId: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/materials/${materialId}/availability/${blockId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
