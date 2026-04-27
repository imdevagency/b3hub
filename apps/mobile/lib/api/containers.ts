import { apiFetch } from './common';
import type { WasteType } from './orders';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ContainerType = 'SKIP' | 'ROLL_OFF' | 'COMPACTOR' | 'HOOKLOADER' | 'FLATBED';
export type ContainerSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
export type ContainerStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
export type ContainerOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'AWAITING_PICKUP'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ApiContainer {
  id: string;
  containerType: ContainerType;
  size: ContainerSize;
  volume: number; // m³
  maxWeight: number; // kg
  rentalPrice: number;
  deliveryFee: number;
  pickupFee: number;
  location: string;
  currency: string;
  status: ContainerStatus;
  owner: { id: string; name: string; logo?: string | null; city: string };
}

export interface ApiContainerOrder {
  id: string;
  container: ApiContainer;
  deliveryAddress: string;
  deliveryCity: string;
  rentalDays: number;
  totalPrice: number;
  currency: string;
  status: ContainerOrderStatus;
  deliveryDate?: string | null;
  pickupDate?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ApiWasteRecord {
  id: string;
  wasteType: WasteType;
  weight: number;
  volume?: number | null;
  processedDate?: string | null;
  recyclableWeight?: number | null;
  recyclingRate?: number | null;
  certificateUrl?: string | null;
  recyclingCenter: { id: string; name: string; address: string; city: string };
  containerOrder?: {
    id: string;
    order: { id: string; createdAt: string };
  } | null;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const containersApi = {
  containers: {
    /** Browse available containers (public) */
    list: (
      params: { containerType?: string; size?: string; page?: number },
      token: string,
    ) => {
      const q = new URLSearchParams();
      if (params.containerType) q.set('containerType', params.containerType);
      if (params.size) q.set('size', params.size);
      if (params.page) q.set('page', String(params.page));
      return apiFetch<{
        data: ApiContainer[];
        meta: { total: number; page: number; limit: number };
      }>(`/containers?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },

    /** Rent a container */
    rent: (
      containerId: string,
      body: {
        deliveryAddress: string;
        deliveryCity: string;
        deliveryLat?: number;
        deliveryLng?: number;
        rentalDays: number;
        notes?: string;
      },
      token: string,
    ) =>
      apiFetch<ApiContainerOrder>(`/containers/${containerId}/rent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }),

    /** Buyer's rental history */
    myOrders: (token: string) =>
      apiFetch<ApiContainerOrder[]>('/containers/orders', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  recyclingCenters: {
    /** Buyer: get their disposal compliance records */
    myDisposalRecords: (token: string) =>
      apiFetch<ApiWasteRecord[]>('/recycling-centers/disposal/mine', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Check if any active centers accept a given waste type (limit=1 probe) */
    checkAvailability: (wasteType: WasteType, token: string) =>
      apiFetch<{ data: { id: string; name: string }[]; total: number }>(
        `/recycling-centers?wasteType=${encodeURIComponent(wasteType)}&activeOnly=true&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),

    /** List all active centers for a given waste type (for buyer preference picker) */
    listByWasteType: (wasteType: WasteType, token: string) =>
      apiFetch<{ data: { id: string; name: string; city: string; address: string }[]; total: number }>(
        `/recycling-centers?wasteType=${encodeURIComponent(wasteType)}&activeOnly=true&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
  },
};
