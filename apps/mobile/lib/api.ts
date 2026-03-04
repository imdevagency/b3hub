const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export type UserType = "BUYER" | "SUPPLIER" | "CARRIER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  isCompany: boolean;
  canSell: boolean;
  canTransport: boolean;
  status: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  company?: {
    id: string;
    name: string;
    companyType: string;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  isCompany?: boolean;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ─── Skip Hire ─────────────────────────────────────────────────────────────

export type SkipWasteCategory =
  | 'MIXED'
  | 'GREEN_GARDEN'
  | 'CONCRETE_RUBBLE'
  | 'WOOD'
  | 'METAL_SCRAP'
  | 'ELECTRONICS_WEEE';

export type SkipSize = 'MINI' | 'MIDI' | 'BUILDERS' | 'LARGE';

export type SkipHireStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERED'
  | 'COLLECTED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface SkipHireOrder {
  id: string;
  orderNumber: string;
  location: string;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  price: number;
  currency: string;
  status: SkipHireStatus;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkipHireInput {
  location: string;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

// ─── Transport Jobs ────────────────────────────────────────────────────────

export type TransportJobStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'AT_PICKUP'
  | 'LOADED'
  | 'EN_ROUTE_DELIVERY'
  | 'AT_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface ApiOrder {
  id: string;
  orderNumber: string;
  status: string;
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
  total: number;
  currency: string;
  buyer?: { id: string; firstName: string; lastName: string; phone?: string } | null;
  createdAt: string;
}

export interface ApiTransportJob {
  id: string;
  jobNumber: string;
  jobType: string;
  requiredVehicleType: string | null;
  cargoType: string;
  cargoWeight: number | null;
  pickupAddress: string;
  pickupCity: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupDate: string;
  pickupWindow: string | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryDate: string;
  deliveryWindow: string | null;
  distanceKm: number | null;
  rate: number;
  pricePerTonne: number | null;
  currency: string;
  status: TransportJobStatus;
  driverId: string | null;
  driver: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  vehicle: { id: string; licensePlate: string; vehicleType: string } | null;
  order: { id: string; orderNumber: string } | null;
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  register: (data: RegisterInput) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMe: (token: string) =>
    apiFetch<User>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }),

  orders: {
    stats: (token: string) =>
      apiFetch<Record<string, any>>("/orders/stats", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    myOrders: (token: string) =>
      apiFetch<ApiOrder[]>("/orders", {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  skipHire: {
    create: (data: CreateSkipHireInput, token?: string) =>
      apiFetch<SkipHireOrder>("/skip-hire", {
        method: "POST",
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify(data),
      }),

    myOrders: (token: string) =>
      apiFetch<SkipHireOrder[]>("/skip-hire/my", {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  transportJobs: {
    available: (token: string) =>
      apiFetch<ApiTransportJob[]>("/transport-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myActive: (token: string) =>
      apiFetch<ApiTransportJob | null>("/transport-jobs/my-active", {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myJobs: (token: string) =>
      apiFetch<ApiTransportJob[]>("/transport-jobs/my-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      }),

    accept: (id: string, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),

    updateStatus: (id: string, status: TransportJobStatus, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      }),
  },
};
