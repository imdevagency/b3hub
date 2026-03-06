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
export type Mode = 'BUYER' | 'SUPPLIER' | 'CARRIER';

export type CompanyRole = 'OWNER' | 'MANAGER' | 'DRIVER' | 'MEMBER';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: UserType;
  isCompany: boolean;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  status: string;
  phone?: string;
  avatar?: string;
  emailVerified: boolean;
  companyRole?: CompanyRole;
  availableModes: Mode[];
  company?: {
    id: string;
    name: string;
    companyType: string;
    logo?: string;
  };
}

// ── Company & Team Management ─────────────────────────────────

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  registrationNum?: string;
  taxId?: string;
  companyType: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  logo?: string;
  verified: boolean;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatar?: string;
  companyRole?: CompanyRole;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface InviteMemberInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyRole: CompanyRole;
  canTransport?: boolean;
  canSell?: boolean;
  canSkipHire?: boolean;
}

export interface UpdateMemberInput {
  companyRole?: CompanyRole;
  canTransport?: boolean;
  canSell?: boolean;
  canSkipHire?: boolean;
}

export async function getMyCompany(token: string): Promise<Company> {
  return apiFetch<Company>('/company/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateMyCompany(
  data: Partial<{
    name: string; legalName: string; email: string; phone: string; website: string;
    description: string; street: string; city: string; state: string; postalCode: string; logo: string;
  }>,
  token: string,
): Promise<Company> {
  return apiFetch<Company>('/company/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function getCompanyMembers(token: string): Promise<CompanyMember[]> {
  return apiFetch<CompanyMember[]>('/company/me/members', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function inviteCompanyMember(
  data: InviteMemberInput,
  token: string,
): Promise<{ user: CompanyMember; tempPassword: string }> {
  return apiFetch<{ user: CompanyMember; tempPassword: string }>('/company/me/members', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateCompanyMember(
  memberId: string,
  data: UpdateMemberInput,
  token: string,
): Promise<CompanyMember> {
  return apiFetch<CompanyMember>(`/company/me/members/${memberId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function removeCompanyMember(memberId: string, token: string): Promise<void> {
  await apiFetch<void>(`/company/me/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
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
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let error: { message?: string } = { message: "Request failed" };
    try { error = text ? JSON.parse(text) : error; } catch { /* keep default */ }
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
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
  carrierId?: string;   // selected from quotes
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

// ── Skip hire quotes (carrier comparison) ─────────────────────

export interface SkipHireQuote {
  carrierId: string;
  carrierName: string;
  carrierLogo: string | null;
  carrierRating: number | null;
  price: number;
  currency: string;
}

export async function getSkipHireQuotes(
  size: SkipSize,
  location: string,
  date: string,
): Promise<SkipHireQuote[]> {
  const params = new URLSearchParams({ size, location, date });
  return apiFetch<SkipHireQuote[]>(`/skip-hire/quotes?${params}`);
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
  rate: number | null;
  pricePerTonne: number | null;
  currency: string;
  status: TransportJobStatus;
  driverId: string | null;
  driver: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  vehicle: { id: string; licensePlate: string; vehicleType: string } | null;
  order: { id: string; orderNumber: string; siteContactName: string | null; siteContactPhone: string | null } | null;
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

export async function getTransportJob(id: string, token: string): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface TransportJobLocation {
  id: string;
  status: TransportJobStatus;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string;
  estimatedArrival: string | null;
}

export async function getTransportJobLocation(
  id: string,
  token: string,
): Promise<TransportJobLocation> {
  return apiFetch<TransportJobLocation>(`/transport-jobs/${id}/location`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateTransportJobLocation(
  id: string,
  dto: { lat: number; lng: number },
  token: string,
): Promise<{ lat: number; lng: number; updatedAt: string }> {
  return apiFetch<{ lat: number; lng: number; updatedAt: string }>(
    `/transport-jobs/${id}/location`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(dto),
    },
  );
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

export async function getMaterialCategories(token: string): Promise<MaterialCategory[]> {
  return apiFetch<MaterialCategory[]>('/materials/categories', {
    headers: { Authorization: `Bearer ${token}` },
  });
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

export async function getMyMaterials(token: string, supplierId: string): Promise<ApiMaterial[]> {
  return apiFetch<ApiMaterial[]>(`/materials?supplierId=${supplierId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface CreateMaterialInput {
  name: string;
  description?: string;
  category: MaterialCategory;
  subCategory?: string;
  basePrice: number;
  unit: MaterialUnit;
  inStock?: boolean;
  minOrder?: number;
  maxOrder?: number;
  isRecycled?: boolean;
  quality?: string;
  supplierId: string;
}

export async function createMaterial(
  input: CreateMaterialInput,
  token: string,
): Promise<ApiMaterial> {
  return apiFetch<ApiMaterial>('/materials', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export interface UpdateMaterialInput {
  name?: string;
  description?: string;
  category?: MaterialCategory;
  subCategory?: string;
  basePrice?: number;
  unit?: MaterialUnit;
  inStock?: boolean;
  minOrder?: number;
  maxOrder?: number;
  isRecycled?: boolean;
  quality?: string;
}

export async function updateMaterial(
  id: string,
  input: UpdateMaterialInput,
  token: string,
): Promise<ApiMaterial> {
  return apiFetch<ApiMaterial>(`/materials/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteMaterial(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/materials/${id}`, {
    method: 'DELETE',
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
  siteContactName?: string | null;
  siteContactPhone?: string | null;
  buyer?: { id: string; firstName: string; lastName: string; phone?: string } | null;
  transportJobs?: {
    id: string;
    status: string;
    driver: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  }[];
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

// ── Cart / Multi-item order ────────────────────────────────────────────────────

export interface CartOrderItem {
  materialId: string;
  quantity: number;
  unit: MaterialUnit;
  unitPrice: number;
}

export interface CreateCartOrderInput {
  buyerId: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostal: string;
  deliveryDate?: string;
  notes?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  items: CartOrderItem[];
}

export async function createCartOrder(
  input: CreateCartOrderInput,
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
      siteContactName: input.siteContactName,
      siteContactPhone: input.siteContactPhone,
      items: input.items,
    }),
  });
}

// ── Invoices ───────────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  paymentStatus: PaymentStatus;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    orderType: string;
    status: string;
  };
}

export interface InvoiceListResponse {
  data: ApiInvoice[];
  meta: { page: number; limit: number; total: number };
}

export async function getMyInvoices(
  token: string,
  page = 1,
): Promise<InvoiceListResponse> {
  return apiFetch<InvoiceListResponse>(`/invoices?page=${page}&limit=20`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getInvoiceById(id: string, token: string): Promise<ApiInvoice> {
  return apiFetch<ApiInvoice>(`/invoices/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getInvoicesByOrder(
  orderId: string,
  token: string,
): Promise<ApiInvoice[]> {
  return apiFetch<ApiInvoice[]>(`/invoices/order/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markInvoicePaid(id: string, token: string): Promise<ApiInvoice> {
  return apiFetch<ApiInvoice>(`/invoices/${id}/pay`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Driver Schedule & Availability ────────────────────────────

export interface DriverScheduleDay {
  id?: string;
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  enabled: boolean;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface DriverDateBlock {
  id: string;
  blockedDate: string;
  reason?: string | null;
  createdAt: string;
}

export interface DriverAvailability {
  id: string;
  isOnline: boolean;
  autoSchedule: boolean;
  maxJobsPerDay: number | null;
  available: boolean;
  effectiveOnline: boolean;
  weeklySchedule: DriverScheduleDay[];
  dateBlocks: DriverDateBlock[];
}

export async function getDriverAvailability(token: string): Promise<DriverAvailability> {
  return apiFetch<DriverAvailability>('/driver-schedule', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function toggleDriverOnline(
  isOnline: boolean,
  token: string,
): Promise<{ isOnline: boolean }> {
  return apiFetch<{ isOnline: boolean }>('/driver-schedule/online', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isOnline }),
  });
}

export interface UpdateDriverScheduleInput {
  days: DriverScheduleDay[];
  autoSchedule?: boolean;
  maxJobsPerDay?: number | null;
}

export async function updateDriverSchedule(
  data: UpdateDriverScheduleInput,
  token: string,
): Promise<DriverAvailability> {
  return apiFetch<DriverAvailability>('/driver-schedule', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function blockDriverDate(
  date: string,
  reason: string | undefined,
  token: string,
): Promise<DriverDateBlock> {
  return apiFetch<DriverDateBlock>('/driver-schedule/blocks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date, reason }),
  });
}

export async function unblockDriverDate(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/driver-schedule/blocks/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Provider Applications ─────────────────────────────────────────────────────

export interface ProviderApplicationInput {
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
}

export type ProviderApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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
  status: ProviderApplicationStatus;
  reviewNote?: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createProviderApplication(
  data: ProviderApplicationInput,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>('/provider-applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProviderApplications(
  token: string,
  status?: ProviderApplicationStatus,
): Promise<ProviderApplication[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<ProviderApplication[]>(`/provider-applications${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function approveProviderApplication(
  id: string,
  reviewNote: string,
  token: string,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>(`/provider-applications/${id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewNote }),
  });
}

export async function rejectProviderApplication(
  id: string,
  reviewNote: string,
  token: string,
): Promise<ProviderApplication> {
  return apiFetch<ProviderApplication>(`/provider-applications/${id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reviewNote }),
  });
}

// ── Admin Users ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  userType: string;
  status: string;
  canSell: boolean;
  canTransport: boolean;
  canSkipHire: boolean;
  companyRole?: string;
  emailVerified: boolean;
  company?: { id: string; name: string } | null;
  createdAt: string;
}

export async function adminGetUsers(token: string): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminUpdateUser(
  id: string,
  data: Partial<{
    canSell: boolean;
    canTransport: boolean;
    canSkipHire: boolean;
    status: string;
    userType: string;
  }>,
  token: string,
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ── Delivery Proof ────────────────────────────────────────────────────────────

export interface DeliveryProofInput {
  recipientName?: string;
  notes?: string;
  photoUrls?: string[];
}

export interface DeliveryProof {
  id: string;
  transportJobId: string;
  notes?: string;
  photoUrls: string[];
  submittedAt: string;
}

export async function submitDeliveryProof(
  jobId: string,
  data: DeliveryProofInput,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${jobId}/delivery-proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ── Skip Hire Fleet Map ────────────────────────────────────────────────────────

export type SkipHireMapStatus = 'CONFIRMED' | 'DELIVERED';

export interface SkipMapOrder {
  id: string;
  orderNumber: string;
  location: string;
  lat: number | null;
  lng: number | null;
  skipSize: SkipSize;
  wasteCategory: SkipWasteCategory;
  status: SkipHireMapStatus;
  deliveryDate: string;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  price: number;
  currency: string;
  createdAt: string;
}

export async function getSkipCarrierMap(token: string): Promise<SkipMapOrder[]> {
  return apiFetch<SkipMapOrder[]>('/skip-hire/carrier-map', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
