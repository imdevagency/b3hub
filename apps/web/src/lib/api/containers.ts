/**
 * Containers API module (web).
 * Functions wrapping /api/v1/containers/* endpoints.
 */
import { apiFetch } from './common';
import type { WasteType } from '@b3hub/shared';

export type { WasteType };

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

// WasteType is imported from @b3hub/shared above.

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

// ─── Carrier fleet management ──────────────────────────────────────────────

export interface CreateContainerInput {
  containerType: ContainerType;
  size: ContainerSize;
  volume: number;
  maxWeight: number;
  rentalPrice: number;
  deliveryFee: number;
  pickupFee: number;
  location?: string;
  currency?: string;
}

/** Carrier: add a new container to their fleet. */
export async function createContainer(
  token: string,
  data: CreateContainerInput,
): Promise<ApiContainer> {
  return apiFetch<ApiContainer>('/containers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/** Carrier: list all containers in their fleet. */
export async function getMyFleetContainers(token: string): Promise<ApiContainer[]> {
  return apiFetch<ApiContainer[]>('/containers/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Carrier: update a container (pricing, status, details). */
export async function updateContainer(
  token: string,
  id: string,
  data: Partial<CreateContainerInput> & { status?: ContainerStatus },
): Promise<ApiContainer> {
  return apiFetch<ApiContainer>(`/containers/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/** Carrier: remove a container from their fleet. */
export async function deleteContainer(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/containers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Carrier: update the status of an incoming rental order. */
export async function updateContainerOrderStatus(
  token: string,
  orderId: string,
  status: ContainerOrderStatus,
): Promise<ApiContainerOrder> {
  return apiFetch<ApiContainerOrder>(`/containers/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}
