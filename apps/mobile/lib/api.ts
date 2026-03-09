const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export type UserType = 'BUYER' | 'SUPPLIER' | 'CARRIER' | 'ADMIN';

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
  carrierId?: string | null;
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
  siteContactName: string | null;
  siteContactPhone: string | null;
  buyer?: { id: string; firstName: string; lastName: string; phone?: string } | null;
  transportJobs?: {
    id: string;
    status: string;
    driver: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  }[];
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
  order: {
    id: string;
    orderNumber: string;
    siteContactName: string | null;
    siteContactPhone: string | null;
  } | null;
}

export interface JobLocation {
  id: string;
  status: string;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  estimatedArrival: string | null;
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

// ─── Supplier Offers & Quote Requests ─────────────────────────────────────

export interface SupplierOffer {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: MaterialUnit;
  basePrice: number;
  totalPrice: number;
  distanceKm: number | null;
  etaDays: number;
  isInstant: true;
  deliveryRadiusKm: number | null;
  supplier: {
    id: string;
    name: string;
    city: string | null;
    rating: number | null;
    phone: string | null;
  };
}

export type QuoteRequestStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
export type QuoteResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

/** Shape returned by GET /quote-requests/open (supplier view — no buyer address, only city) */
export interface OpenQuoteRequest {
  id: string;
  requestNumber: string;
  materialCategory: MaterialCategory;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryCity: string;
  notes: string | null;
  status: QuoteRequestStatus;
  createdAt: string;
  buyer: { firstName: string; lastName: string };
  /** Array of supplier IDs that already responded */
  responses: { supplierId: string }[];
}

export interface QuoteResponse {
  id: string;
  supplierId: string;
  pricePerUnit: number;
  totalPrice: number;
  unit: MaterialUnit;
  etaDays: number;
  notes: string | null;
  validUntil: string | null;
  status: QuoteResponseStatus;
  supplier: {
    id: string;
    name: string;
    city: string | null;
    rating: number | null;
  };
}

export interface QuoteRequest {
  id: string;
  requestNumber: string;
  materialCategory: MaterialCategory;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryAddress: string;
  deliveryCity: string;
  status: QuoteRequestStatus;
  responses: QuoteResponse[];
  createdAt: string;
}

// ─── Vehicles ──────────────────────────────────────────────────────────────

export type VehicleType = 'TRUCK' | 'SEMI_TRUCK' | 'TIPPER' | 'FLATBED' | 'VAN' | 'OTHER';

export interface ApiVehicle {
  id: string;
  licensePlate: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year?: number | null;
  payloadTonnes?: number | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Invoices ──────────────────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: string;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  order?: { id: string; orderNumber: string } | null;
}

// ─── Notifications ─────────────────────────────────────────────────────────

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
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
  siteContactName?: string;
  siteContactPhone?: string;
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let error: { message?: string } = { message: 'Request failed' };
    try {
      error = errText ? JSON.parse(errText) : error;
    } catch {
      /* keep default */
    }
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  // Handle empty body (e.g. 204 No Content, or null returns from NestJS)
  const text = await res.text();
  return text.length > 0 ? (JSON.parse(text) as T) : (null as T);
}

export const api = {
  register: (data: RegisterInput) =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginInput) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
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

  updatePushToken: (pushToken: string | null, token: string) =>
    apiFetch<{ ok: boolean }>('/auth/push-token', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pushToken }),
    }),

  orders: {
    stats: (token: string) =>
      apiFetch<Record<string, any>>('/orders/stats', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    myOrders: (token: string) =>
      apiFetch<ApiOrder[]>('/orders', {
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
  },

  skipHire: {
    create: (data: CreateSkipHireInput, token?: string) =>
      apiFetch<SkipHireOrder>('/skip-hire', {
        method: 'POST',
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        body: JSON.stringify(data),
      }),

    myOrders: (token: string) =>
      apiFetch<SkipHireOrder[]>('/skip-hire/my', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Carrier: list all CONFIRMED + DELIVERED skips for this carrier company. */
    carrierOrders: (token: string) =>
      apiFetch<SkipHireOrder[]>('/skip-hire/carrier-map', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Carrier: advance a skip order status (CONFIRMED→DELIVERED or DELIVERED→COLLECTED). */
    updateCarrierStatus: (id: string, status: SkipHireStatus, token: string) =>
      apiFetch<SkipHireOrder>(`/skip-hire/${id}/carrier-status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      }),
  },

  transportJobs: {
    available: (token: string) =>
      apiFetch<ApiTransportJob[]>('/transport-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myActive: (token: string) =>
      apiFetch<ApiTransportJob | null>('/transport-jobs/my-active', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myJobs: (token: string) =>
      apiFetch<ApiTransportJob[]>('/transport-jobs/my-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    accept: (id: string, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    updateStatus: (id: string, status: TransportJobStatus, token: string, weightKg?: number) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, ...(weightKg != null ? { weightKg } : {}) }),
      }),

    /** Submit delivery proof — transitions job AT_DELIVERY → DELIVERED. */
    deliveryProof: (
      id: string,
      dto: { recipientName?: string; notes?: string; photos?: string[] },
      token: string,
    ) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/delivery-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    /** Avoid Empty Runs — jobs near the given coords (delivery destination). */
    returnTrips: (lat: number, lng: number, radiusKm: number, token: string) =>
      apiFetch<ApiReturnTripJob[]>(
        `/transport-jobs/return-trips?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),

    /** Driver pushes current GPS position — fire-and-forget. */
    updateLocation: (id: string, lat: number, lng: number, token: string) =>
      apiFetch<{ lat: number; lng: number; updatedAt: string }>(
        `/transport-jobs/${id}/location`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat, lng }),
        },
      ),

    /** Buyer polls this to get live driver position. */
    getLocation: (id: string, token: string) =>
      apiFetch<JobLocation>(`/transport-jobs/${id}/location`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  materials: {
    getAll: (token: string, params?: Record<string, string>) => {
      const qs =
        params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
      // Use search endpoint when a 'search' param is provided
      const path = params?.search
        ? `/materials/search?q=${encodeURIComponent(params.search)}${params.category ? `&category=${params.category}` : ''}`
        : `/materials${qs}`;
      return apiFetch<ApiMaterial[]>(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },

    getOne: (id: string, token: string) =>
      apiFetch<ApiMaterial>(`/materials/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (data: Partial<ApiMaterial> & { basePrice: number; name: string }, token: string) =>
      apiFetch<ApiMaterial>('/materials', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<ApiMaterial>, token: string) =>
      apiFetch<ApiMaterial>(`/materials/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    remove: (id: string, token: string) =>
      apiFetch<void>(`/materials/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),

    createOrder: (input: CreateMaterialOrderInput, token: string) =>
      apiFetch<ApiOrder>('/orders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderType: 'MATERIAL',
          buyerId: input.buyerId,
          items: [
            {
              materialId: input.materialId,
              quantity: input.quantity,
              unit: input.unit,
              unitPrice: input.unitPrice,
            },
          ],
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          deliveryPostal: input.deliveryPostal,
          deliveryDate: input.deliveryDate,
          siteContactName: input.siteContactName,
          siteContactPhone: input.siteContactPhone,
        }),
      }),

    getOffers: (
      params: { category: MaterialCategory; quantity: number; lat?: number; lng?: number },
      token: string,
    ) => {
      const qs = new URLSearchParams({
        category: params.category,
        quantity: String(params.quantity),
        ...(params.lat != null ? { lat: String(params.lat), lng: String(params.lng) } : {}),
      }).toString();
      return apiFetch<SupplierOffer[]>(`/materials/offers?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  },

  quoteRequests: {
    create: (
      dto: {
        materialCategory: MaterialCategory;
        materialName: string;
        quantity: number;
        unit: MaterialUnit;
        deliveryAddress: string;
        deliveryCity: string;
        deliveryLat?: number;
        deliveryLng?: number;
        notes?: string;
      },
      token: string,
    ) =>
      apiFetch<QuoteRequest>('/quote-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    get: (id: string, token: string) =>
      apiFetch<QuoteRequest>(`/quote-requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    list: (token: string) =>
      apiFetch<QuoteRequest[]>('/quote-requests', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    accept: (id: string, responseId: string, token: string) =>
      apiFetch<ApiOrder>(`/quote-requests/${id}/accept/${responseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Supplier: list all open requests they can respond to. */
    openRequests: (token: string) =>
      apiFetch<OpenQuoteRequest[]>('/quote-requests/open', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Supplier: submit a price proposal for a quote request. */
    respond: (
      id: string,
      dto: {
        pricePerUnit: number;
        unit: MaterialUnit;
        etaDays: number;
        notes?: string;
        validUntil?: string;
      },
      token: string,
    ) =>
      apiFetch<QuoteResponse>(`/quote-requests/${id}/respond`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),
  },

  vehicles: {
    getAll: (token: string) =>
      apiFetch<ApiVehicle[]>('/vehicles', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getOne: (id: string, token: string) =>
      apiFetch<ApiVehicle>(`/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (data: Omit<ApiVehicle, 'id' | 'createdAt'>, token: string) =>
      apiFetch<ApiVehicle>('/vehicles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Omit<ApiVehicle, 'id' | 'createdAt'>>, token: string) =>
      apiFetch<ApiVehicle>(`/vehicles/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    remove: (id: string, token: string) =>
      apiFetch<void>(`/vehicles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  invoices: {
    getAll: (token: string) =>
      apiFetch<ApiInvoice[]>('/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getByOrder: (orderId: string, token: string) =>
      apiFetch<ApiInvoice[]>(`/invoices/order/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getOne: (id: string, token: string) =>
      apiFetch<ApiInvoice>(`/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    markAsPaid: (id: string, token: string) =>
      apiFetch<ApiInvoice>(`/invoices/${id}/pay`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  notifications: {
    getAll: (token: string) =>
      apiFetch<ApiNotification[]>('/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    unreadCount: (token: string) =>
      apiFetch<{ count: number }>('/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    markAllRead: (token: string) =>
      apiFetch<void>('/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    markRead: (id: string, token: string) =>
      apiFetch<void>(`/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  reviews: {
    /** Buyer: submit a rating for a completed order. */
    create: (
      dto: {
        rating: number;
        comment?: string;
        orderId?: string;
        skipOrderId?: string;
      },
      token: string,
    ) =>
      apiFetch<{ id: string }>('/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    /** Check whether the user already reviewed an order. */
    status: (params: { orderId?: string; skipOrderId?: string }, token: string) => {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null) as [string, string][],
        ),
      ).toString();
      return apiFetch<{ reviewed: boolean }>(`/reviews/status?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },

    /** Get all reviews for a company (public). */
    byCompany: (companyId: string, token: string) =>
      apiFetch<{ id: string; rating: number; comment?: string; createdAt: string }[]>(
        `/reviews/company/${companyId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
  },
};
