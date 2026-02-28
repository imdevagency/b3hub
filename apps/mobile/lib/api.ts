const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export type UserType = "BUYER" | "SUPPLIER" | "CARRIER" | "DRIVER" | "RECYCLER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
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
};
