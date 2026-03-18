/**
 * Orders API module.
 * Functions wrapping /api/v1/orders/* for placing and managing material purchase orders.
 */
import { apiFetch } from './common';
import type { MaterialUnit } from './materials';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiOrderItem {
  material: { name: string; category: string };
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: string;
  items: ApiOrderItem[];
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  total: number;
  currency: string;
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  buyer?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  } | null;
  transportJobs?: {
    id: string;
    status: string;
    driver: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    } | null;
  }[];
  createdAt: string;
}

export interface CartOrderItem {
  materialId: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
}

export interface CreateCartOrderInput {
  buyerId: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal: string;
  deliveryDate?: string;
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  items: CartOrderItem[];
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyOrders(token: string, status?: string): Promise<ApiOrder[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<ApiOrder[]>(`/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function confirmOrder(id: string, token: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function cancelOrder(id: string, token: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createMaterialOrder(
  input: {
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
  },
  token: string,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderType: 'MATERIAL',
      buyerId: input.buyerId,
      deliveryAddress: input.deliveryAddress,
      deliveryCity: input.deliveryCity,
      deliveryState: '',
      deliveryPostal: input.deliveryPostal,
      deliveryDate: input.deliveryDate,
      deliveryFee: 0,
      notes: input.notes,
      items: [
        {
          materialId: input.materialId,
          quantity: input.quantity,
          unit: input.unit,
          unitPrice: input.unitPrice,
        },
      ],
    }),
  });
}

export async function createCartOrder(
  input: CreateCartOrderInput,
  token: string,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderType: 'MATERIAL',
      buyerId: input.buyerId,
      deliveryAddress: input.deliveryAddress,
      deliveryCity: input.deliveryCity,
      deliveryState: '',
      deliveryPostal: input.deliveryPostal,
      deliveryDate: input.deliveryDate,
      deliveryFee: 0,
      notes: input.notes,
      siteContactName: input.siteContactName,
      siteContactPhone: input.siteContactPhone,
      items: input.items,
    }),
  });
}
