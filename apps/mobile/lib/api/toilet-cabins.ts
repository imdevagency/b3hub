import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────
export type ToiletCabinType = 'STANDARD' | 'DISABLED_ACCESS' | 'VIP' | 'HEATED';
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
  cabinType: ToiletCabinType;
  cabinCount: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: string | null;
  price: number;
  currency: string;
  status: ToiletCabinStatus;
  carrierId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  userId?: string | null;
  notes?: string | null;
  paymentMethod?: 'CARD' | 'INVOICE';
  paymentStatus?: string;
  paymentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToiletCabinQuote {
  carrierId: string;
  carrierName: string;
  carrierLogo: string | null;
  cabinType: ToiletCabinType;
  pricePerCabinPerDay: number;
  totalPrice: number;
  currency: string;
  maxCabins: number;
}

export interface CarrierToiletCabinSettings {
  id: string;
  carrierId: string;
  cabinType: ToiletCabinType;
  pricePerCabinPerDay: number;
  maxCabins: number;
  serviceCities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToiletCabinInput {
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  cabinType?: ToiletCabinType;
  cabinCount: number;
  hireDays: number;
  deliveryDate: string;
  deliveryWindow?: 'AM' | 'PM' | 'ANY';
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  carrierId?: string;
  paymentMethod?: 'CARD' | 'INVOICE';
}

export interface SetToiletCabinSettingsInput {
  cabinType: ToiletCabinType;
  pricePerCabinPerDay: number;
  maxCabins: number;
  serviceCities: string[];
  isActive: boolean;
}

// ─── API methods ────────────────────────────────────────────────────────────

export const toiletCabinsApi = {
  // ── Buyer ────────────────────────────────────────────────────────────────

  /** Get quotes from carriers for a given city + cabin count + hire period + type */
  getQuotes: (city: string, cabins: number, hireDays: number, cabinType?: ToiletCabinType) =>
    apiFetch<ToiletCabinQuote[]>(
      `/toilet-cabins/quotes?city=${encodeURIComponent(city)}&cabins=${cabins}&hireDays=${hireDays}${cabinType ? `&cabinType=${cabinType}` : ''}`,
    ),

  createToiletCabinOrder: (data: CreateToiletCabinInput, token?: string) =>
    apiFetch<ToiletCabinOrder & { paymentUrl: string | null }>('/toilet-cabins', {
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

  // ── Carrier ──────────────────────────────────────────────────────────────

  /** List orders assigned to this carrier */
  getCarrierToiletCabins: (token: string, status?: ToiletCabinStatus) =>
    apiFetch<ToiletCabinOrder[]>(
      `/toilet-cabins/carrier/orders${status ? `?status=${status}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ),

  /** Advance delivery lifecycle: CONFIRMED → DELIVERED → IN_USE → COLLECTED */
  updateToiletCabinCarrierStatus: (id: string, status: ToiletCabinStatus, token: string) =>
    apiFetch<ToiletCabinOrder>(`/toilet-cabins/${id}/carrier-status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }),

  /** Get carrier's own pricing & service city settings (array, one entry per cabin type) */
  getCarrierToiletCabinSettings: (token: string) =>
    apiFetch<CarrierToiletCabinSettings[]>('/toilet-cabins/carrier/settings', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  /** Create or update carrier's pricing & service city settings */
  setCarrierToiletCabinSettings: (data: SetToiletCabinSettingsInput, token: string) =>
    apiFetch<CarrierToiletCabinSettings>('/toilet-cabins/carrier/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }),
};
