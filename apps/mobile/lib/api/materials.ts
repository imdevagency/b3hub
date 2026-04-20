import { apiFetch } from './common';
import type { ApiOrder } from './orders';
import type { MaterialCategory, MaterialUnit } from '@b3hub/shared';

export type { MaterialCategory, MaterialUnit };

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiMaterial {
  id: string;
  name: string;
  description?: string | null;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  minOrder?: number | null;
  maxOrder?: number | null;
  deliveryRadiusKm?: number | null;
  inStock: boolean;
  isRecycled: boolean;
  featured?: boolean;
  /** Quantity currently in stock (null = unlimited / not tracked) */
  stockQty?: number | null;
  /** Supabase Storage URLs for product photos */
  images?: string[];
  supplier: {
    id: string;
    name: string;
    city?: string | null;
    onTimePct?: number | null;
    fulfillmentPct?: number | null;
  };
}

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
  etaHours?: number | null;
  etaLabel?: string;
  isInstant: true;
  minOrder?: number | null;
  deliveryRadiusKm: number | null;
  priceTiers?: { minQty: number; unitPrice: number }[];
  /** Percentage of orders delivered/completed (null if fewer than 3 orders) */
  completionRate: number | null;
  /** Total historical orders for this supplier */
  totalOrders: number;
  /** Quantity currently in stock (null = unlimited / not tracked) */
  stockQty?: number | null;
  /** Product photos from Supabase Storage */
  images?: string[];
  /** Quality grade text (e.g. "A klase") */
  quality?: string | null;
  /** Specification / certificate PDF URLs */
  certificates?: string[];
  /** True if this listing is admin-featured (floats to top) */
  featured?: boolean;
  /** Cached on-time delivery % from nightly cron (null if fewer than 10 orders) */
  onTimePct?: number | null;
  /** Cached order fulfillment % from nightly cron */
  fulfillmentPct?: number | null;
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
      return apiFetch<{ items: ApiMaterial[]; total: number; hasMore: boolean } | ApiMaterial[]>(path, {
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

    uploadImage: (id: string, base64: string, mimeType: string, token: string) =>
      apiFetch<{ images: string[] }>(`/materials/${id}/upload-image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, mimeType }),
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
        deliveryWindow?: string;
        deliveryFee?: number;
        deliveryLat?: number;
        deliveryLng?: number;
        siteContactName?: string;
        siteContactPhone?: string;
        sitePhotoUrl?: string;
        notes?: string;
        projectId?: string;
        truckCount?: number;
        truckIntervalMinutes?: number;
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
          deliveryWindow: input.deliveryWindow,
          deliveryFee: input.deliveryFee,
          deliveryLat: input.deliveryLat,
          deliveryLng: input.deliveryLng,
          siteContactName: input.siteContactName,
          siteContactPhone: input.siteContactPhone,
          sitePhotoUrl: input.sitePhotoUrl,
          notes: input.notes,
          projectId: input.projectId ?? undefined,
          truckCount: input.truckCount ?? 1,
          truckIntervalMinutes: input.truckIntervalMinutes ?? undefined,
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
