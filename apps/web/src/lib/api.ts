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
  isCompany?: boolean;
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

export async function updateProfile(
  data: { firstName?: string; lastName?: string; phone?: string },
  token: string,
): Promise<User> {
  return apiFetch<User>('/auth/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface DashboardStats {
  // BUYER (company + personal)
  activeOrders?: number;
  awaitingDelivery?: number;
  myOrders?: number;      // skip hire orders count
  documents?: number;
  // SUPPLIER
  activeListings?: number;
  pendingOrders?: number;
  monthlyRevenue?: number;
  // CARRIER
  activeJobs?: number;
  completedToday?: number;
  awaitingPayment?: number;
  vehicleCount?: number;
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/orders/stats", {
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

// ── Vehicles (Virtual Garage) ──────────────────────────────────

export type VehicleType =
  | "DUMP_TRUCK"
  | "FLATBED_TRUCK"
  | "SEMI_TRAILER"
  | "HOOK_LIFT"
  | "SKIP_LOADER"
  | "TANKER"
  | "VAN";

export type VehicleStatus = "ACTIVE" | "IN_USE" | "MAINTENANCE" | "INACTIVE";

export interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  imageUrl?: string;
  capacity: number;       // load weight in tonnes
  maxGrossWeight?: number; // total permitted weight in tonnes
  volumeCapacity?: number; // m³
  driveType?: string;
  status: VehicleStatus;
  ownerId?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  imageUrl?: string;
  capacity: number;
  maxGrossWeight?: number;
  volumeCapacity?: number;
  driveType?: string;
  status?: VehicleStatus;
}

export async function getMyVehicles(token: string): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>("/vehicles", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createVehicle(
  data: CreateVehicleInput,
  token: string
): Promise<Vehicle> {
  return apiFetch<Vehicle>("/vehicles", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateVehicle(
  id: string,
  data: Partial<CreateVehicleInput>,
  token: string
): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/vehicles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteVehicle(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/vehicles/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Transport Jobs ─────────────────────────────────────────────

export type TransportJobStatus =
  | "AVAILABLE" | "ASSIGNED" | "ACCEPTED" | "EN_ROUTE_PICKUP"
  | "AT_PICKUP" | "LOADED" | "EN_ROUTE_DELIVERY" | "AT_DELIVERY"
  | "DELIVERED" | "CANCELLED";

export interface ApiTransportJob {
  id: string;
  jobNumber: string;
  jobType: string;
  requiredVehicleType: string | null;
  requiredVehicleEnum: string | null;
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

export async function getAvailableTransportJobs(token: string): Promise<ApiTransportJob[]> {
  return apiFetch<ApiTransportJob[]>("/transport-jobs", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAllTransportJobs(token: string): Promise<ApiTransportJob[]> {
  return apiFetch<ApiTransportJob[]>("/transport-jobs/fleet", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function acceptTransportJob(id: string, token: string): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyTransportJobs(token: string): Promise<ApiTransportJob[]> {
  return apiFetch<ApiTransportJob[]>("/transport-jobs/my-jobs", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyActiveTransportJob(token: string): Promise<ApiTransportJob | null> {
  const result = await apiFetch<ApiTransportJob | null>("/transport-jobs/my-active", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return result ?? null;
}

export async function updateTransportJobStatus(
  id: string,
  status: string,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export interface ApiDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export async function getTransportDrivers(token: string): Promise<ApiDriver[]> {
  return apiFetch<ApiDriver[]>("/transport-jobs/drivers", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function assignTransportJob(
  id: string,
  body: { driverId: string; vehicleId: string },
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/assign`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Materials ──────────────────────────────────────────────────

export type MaterialCategory =
  | "SAND" | "GRAVEL" | "STONE" | "CONCRETE" | "SOIL"
  | "RECYCLED_CONCRETE" | "RECYCLED_SOIL" | "ASPHALT" | "CLAY" | "OTHER";

export type MaterialUnit = "TONNE" | "M3" | "PIECE" | "LOAD";

export interface ApiMaterial {
  id: string;
  name: string;
  description?: string;
  category: MaterialCategory;
  subCategory?: string;
  basePrice: number;
  unit: MaterialUnit;
  currency: string;
  inStock: boolean;
  minOrder?: number;
  maxOrder?: number;
  isRecycled: boolean;
  quality?: string;
  images: string[];
  supplierId: string;
  supplier: {
    id: string;
    name: string;
    logo?: string;
    rating?: number;
    city?: string;
  };
  createdAt: string;
}

export interface CreateMaterialOrderInput {
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
}

export async function getMaterials(
  token: string,
  filters?: { category?: MaterialCategory; search?: string },
): Promise<ApiMaterial[]> {
  const qs = new URLSearchParams();
  if (filters?.category) qs.set("category", filters.category);
  const query = qs.toString() ? `?${qs}` : "";
  if (filters?.search) {
    return apiFetch<ApiMaterial[]>(`/materials/search?q=${encodeURIComponent(filters.search)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  return apiFetch<ApiMaterial[]>(`/materials${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createMaterialOrder(
  input: CreateMaterialOrderInput,
  token: string,
): Promise<ApiOrder> {
  return apiFetch<ApiOrder>("/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      orderType: "MATERIAL",
      buyerId: input.buyerId,
      deliveryAddress: input.deliveryAddress,
      deliveryCity: input.deliveryCity,
      deliveryState: "",
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

// ── Orders ─────────────────────────────────────────────────────

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
  buyer?: { id: string; firstName: string; lastName: string; phone?: string } | null;
  createdAt: string;
}

export async function getMyOrders(token: string, status?: string): Promise<ApiOrder[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<ApiOrder[]>(`/orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function confirmOrder(id: string, token: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function cancelOrder(id: string, token: string): Promise<ApiOrder> {
  return apiFetch<ApiOrder>(`/orders/${id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Transport Jobs ──────────────────────────────────────────────

export type TransportJobType =
  | "MATERIAL_DELIVERY"
  | "CONTAINER_DELIVERY"
  | "CONTAINER_PICKUP"
  | "WASTE_COLLECTION"
  | "EQUIPMENT_TRANSPORT";

export type VehicleTypeEnum =
  | "DUMP_TRUCK"
  | "FLATBED_TRUCK"
  | "SEMI_TRAILER"
  | "HOOK_LIFT"
  | "SKIP_LOADER"
  | "TANKER"
  | "VAN";

export interface CreateTransportJobInput {
  jobType: TransportJobType;
  // Pickup
  pickupAddress: string;
  pickupCity: string;
  pickupState?: string;
  pickupPostal?: string;
  pickupDate: string;          // ISO date string
  pickupWindow?: string;
  // Delivery
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState?: string;
  deliveryPostal?: string;
  deliveryDate: string;        // ISO date string
  deliveryWindow?: string;
  // Cargo
  cargoType: string;
  cargoWeight?: number;
  cargoVolume?: number;
  specialRequirements?: string;
  // Vehicle
  requiredVehicleType?: string;
  requiredVehicleEnum?: VehicleTypeEnum;
  // Pricing
  rate: number;
  pricePerTonne?: number;
  distanceKm?: number;
  orderId?: string;
}

export interface ApiTransportJob {
  id: string;
  jobNumber: string;
  jobType: string;
  cargoType: string;
  cargoWeight?: number;
  pickupAddress: string;
  pickupCity: string;
  pickupDate: string;
  pickupWindow?: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string;
  deliveryWindow?: string;
  distanceKm?: number;
  rate: number;
  pricePerTonne?: number;
  currency: string;
  status: string;
  requiredVehicleType?: string;
  requiredVehicleEnum?: string;
  driverId?: string;
  driver?: { id: string; firstName: string; lastName: string; phone?: string };
  vehicle?: { id: string; licensePlate: string; vehicleType: string };
  order?: { id: string; orderNumber: string };
}

// ── Provider Applications ──────────────────────────────────────

export interface ProviderApplication {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  regNumber?: string;
  taxId?: string;
  website?: string;
  appliesForSell: boolean;
  appliesForTransport: boolean;
  description?: string;
  userId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
}

export async function getProviderApplications(
  token: string,
  status?: string,
): Promise<ProviderApplication[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<ProviderApplication[]>(`/provider-applications${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function approveProviderApplication(
  id: string,
  token: string,
  reviewNote?: string,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>(`/provider-applications/${id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function rejectProviderApplication(
  id: string,
  token: string,
  reviewNote?: string,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>(`/provider-applications/${id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function createTransportJob(
  input: CreateTransportJobInput,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>("/transport-jobs", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
