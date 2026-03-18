import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type MaterialCategory =
  | 'SAND'
  | 'GRAVEL'
  | 'STONE'
  | 'CONCRETE'
  | 'SOIL'
  | 'RECYCLED_CONCRETE'
  | 'RECYCLED_SOIL'
  | 'ASPHALT'
  | 'CLAY'
  | 'OTHER';

export type MaterialUnit = 'TONNE' | 'M3' | 'PIECE' | 'LOAD';

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
  minOrder?: number;
  maxOrder?: number;
  isRecycled: boolean;
  quality?: string;
  images: string[];
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
  return apiFetch<ApiMaterial[]>(`/materials?supplierId=${supplierId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
