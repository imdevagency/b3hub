import { apiFetch } from './common';

// ─── Shared waste / freight creation types ────────────────────────────────

export type WasteType =
  | 'CONCRETE'
  | 'BRICK'
  | 'WOOD'
  | 'METAL'
  | 'PLASTIC'
  | 'SOIL'
  | 'MIXED'
  | 'HAZARDOUS';

export type DisposalTruckType = 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';
export type TransportVehicleType = 'TIPPER_SMALL' | 'TIPPER_LARGE' | 'ARTICULATED_TIPPER';

export interface CreateDisposalOrderInput {
  pickupAddress: string;
  pickupCity: string;
  pickupState?: string;
  pickupPostal?: string;
  pickupLat?: number;
  pickupLng?: number;
  wasteType: WasteType;
  truckType: DisposalTruckType;
  truckCount: number;
  estimatedWeight: number;
  description?: string;
  requestedDate: string;
  /** 'AM' | 'PM' | 'ANY' — preferred pickup window */
  pickupWindow?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export interface CreateTransportOrderInput {
  pickupAddress: string;
  pickupCity: string;
  pickupState?: string;
  pickupPostal?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress: string;
  dropoffCity: string;
  dropoffState?: string;
  dropoffPostal?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  vehicleType: TransportVehicleType;
  loadDescription: string;
  estimatedWeight?: number;
  requestedDate: string;
  /** 'AM' | 'PM' | 'ANY' — preferred pickup/delivery window */
  pickupWindow?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
}

export interface CreateMaterialOrderInput {
  buyerId: string;
  materialId: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal?: string;
  deliveryDate: string;
  deliveryWindow?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  notes?: string;
  projectId?: string;
}

// ─── Recurring order schedule ─────────────────────────────────────────────

export interface CreateOrderScheduleInput {
  orderType: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPostal: string;
  deliveryWindow?: string;
  deliveryFee?: number;
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  projectId?: string;
  items: { materialId: string; quantity: number; unit: string }[];
  intervalDays: number;
  nextRunAt?: string;
  endsAt?: string;
}

export interface ApiOrderSchedule {
  id: string;
  orderType: string;
  deliveryAddress: string;
  deliveryCity: string;
  intervalDays: number;
  nextRunAt: string;
  endsAt: string | null;
  enabled: boolean;
  itemsSnapshot: { materialId: string; quantity: number; unit: string }[];
  createdAt: string;
}

// ─── Order response types ─────────────────────────────────────────────────

export interface CreateOrderResponse {
  id: string;
  jobNumber?: string;
  orderNumber?: string;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  items: {
    material: { name: string; category: string };
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  deliveryWindow?: string | null;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  currency: string;
  siteContactName: string | null;
  siteContactPhone: string | null;
  buyer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
  transportJobs?: {
    id: string;
    status: string;
    actualWeightKg: number | null;
    pickupPhotoUrl: string | null;
    driver: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      avatar: string | null;
    } | null;
    vehicle: { id: string; licensePlate: string; vehicleType: string } | null;
    deliveryProof?: {
      id: string;
      photos: string[];
      notes: string | null;
      recipientName: string | null;
      createdAt: string;
    } | null;
  }[];
  linkedSkipOrder?: {
    id: string;
    orderNumber: string;
    skipSize: string;
    wasteCategory: string;
    status: string;
    deliveryDate: string;
    price: number;
  } | null;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const ordersApi = {
  /** Disposal order — buyer requests waste collection */
  disposal: {
    create: (input: CreateDisposalOrderInput, token: string) =>
      apiFetch<CreateOrderResponse>('/orders/disposal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
  },

  /** Freight order — buyer requests cargo transport */
  transport: {
    create: (input: CreateTransportOrderInput, token: string) =>
      apiFetch<CreateOrderResponse>('/orders/freight', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
  },

  orders: {
    stats: (token: string) =>
      apiFetch<Record<string, any>>('/orders/stats', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myOrders: async (token: string): Promise<ApiOrder[]> => {
      const res = await apiFetch<{ data: ApiOrder[]; pagination: any }>('/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data || [];
    },

    getOne: (id: string, token: string) =>
      apiFetch<ApiOrder>(`/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    confirm: (id: string, token: string) =>
      apiFetch<ApiOrder>(`/orders/${id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    cancel: (id: string, token: string) =>
      apiFetch<ApiOrder>(`/orders/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    startLoading: (id: string, token: string) =>
      apiFetch<ApiOrder>(`/orders/${id}/start-loading`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    linkSkipOrder: (orderId: string, skipHireOrderId: string | null, token: string) =>
      apiFetch<ApiOrder>(`/orders/${orderId}/link-skip`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipHireOrderId }),
      }),
  },

  schedules: {
    create: (input: CreateOrderScheduleInput, token: string) =>
      apiFetch<ApiOrderSchedule>('/orders/schedules', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),

    list: (token: string) =>
      apiFetch<ApiOrderSchedule[]>('/orders/schedules', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    pause: (id: string, token: string) =>
      apiFetch<ApiOrderSchedule>(`/orders/schedules/${id}/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    resume: (id: string, token: string) =>
      apiFetch<ApiOrderSchedule>(`/orders/schedules/${id}/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    delete: (id: string, token: string) =>
      apiFetch<void>(`/orders/schedules/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
