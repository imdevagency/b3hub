import { apiFetch } from './common';
import type { ApiOrder } from './orders';

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
  description?: string | null;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  minOrder?: number | null;
  inStock: boolean;
  isRecycled: boolean;
  supplier: {
    id: string;
    name: string;
    city?: string | null;
  };
}

export interface SupplierOffer {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  totalPrice: number;
  distanceKm: number | null;
  etaDays: number;
  isInstant: true;
  deliveryRadiusKm: number | null;
  supplier: {
    id: string;
    name: string;
    city: string | null;
    rating: number | null;
    phone: string | null;
  };
}

// ─── API ──────────────────────────────────────────────────────────────────

export const materialsApi = {
  materials: {
    getAll: (token: string, params?: Record<string, string>) => {
      const qs =
        params && Object.keys(params).length
          ? '?' + new URLSearchParams(params).toString()
          : '';
      // Use search endpoint when a 'search' param is provided
      const path = params?.search
        ? `/materials/search?q=${encodeURIComponent(params.search)}${params.category ? `&category=${params.category}` : ''}`
        : `/materials${qs}`;
      return apiFetch<ApiMaterial[]>(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },

    getOne: (id: string, token: string) =>
      apiFetch<ApiMaterial>(`/materials/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (
      data: Partial<ApiMaterial> & { basePrice: number; name: string },
      token: string,
    ) =>
      apiFetch<ApiMaterial>('/materials', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<ApiMaterial>, token: string) =>
      apiFetch<ApiMaterial>(`/materials/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    remove: (id: string, token: string) =>
      apiFetch<void>(`/materials/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),

    createOrder: (
      input: {
        buyerId: string;
        materialId: string;
        quantity: number;
        unit: MaterialUnit;
        unitPrice: number;
        deliveryAddress: string;
        deliveryCity: string;
        deliveryPostal?: string;
        deliveryDate: string;
        siteContactName?: string;
        siteContactPhone?: string;
        notes?: string;
      },
      token: string,
    ) =>
      apiFetch<ApiOrder>('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderType: 'MATERIAL',
          buyerId: input.buyerId,
          items: [
            {
              materialId: input.materialId,
              quantity: input.quantity,
              unit: input.unit,
              unitPrice: input.unitPrice,
            },
          ],
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          deliveryPostal: input.deliveryPostal,
          deliveryDate: input.deliveryDate,
          siteContactName: input.siteContactName,
          siteContactPhone: input.siteContactPhone,
          notes: input.notes,
        }),
      }),

    getOffers: (
      params: {
        category: MaterialCategory;
        quantity: number;
        lat?: number;
        lng?: number;
      },
      token: string,
    ) => {
      const qs = new URLSearchParams({
        category: params.category,
        quantity: String(params.quantity),
        ...(params.lat != null ? { lat: String(params.lat), lng: String(params.lng) } : {}),
      }).toString();
      return apiFetch<SupplierOffer[]>(`/materials/offers?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  },
};
