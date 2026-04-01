/**
 * Orders API module.
 * Functions wrapping /api/v1/orders/* for placing and managing material purchase orders.
 */
import { apiFetch } from './common';
import type { MaterialUnit } from './materials';
import type { WasteType } from './containers';

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
  surcharges?: ApiOrderSurcharge[];
  createdAt: string;
  linkedSkipOrder?: {
    id: string;
    orderNumber: string;
    skipSize: string;
    wasteCategory: string;
    status: string;
    deliveryDate: string | null;
    price: number;
  } | null;
}

export interface CartOrderItem {
  materialId: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
}

export interface CreateCartOrderInput {
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal: string;
  deliveryDate?: string;
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  items: CartOrderItem[];
}

interface PaginatedOrdersResponse {
  data?: ApiOrder[];
}

function normalizeOrdersPayload(payload: ApiOrder[] | PaginatedOrdersResponse): ApiOrder[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyOrders(token: string, status?: string): Promise<ApiOrder[]> {
  const qs = status ? `?status=${status}` : '';
  const payload = await apiFetch<ApiOrder[] | PaginatedOrdersResponse>(`/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return normalizeOrdersPayload(payload);
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

export async function linkSkipOrder(
  orderId: string,
  skipHireOrderId: string | null,
  token: string,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${orderId}/link-skip`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ skipHireOrderId }),
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
  },
  token: string,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderType: 'MATERIAL',
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

export type DisposalTruckType = 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';
export type TransportVehicleType = 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';

export type SurchargeType =
  | 'FUEL'
  | 'WAITING_TIME'
  | 'WEEKEND'
  | 'OVERWEIGHT'
  | 'NARROW_ACCESS'
  | 'REMOTE_AREA'
  | 'TOLL'
  | 'OTHER';

export interface ApiOrderSurcharge {
  id: string;
  type: SurchargeType;
  label: string;
  amount: number;
  currency: string;
  billable: boolean;
  createdAt: string;
}

export interface CreateDisposalOrderInput {
  pickupAddress: string;
  pickupCity: string;
  pickupLat?: number;
  pickupLng?: number;
  wasteType: WasteType;
  truckType: DisposalTruckType;
  truckCount: number;
  estimatedWeight: number;
  description?: string;
  requestedDate: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export interface CreateTransportOrderInput {
  pickupAddress: string;
  pickupCity: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffLat?: number;
  dropoffLng?: number;
  vehicleType: TransportVehicleType;
  loadDescription: string;
  estimatedWeight?: number;
  requestedDate: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export interface CreateOrderResponse {
  id: string;
  jobNumber?: string;
  orderNumber?: string;
}

export async function createDisposalOrder(input: CreateDisposalOrderInput, token: string): Promise<CreateOrderResponse> {
  return apiFetch('/orders/disposal', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function createTransportOrder(input: CreateTransportOrderInput, token: string): Promise<CreateOrderResponse> {
  return apiFetch('/orders/freight', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getOrder(id: string, token: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function addOrderSurcharge(
  orderId: string,
  dto: { type: SurchargeType; label: string; amount: number; billable?: boolean },
  token: string,
): Promise<ApiOrderSurcharge> {
  return apiFetch<ApiOrderSurcharge>(`/orders/${orderId}/surcharges`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function removeOrderSurcharge(
  orderId: string,
  surchargeId: string,
  token: string,
): Promise<void> {
  await apiFetch(`/orders/${orderId}/surcharges/${surchargeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
