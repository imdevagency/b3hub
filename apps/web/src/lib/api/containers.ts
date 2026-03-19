/**
 * Containers API module (web).
 * Functions wrapping /api/v1/containers/* endpoints.
 */
import { apiFetch } from './common';

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
  volume: number;
  maxWeight: number;
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

export type WasteType =
  | 'CONCRETE'
  | 'BRICK'
  | 'WOOD'
  | 'METAL'
  | 'PLASTIC'
  | 'SOIL'
  | 'MIXED'
  | 'HAZARDOUS';

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
  containerOrder?: { id: string; order: { id: string; createdAt: string } } | null;
  createdAt: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

/** Buyer: get their container rental orders */
export async function getMyContainerOrders(token: string): Promise<ApiContainerOrder[]> {
  return apiFetch<ApiContainerOrder[]>('/containers/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Browse available containers */
export async function getAvailableContainers(
  token: string,
  params: { containerType?: string; size?: string } = {},
): Promise<{ data: ApiContainer[]; meta: { total: number; page: number; limit: number } }> {
  const q = new URLSearchParams();
  if (params.containerType) q.set('containerType', params.containerType);
  if (params.size) q.set('size', params.size);
  return apiFetch(`/containers?${q.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Buyer: get their disposal compliance records (for certificates page) */
export async function getMyWasteRecords(token: string): Promise<ApiWasteRecord[]> {
  return apiFetch<ApiWasteRecord[]>('/recycling-centers/disposal/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
