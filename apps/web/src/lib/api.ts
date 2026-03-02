const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

// ── Document Management ───────────────────────────────────────

export type DocumentType =
  | "INVOICE"
  | "WEIGHING_SLIP"
  | "DELIVERY_PROOF"
  | "WASTE_CERTIFICATE"
  | "DELIVERY_NOTE"
  | "CONTRACT"
  | "OTHER";

export type DocumentStatus = "DRAFT" | "ISSUED" | "SIGNED" | "ARCHIVED";

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  orderId?: string;
  invoiceId?: string;
  transportJobId?: string;
  wasteRecordId?: string;
  skipHireId?: string;
  ownerId: string;
  issuedBy?: string;
  isGenerated: boolean;
  notes?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  total: number;
  byType: Partial<Record<DocumentType, number>>;
}

export async function getMyDocuments(
  token: string,
  params?: {
    type?: DocumentType;
    status?: DocumentStatus;
    orderId?: string;
    search?: string;
  }
): Promise<{ documents: Document[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.status) qs.set("status", params.status);
  if (params?.orderId) qs.set("orderId", params.orderId);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch(`/documents${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getDocumentSummary(token: string): Promise<DocumentSummary> {
  return apiFetch("/documents/summary", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Users ─────────────────────────────────────────────────────

export type UserType = "BUYER" | "SUPPLIER" | "CARRIER" | "PRIVATE" | "ADMIN";

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
    logo?: string;
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
  companyId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
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

export async function registerUser(data: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function loginUser(data: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMe(token: string): Promise<User> {
  return apiFetch<User>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Skip Hire ──────────────────────────────────────────────────

export type SkipWasteCategory =
  | "MIXED"
  | "GREEN_GARDEN"
  | "CONCRETE_RUBBLE"
  | "WOOD"
  | "METAL_SCRAP"
  | "ELECTRONICS_WEEE";

export type SkipSize = "MINI" | "MIDI" | "BUILDERS" | "LARGE";

export type SkipHireStatus =
  | "PENDING"
  | "CONFIRMED"
  | "DELIVERED"
  | "COLLECTED"
  | "COMPLETED"
  | "CANCELLED";

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
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkipHireInput {
  location: string;
  wasteCategory: SkipWasteCategory;
  skipSize: SkipSize;
  deliveryDate: string; // ISO date string
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

// Frontend → backend waste category mapping
const WASTE_CATEGORY_MAP: Record<string, SkipWasteCategory> = {
  mixed:       "MIXED",
  green:       "GREEN_GARDEN",
  rubble:      "CONCRETE_RUBBLE",
  wood:        "WOOD",
  metal:       "METAL_SCRAP",
  electronics: "ELECTRONICS_WEEE",
};

// Frontend → backend skip size mapping
const SKIP_SIZE_MAP: Record<string, SkipSize> = {
  mini:     "MINI",
  midi:     "MIDI",
  builders: "BUILDERS",
  large:    "LARGE",
};

export function mapWasteCategory(frontendId: string): SkipWasteCategory {
  return WASTE_CATEGORY_MAP[frontendId] ?? "MIXED";
}

export function mapSkipSize(frontendId: string): SkipSize {
  return SKIP_SIZE_MAP[frontendId] ?? "MIDI";
}

export async function createSkipHireOrder(
  data: CreateSkipHireInput,
  token?: string
): Promise<SkipHireOrder> {
  return apiFetch<SkipHireOrder>("/skip-hire", {
    method: "POST",
    body: JSON.stringify(data),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function getMySkipHireOrders(token: string): Promise<SkipHireOrder[]> {
  return apiFetch<SkipHireOrder[]>("/skip-hire/my", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
