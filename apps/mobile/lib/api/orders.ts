import { apiFetch } from './common';
import type {
  WasteType,
  DisposalTruckType,
  TransportVehicleType,
} from '@b3hub/shared';

export type { WasteType, DisposalTruckType, TransportVehicleType };

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
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}
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
  /** Displayed price shown to buyer (fromPrice × truckCount) */
  quotedRate?: number;
  /** Optional project tag for P&L roll-up */
  projectId?: string;
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
  /** Platform-calculated estimated rate (EUR, excl. VAT). Required by backend DTO. */
  quotedRate: number;
  /** Buyer's suggested budget shown to drivers (optional) */
  buyerOfferedRate?: number;
  /** Optional project tag for P&L roll-up */
  projectId?: string;
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
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryDate: string;
  deliveryWindow?: string;
  deliveryFee?: number;
  siteContactName?: string;
  siteContactPhone?: string;
  sitePhotoUrl?: string;
  notes?: string;
  projectId?: string;
  /** Number of trucks to dispatch (each becomes a separate transport job). */
  truckCount?: number;
  /** Minutes between consecutive trucks when truckCount > 1. */
  truckIntervalMinutes?: number;
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
  projectId?: string;
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
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
  paymentMethod?: string; // 'CARD' | 'INVOICE'
  invoiceDueDate?: string | null;
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
  buyer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
  createdBy?: { id: string } | null;
  transportJobs?: {
    id: string;
    status: string;
    rate: number | null;
    pricePerTonne: number | null;
    distanceKm: number | null;
    cargoWeight: number | null;
    actualWeightKg: number | null;
    pickupPhotoUrl: string | null;
    driver: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      avatar: string | null;
      driverProfile?: { rating: number | null; completedJobs: number } | null;
    } | null;
    vehicle: { id: string; licensePlate: string; vehicleType: string } | null;
    deliveryProof?: {
      id: string;
      photos: string[];
      recipientName: string | null;
      notes: string | null;
      createdAt: string;
    } | null;
    exceptions?: {
      id: string;
      type: string;
      status: string;
      notes?: string | null;
      createdAt: string;
    }[];
  }[];
  surcharges?: {
    id: string;
    type: string;
    label: string;
    amount: number;
    billable: boolean;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
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
  project?: { id: string; name: string } | null;
  notes?: string | null;
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  sitePhotoUrl?: string | null;
  truckCount?: number | null;
  scheduleIntervalMinutes?: number | null;
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

    update: (
      id: string,
      body: {
        deliveryDate?: string;
        deliveryWindow?: string;
        deliveryAddress?: string;
        deliveryCity?: string;
      },
      token: string,
    ) =>
      apiFetch<ApiOrder>(`/orders/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

    confirmReceipt: (id: string, token: string) =>
      apiFetch<ApiOrder>(`/orders/${id}/confirm-receipt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    sellerCancel: (id: string, reason: string, token: string) =>
      apiFetch<ApiOrder>(`/orders/${id}/seller-cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),

    startLoading: (id: string, token: string, weightKg?: number) =>
      apiFetch<ApiOrder>(`/orders/${id}/start-loading`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightKg }),
      }),

    linkSkipOrder: (orderId: string, skipHireOrderId: string | null, token: string) =>
      apiFetch<ApiOrder>(`/orders/${orderId}/link-skip`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipHireOrderId }),
      }),

    addSurcharge: (
      orderId: string,
      dto: { type: SurchargeType; label: string; amount: number; billable?: boolean },
      token: string,
    ) =>
      apiFetch<ApiOrderSurcharge>(`/orders/${orderId}/surcharges`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      }),

    removeSurcharge: (orderId: string, surchargeId: string, token: string) =>
      apiFetch<void>(`/orders/${orderId}/surcharges/${surchargeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),

    uploadSitePhoto: (base64: string, mimeType: string, token: string) =>
      apiFetch<{ url: string }>('/orders/upload-site-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
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
