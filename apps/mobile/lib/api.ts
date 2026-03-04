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

// Extends ApiTransportJob with a precomputed distance from the anchor coords
export interface ApiReturnTripJob extends ApiTransportJob {
  returnDistanceKm: number;
}

// ─── Materials ─────────────────────────────────────────────────────────────

export type MaterialCategory =
  | 'SAND'
  | 'GRAVEL'
  | 'STONE'
  | 'CONCRETE'
  | 'SOIL'
  | 'RECYCLED_CONCRETE'
  | 'RECYCLED_SOIL'
  | 'ASPHALT'
  | 'CLAY'
  | 'OTHER';

export type MaterialUnit = 'TONNE' | 'M3' | 'PIECE' | 'LOAD';

export interface ApiMaterial {
  id: string;
  name: string;
  description?: string | null;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  minOrder?: number | null;
  inStock: boolean;
  isRecycled: boolean;
  supplier: {
    id: string;
    name: string;
    city?: string | null;
  };
}

export interface CreateMaterialOrderInput {
  buyerId: string;
  materialId: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal?: string;
  deliveryDate: string;
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

  // Handle empty body (e.g. 204 No Content, or null returns from NestJS)
  const text = await res.text();
  return text.length > 0 ? (JSON.parse(text) as T) : (null as T);
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
    apiFetch<User>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }, token: string) =>
    apiFetch<User>('/auth/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
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

    /** Avoid Empty Runs — jobs near the given coords (delivery destination). */
    returnTrips: (lat: number, lng: number, radiusKm: number, token: string) =>
      apiFetch<ApiReturnTripJob[]>(
        `/transport-jobs/return-trips?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
  },

  materials: {
    getAll: (token: string, params?: Record<string, string>) => {
      const qs = params && Object.keys(params).length
        ? '?' + new URLSearchParams(params).toString()
        : '';
      // Use search endpoint when a 'search' param is provided
      const path = params?.search
        ? `/materials/search?q=${encodeURIComponent(params.search)}${params.category ? `&category=${params.category}` : ''}`
        : `/materials${qs}`;
      return apiFetch<ApiMaterial[]>(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },

    createOrder: (input: CreateMaterialOrderInput, token: string) =>
      apiFetch<ApiOrder>('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderType: 'MATERIAL',
          buyerId: input.buyerId,
          items: [{
            materialId: input.materialId,
            quantity: input.quantity,
            unit: input.unit,
            unitPrice: input.unitPrice,
          }],
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          deliveryPostal: input.deliveryPostal,
          deliveryDate: input.deliveryDate,
        }),
      }),
  },
};
