import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ToiletCabinStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'IN_USE'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ToiletCabinOrder {
  id: string;
  orderNumber: string;
  address: string;
  city: string;
  lat?: number | null;
  lng?: number | null;
  cabinCount: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string | null;
  price: number;
  currency: string;
  status: ToiletCabinStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  userId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToiletCabinInput {
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  cabinCount: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: 'AM' | 'PM' | 'ANY';
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

// ─── API methods ────────────────────────────────────────────────────────────

export const toiletCabinsApi = {
  createToiletCabinOrder: (data: CreateToiletCabinInput, token?: string) =>
    apiFetch<ToiletCabinOrder>('/toilet-cabins', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }),

  listToiletCabinOrders: (token: string, status?: ToiletCabinStatus) =>
    apiFetch<ToiletCabinOrder[]>(
      `/toilet-cabins${status ? `?status=${status}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  getToiletCabinOrder: (id: string, token: string) =>
    apiFetch<ToiletCabinOrder>(`/toilet-cabins/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
};
