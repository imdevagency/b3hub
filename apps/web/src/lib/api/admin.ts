/**
 * Admin API module.
 * Functions wrapping /api/v1/admin/* endpoints: user listing, approve/suspend users,
 * platform stats, and provider application management.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

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
  buyerProfile?: {
    creditLimit: number | null;
    creditUsed: number;
    paymentTerms: string | null;
  } | null;
}

// ─── Functions ─────────────────────────────────────────────────────────────

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

export async function adminGetUsers(token: string): Promise<AdminUser[]> {
  const res = await apiFetch<{ data: AdminUser[]; total: number } | AdminUser[]>(
    '/admin/users',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  // Backend returns paginated { data, total } — unwrap if needed
  if (res && !Array.isArray(res) && 'data' in res) return res.data;
  return res as AdminUser[];
}

export async function adminUpdateUser(
  id: string,
  data: Partial<{
    canSell: boolean;
    canTransport: boolean;
    canSkipHire: boolean;
    status: string;
    userType: string;
    creditLimit: number | null;
    paymentTerms: string | null;
  }>,
  token: string,
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export interface AdminMonthlyTrend {
  month: string; // 'YYYY-MM'
  orders: number;
  gmv: number;
}

export interface AdminTodayDelivery {
  id: string;
  orderNumber: string;
  status: string;
  deliveryDate: string;
  deliveryAddress: string;
  buyerName: string;
  driverName: string | null;
  jobStatus: string | null;
}

export interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  pendingApplications: number;
  activeJobs: number;
  totalCompanies: number;
  gmvAllTime: number;
  gmv30d: number;
  commissionEst30d: number;
  openDisputes: number;
  monthlyTrends: AdminMonthlyTrend[];
  // New dashboard widgets
  orderPipeline: Record<string, number>;
  todayDeliveries: AdminTodayDelivery[];
  openSupport: number;
  pendingPayoutsCount: number;
  pendingPayoutsTotal: number;
  expiringDocumentsCount: number;
  activeSuppliers?: number;
  activeCarriers?: number;
  ordersToday?: number;
  gmvToday?: number;
}

export async function getAdminStats(token: string): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Admin Orders ───────────────────────────────────────────────────────────

export interface AdminOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  deliveryCity: string;
  deliveryDate: string | null;
  createdAt: string;
  buyer: {
    id: string;
    name: string;
    email?: string;
  };
  items: { id: string }[];
  transportJobs: { id: string; status: string }[];
}

export async function adminGetOrders(token: string): Promise<AdminOrder[]> {
  const res = await apiFetch<{ data: AdminOrder[] }>('/admin/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// ─── Admin Transport Jobs ───────────────────────────────────────────────────

export interface AdminTransportJob {
  id: string;
  jobNumber: string;
  jobType: string;
  status: string;
  cargoType: string;
  cargoWeight: number | null;
  rate: number;
  pricePerTonne: number | null;
  currency: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  createdAt: string;
  order: { id: string; orderNumber: string } | null;
  carrier: { id: string; name: string } | null;
  driver: { id: string; firstName: string; lastName: string } | null;
  vehicle: { id: string; make: string; model: string; licensePlate: string } | null;
  exceptions: { id: string }[];
}

export async function adminGetTransportJobs(token: string): Promise<AdminTransportJob[]> {
  const res = await apiFetch<{ data: AdminTransportJob[] }>('/admin/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function adminUpdateJobRate(
  jobId: string,
  data: { rate?: number; pricePerTonne?: number; note?: string },
  token: string,
): Promise<{ id: string; jobNumber: string; rate: number; pricePerTonne: number | null; status: string }> {
  return apiFetch(`/admin/jobs/${jobId}/rate`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Admin Companies ────────────────────────────────────────────────────────

export interface AdminCompany {
  id: string;
  name: string;
  legalName: string;
  companyType: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  verified: boolean;
  payoutEnabled: boolean;
  commissionRate: number;
  createdAt: string;
  _count: { users: number; orders: number };
}

export async function adminGetCompanies(token: string): Promise<AdminCompany[]> {
  return apiFetch<AdminCompany[]>('/admin/companies', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminUpdateCompany(
  id: string,
  data: Partial<{ verified: boolean; payoutEnabled: boolean; commissionRate: number }>,
  token: string,
): Promise<AdminCompany> {
  return apiFetch<AdminCompany>(`/admin/companies/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export async function adminGetAuditLogs(token: string, limit = 200): Promise<AdminAuditLog[]> {
  return apiFetch<AdminAuditLog[]>(`/admin/audit-logs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Admin Materials ──────────────────────────────────────────────────────────

export interface AdminMaterial {
  id: string;
  name: string;
  category: string;
  subCategory: string | null;
  basePrice: number;
  unit: string;
  currency: string;
  inStock: boolean;
  stockQty: number | null;
  active: boolean;
  isRecycled: boolean;
  createdAt: string;
  supplier: { id: string; name: string; verified: boolean };
  _count: { orderItems: number };
}

export async function adminGetMaterials(token: string): Promise<AdminMaterial[]> {
  return apiFetch<AdminMaterial[]>('/admin/materials', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminSetMaterialActive(
  id: string,
  active: boolean,
  token: string,
): Promise<{ id: string; name: string; active: boolean }> {
  return apiFetch(`/admin/materials/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active }),
  });
}

// ─── Payment queue ────────────────────────────────────────────────────────────

export interface AdminPayment {
  id: string;
  amount: number;
  sellerPayout: number | null;
  driverPayout: number | null;
  platformFee: number | null;
  status: string;
  currency: string;
  stripePaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    buyer: { id: string; name: string };
  } | null;
}

export async function adminGetPayments(token: string): Promise<AdminPayment[]> {
  return apiFetch('/admin/payments', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminReleasePayment(
  paymentId: string,
  token: string,
): Promise<{ ok: boolean; paymentId: string }> {
  return apiFetch(`/admin/payments/${paymentId}/release`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── SLA Monitor ─────────────────────────────────────────────────────────────

export interface SlaOrder {
  id: string;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED';
  orderType: string;
  total: number;
  currency: string;
  deliveryCity: string;
  createdAt: string;
  updatedAt: string;
  ageHours: number;
  buyer: { id: string; name: string; email?: string } | null;
  transportJobs: { id: string; status: string }[];
}

export async function adminGetSlaOrders(token: string): Promise<SlaOrder[]> {
  return apiFetch<SlaOrder[]>('/admin/sla', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Supplier Performance ─────────────────────────────────────────────────────

export interface SupplierPerformance {
  id: string;
  name: string;
  city: string;
  verified: boolean;
  commissionRate: number;
  createdAt: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  completionRate: number;
  gmv: number;
  openDisputes: number;
  disputeRate: number;
  activeMaterials: number;
}

export async function adminGetSupplierPerformance(
  token: string,
): Promise<SupplierPerformance[]> {
  return apiFetch<SupplierPerformance[]>('/admin/supplier-performance', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Surcharge Approvals ──────────────────────────────────────────────────────

export interface AdminSurcharge {
  id: string;
  type: string;
  label: string;
  amount: number;
  currency: string;
  billable: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  order: {
    id: string;
    orderNumber: string;
    buyer: { id: string; name: string } | null;
  } | null;
  transportJob: {
    id: string;
    jobNumber: string;
    driver: { id: string; firstName: string; lastName: string } | null;
  } | null;
}

export async function adminGetPendingSurcharges(token: string): Promise<AdminSurcharge[]> {
  return apiFetch<AdminSurcharge[]>('/admin/surcharges', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminApproveSurcharge(
  surchargeId: string,
  token: string,
): Promise<{ id: string }> {
  return apiFetch(`/admin/surcharges/${surchargeId}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminRejectSurcharge(
  surchargeId: string,
  note: string,
  token: string,
): Promise<{ id: string }> {
  return apiFetch(`/admin/surcharges/${surchargeId}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note }),
  });
}

// ─── Order force-cancel ───────────────────────────────────────────────────────

export async function adminCancelOrder(
  orderId: string,
  reason: string,
  token: string,
): Promise<{ id: string; orderNumber: string; status: string }> {
  return apiFetch(`/admin/orders/${orderId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

// ─── Payment refund ────────────────────────────────────────────────────────────

export async function adminRefundPayment(
  paymentId: string,
  reason: string,
  token: string,
): Promise<{ ok: boolean; paymentId: string; orderId: string }> {
  return apiFetch(`/admin/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

// ─── Job reassign ─────────────────────────────────────────────────────────────

export async function adminReassignJob(
  jobId: string,
  driverId: string,
  note: string,
  token: string,
): Promise<{ id: string; jobNumber: string; status: string; driver: { id: string; firstName: string; lastName: string } | null }> {
  return apiFetch(`/admin/jobs/${jobId}/reassign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ driverId, note }),
  });
}

// ─── Skip hire orders ─────────────────────────────────────────────────────────

export interface AdminSkipHireOrder {
  id: string;
  orderNumber: string;
  location: string;
  wasteCategory: string;
  skipSize: string;
  deliveryDate: string;
  hireDays: number | null;
  price: number;
  currency: string;
  paymentStatus: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  carrier: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function adminGetSkipHireOrders(token: string): Promise<AdminSkipHireOrder[]> {
  const res = await apiFetch<{ data: AdminSkipHireOrder[] }>('/admin/skip-hire', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

// ─── Transport job exceptions ─────────────────────────────────────────────────

export interface AdminException {
  id: string;
  type: string;
  status: string;
  notes: string;
  photoUrls: string[];
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  transportJob: {
    id: string;
    jobNumber: string;
    status: string;
    order: { id: string; orderNumber: string } | null;
  };
  reportedBy: { id: string; firstName: string; lastName: string };
  resolvedBy: { id: string; firstName: string; lastName: string } | null;
}

export async function adminGetExceptions(token: string, status?: string): Promise<AdminException[]> {
  const qs = status && status !== 'ALL' ? `?status=${status}` : '';
  const res = await apiFetch<{ data: AdminException[] }>(`/admin/exceptions${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function adminResolveException(
  exceptionId: string,
  resolution: string,
  token: string,
): Promise<{ id: string; status: string; resolution: string }> {
  return apiFetch(`/admin/exceptions/${exceptionId}/resolve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resolution }),
  });
}

// ── Admin invoices ──────────────────────────────────────────────────────────

export interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  paymentStatus: string;
  dueDate: string;
  paidDate?: string | null;
  isCommissionInvoice: boolean;
  isCreditNote: boolean;
  pdfUrl?: string | null;
  createdAt: string;
  order?: { id: string; orderNumber: string; orderType: string } | null;
  buyerCompany?: { id: string; name: string } | null;
  sellerCompany?: { id: string; name: string } | null;
}

export async function adminGetAllInvoices(
  token: string,
  page = 1,
  limit = 50,
  status?: string,
): Promise<{ data: AdminInvoice[]; total: number; page: number; limit: number; pages: number }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'ALL') qs.set('status', status);
  return apiFetch(`/admin/invoices?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Admin framework contracts ────────────────────────────────────────────────

export interface AdminFrameworkContract {
  id: string;
  contractNumber: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  isFieldContract: boolean;
  prepaidBalance: number;
  prepaidUsed: number;
  createdAt: string;
  buyer?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  positions: { id: string; agreedQty: number; unitPrice: number | null; unit: string }[];
  _count: { callOffJobs: number };
}

export async function adminGetAllFrameworkContracts(
  token: string,
  page = 1,
  limit = 50,
  status?: string,
): Promise<{ data: AdminFrameworkContract[]; total: number; page: number; pages: number }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'ALL') qs.set('status', status);
  return apiFetch(`/admin/framework-contracts?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Admin payouts ────────────────────────────────────────────────────────────

export interface AdminPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  notes?: string | null;
  payseraTransferId?: string | null;
  createdAt: string;
  order?: { id: string; orderNumber: string } | null;
  // supplier payouts
  supplier?: { id: string; name: string } | null;
  // carrier payouts
  carrier?: { id: string; name: string } | null;
  driver?: { id: string; firstName: string; lastName: string } | null;
}

export interface AdminPayoutSummary {
  supplierPending: number;
  supplierOverdue: number;
  carrierPending: number;
  carrierOverdue: number;
  totalPendingEur: number;
}

export async function adminGetPayouts(
  token: string,
  page = 1,
  limit = 50,
  status?: string,
  type?: 'supplier' | 'carrier',
  overdue?: boolean,
): Promise<{ data: AdminPayout[]; total: number; page: number; pages: number }> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status && status !== 'ALL') qs.set('status', status);
  if (type) qs.set('type', type);
  if (overdue) qs.set('overdue', 'true');
  return apiFetch(`/admin/payouts?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminGetPayoutSummary(token: string): Promise<AdminPayoutSummary> {
  return apiFetch(`/admin/payouts/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminExecuteSupplierPayout(id: string, token: string) {
  return apiFetch(`/admin/payouts/supplier/${id}/execute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminExecuteCarrierPayout(id: string, token: string) {
  return apiFetch(`/admin/payouts/carrier/${id}/execute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminExecuteAllPayouts(token: string) {
  return apiFetch(`/admin/payouts/execute`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Admin broadcast ──────────────────────────────────────────────────────────

export async function adminBroadcastNotification(
  title: string,
  message: string,
  audience: 'ALL' | 'BUYERS' | 'SELLERS' | 'CARRIERS',
  token: string,
): Promise<{ sent: number; audience: string }> {
  return apiFetch(`/admin/notifications/broadcast`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, message, audience }),
  });
}

// ── Platform settings ────────────────────────────────────────────────────────

export async function adminGetSettings(
  token: string,
): Promise<Record<string, string>> {
  return apiFetch<Record<string, string>>('/admin/settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminUpdateSettings(
  settings: Record<string, string>,
  token: string,
): Promise<Record<string, string>> {
  return apiFetch<Record<string, string>>('/admin/settings', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ settings }),
  });
}

// ── Skip size catalogue ────────────────────────────────────────────────────────

export type SkipCategory = 'SKIP' | 'BIG_BAG' | 'CONTAINER';

export interface SkipSizeDefinition {
  id: string;
  code: string;
  label: string;
  labelLv: string | null;
  volumeM3: number;
  category: SkipCategory;
  description: string | null;
  descriptionLv: string | null;
  heightPct: number;
  basePrice: number | null;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function adminListSkipSizes(
  token: string,
): Promise<SkipSizeDefinition[]> {
  return apiFetch<SkipSizeDefinition[]>('/admin/skip-sizes', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminUpsertSkipSize(
  code: string,
  data: Partial<Omit<SkipSizeDefinition, 'id' | 'code' | 'createdAt' | 'updatedAt'>>,
  token: string,
): Promise<SkipSizeDefinition> {
  return apiFetch<SkipSizeDefinition>(`/admin/skip-sizes/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteSkipSize(
  code: string,
  token: string,
): Promise<void> {
  return apiFetch<void>(`/admin/skip-sizes/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Marketplace engine overview ───────────────────────────────────────────────

export interface MarketplaceCarrierPricing {
  skipSize: string;
  price: number;
  currency: string;
  updatedAt: string;
}

export interface MarketplaceServiceZone {
  id: string;
  city: string;
  postcode: string | null;
  surcharge: number;
}

export interface MarketplaceCarrier {
  id: string;
  name: string;
  logo: string | null;
  verified: boolean;
  companyType: string;
  lat: number | null;
  lng: number | null;
  serviceRadiusKm: number | null;
  rating: number | null;
  commissionRate: number;
  carrierCommissionRate: number;
  serviceZones: MarketplaceServiceZone[];
  carrierPricing: MarketplaceCarrierPricing[];
  pricingBySizeCode: Record<string, MarketplaceCarrierPricing>;
  coverageType: 'zones' | 'radius' | 'national';
  blockedToday: boolean;
}

export interface AdminMarketplaceData {
  sizes: SkipSizeDefinition[];
  carriers: MarketplaceCarrier[];
}

export async function adminGetMarketplace(
  token: string,
): Promise<AdminMarketplaceData> {
  return apiFetch<AdminMarketplaceData>('/admin/marketplace', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Guest orders ─────────────────────────────────────────────────────────────

export type GuestOrderStatus =
  | 'PENDING'
  | 'QUOTED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'CONVERTED'
  | 'CANCELLED';

export interface AdminGuestOrder {
  id: string;
  orderNumber: string;
  token: string;
  category: string;
  // contact
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  // delivery
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  // pricing
  quotedAmount: number | null;
  quotedCurrency: string;
  paymentStatus: string | null;
  // lifecycle
  status: GuestOrderStatus;
  convertedOrderId: string | null;
  // details
  materialName: string | null;
  quantity: number | null;
  unit: string | null;
  skipSize: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function adminGetGuestOrders(
  token: string,
  status?: GuestOrderStatus,
): Promise<AdminGuestOrder[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch<AdminGuestOrder[]>(`/guest-orders${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminSetGuestQuote(
  id: string,
  quotedAmount: number,
  token: string,
): Promise<AdminGuestOrder> {
  return apiFetch<AdminGuestOrder>(`/guest-orders/${id}/quote`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ quotedAmount }),
  });
}

export async function adminUpdateGuestStatus(
  id: string,
  status: GuestOrderStatus,
  token: string,
): Promise<AdminGuestOrder> {
  return apiFetch<AdminGuestOrder>(`/guest-orders/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}

// ── Recycling centers (admin) ─────────────────────────────────────────────────

export interface AdminRecyclingCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  acceptedWasteTypes: string[];
  capacity: number;
  certifications: string[];
  active: boolean;
  createdAt: string;
  company: { id: string; name: string; logo: string | null; city: string };
  _count: { wasteRecords: number };
}

export async function adminGetRecyclingCenters(
  token: string,
): Promise<AdminRecyclingCenter[]> {
  const res = await apiFetch<{ data: AdminRecyclingCenter[] }>(
    '/admin/recycling-centers',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data;
}

export async function adminToggleRecyclingCenter(
  id: string,
  active: boolean,
  token: string,
): Promise<{ id: string; active: boolean }> {
  return apiFetch(`/admin/recycling-centers/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active }),
  });
}

// ── RFQ / Quote Requests (admin) ──────────────────────────────────────────────

export type AdminQuoteRequestStatus = 'PENDING' | 'QUOTED' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
export type AdminQuoteResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface AdminQuoteResponse {
  id: string;
  pricePerUnit: number;
  totalPrice: number;
  unit: string;
  status: AdminQuoteResponseStatus;
  createdAt: string;
  supplier: { id: string; name: string };
}

export interface AdminQuoteRequest {
  id: string;
  requestNumber: string;
  materialCategory: string;
  materialName: string;
  quantity: number;
  unit: string;
  deliveryAddress: string;
  deliveryCity: string;
  status: AdminQuoteRequestStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  buyer: { id: string; firstName: string; lastName: string; email: string };
  responses: AdminQuoteResponse[];
}

export async function adminGetQuoteRequests(
  token: string,
  page = 1,
  limit = 50,
  status?: AdminQuoteRequestStatus,
): Promise<{ data: AdminQuoteRequest[]; total: number; page: number; pages: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiFetch(`/admin/quote-requests?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Documents (admin) ─────────────────────────────────────────────────────────

export type AdminDocumentType =
  | 'INVOICE'
  | 'WEIGHING_SLIP'
  | 'DELIVERY_PROOF'
  | 'WASTE_CERTIFICATE'
  | 'DELIVERY_NOTE'
  | 'WASTE_TRANSPORT_NOTE'
  | 'CONTRACT'
  | 'OTHER';

export type AdminDocumentStatus = 'DRAFT' | 'ISSUED' | 'SIGNED' | 'ARCHIVED';

export interface AdminDocumentLink {
  id: string;
  entityType: string;
  entityId: string;
  role: string;
}

export interface AdminDocument {
  id: string;
  title: string;
  type: AdminDocumentType;
  status: AdminDocumentStatus;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  orderId: string | null;
  invoiceId: string | null;
  transportJobId: string | null;
  wasteRecordId: string | null;
  skipHireId: string | null;
  ownerId: string;
  issuedBy: string | null;
  isGenerated: boolean;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  links: AdminDocumentLink[];
  owner: { id: string; firstName: string; lastName: string; email: string };
}

export async function adminGetDocuments(
  token: string,
  params?: {
    page?: number;
    limit?: number;
    type?: AdminDocumentType | 'ALL';
    status?: AdminDocumentStatus | 'ALL';
    search?: string;
    isGenerated?: boolean;
  },
): Promise<{ data: AdminDocument[]; total: number; page: number; limit: number; pages: number }> {
  const qs = new URLSearchParams({
    page: String(params?.page ?? 1),
    limit: String(params?.limit ?? 50),
  });
  if (params?.type && params.type !== 'ALL') qs.set('type', params.type);
  if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params?.search) qs.set('search', params.search);
  if (params?.isGenerated !== undefined) qs.set('isGenerated', String(params.isGenerated));
  return apiFetch(`/admin/documents?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminUpdateDocumentStatus(
  id: string,
  status: AdminDocumentStatus,
  note: string | undefined,
  token: string,
): Promise<{ id: string; title: string; status: AdminDocumentStatus; updatedAt: string }> {
  return apiFetch(`/admin/documents/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, note }),
  });
}

// ── Detail views (GET by ID) ──────────────────────────────────────────────────

export interface AdminUserDetail extends AdminUser {
  company: {
    id: string; name: string; legalName: string; companyType: string;
    verified: boolean; payoutEnabled: boolean; commissionRate: number;
  } | null;
  orders: { id: string; orderNumber: string; status: string; total: number; currency: string; createdAt: string }[];
}

export async function adminGetUserById(id: string, token: string): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/admin/users/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface AdminCompanyDetail extends AdminCompany {
  address: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  users: { id: string; firstName: string; lastName: string; email?: string; companyRole: string | null; status: string; canSell: boolean; canTransport: boolean }[];
  orders: { id: string; orderNumber: string; status: string; total: number; currency: string; createdAt: string }[];
}

export async function adminGetCompanyById(id: string, token: string): Promise<AdminCompanyDetail> {
  return apiFetch<AdminCompanyDetail>(`/admin/companies/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface AdminOrderDetail extends AdminOrder {
  deliveryAddress: string | null;
  notes: string | null;
  updatedAt: string;
  items: {
    id: string; quantity: number; unitPrice: number; total: number; unit: string;
    material: { id: string; name: string; category: string } | null;
  }[];
  transportJobs: {
    id: string; jobNumber: string; status: string; jobType: string;
    pickupDate: string; deliveryDate: string; rate: number; currency: string;
    driver: { id: string; firstName: string; lastName: string } | null;
    carrier: { id: string; name: string } | null;
  }[];
  documents: { id: string; documentType: string; fileUrl: string | null; createdAt: string }[];
}

export async function adminGetOrderById(id: string, token: string): Promise<AdminOrderDetail> {
  return apiFetch<AdminOrderDetail>(`/admin/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface AdminTransportJobDetail extends AdminTransportJob {
  pickupAddress: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  updatedAt: string;
  exceptions: { id: string; type: string; status: string; description: string; createdAt: string }[];
  documents: { id: string; documentType: string; fileUrl: string | null; createdAt: string }[];
  driver: { id: string; firstName: string; lastName: string; phone?: string | null } | null;
}

export async function adminGetTransportJobById(id: string, token: string): Promise<AdminTransportJobDetail> {
  return apiFetch<AdminTransportJobDetail>(`/admin/jobs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}


// ─── Force status overrides ───────────────────────────────────────────────────

export async function adminForceJobStatus(
  id: string,
  status: string,
  reason: string,
  token: string,
): Promise<{ id: string; jobNumber: string; status: string; statusUpdatedAt: string }> {
  return apiFetch(`/admin/jobs/${id}/force-status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
}

export async function adminForceOrderStatus(
  id: string,
  status: string,
  reason: string,
  token: string,
): Promise<{ id: string; orderNumber: string; status: string; updatedAt: string }> {
  return apiFetch(`/admin/orders/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reason }),
  });
}

// ─── Live Dispatch ─────────────────────────────────────────────────────────

export interface AdminDispatchJob {
  id: string;
  jobNumber: string;
  jobType: string;
  status: string;
  cargoType: string;
  cargoWeight: number | null;
  rate: number;
  currency: string;
  pickupCity: string;
  deliveryCity: string;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupDate: string;
  deliveryDate: string;
  order: { id: string; orderNumber: string } | null;
  carrier: { id: string; name: string } | null;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    driverProfile: {
      isOnline: boolean;
      currentLocation: { lat: number; lng: number } | null;
      rating: number | null;
    } | null;
  } | null;
  vehicle: { id: string; make: string; model: string; licensePlate: string } | null;
  exceptions: { id: string }[];
}

export interface AdminDispatchOnlineDriver {
  id: string;
  isOnline: boolean;
  currentLocation: { lat: number; lng: number } | null;
  rating: number | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    company: { id: string; name: string } | null;
  };
}

export interface AdminDispatchCarrier {
  id: string;
  name: string;
  companyType: string;
  city: string;
  activeJobs: number;
  onlineDrivers: number;
  _count: { users: number };
}

export interface AdminDispatchData {
  jobs: AdminDispatchJob[];
  onlineDrivers: AdminDispatchOnlineDriver[];
  carriers: AdminDispatchCarrier[];
  summary: {
    totalActiveJobs: number;
    totalOnlineDrivers: number;
    totalCarriers: number;
    jobsByStatus: Record<string, number>;
  };
}

export async function adminGetDispatch(token: string): Promise<AdminDispatchData> {
  return apiFetch<AdminDispatchData>('/admin/dispatch', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── B3 Recycling ─────────────────────────────────────────────────────────────

export interface RecyclingInboundJob {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  wasteTypes: string | null;
  disposalVolume: number | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryDate: string | null;
  total: number;
  currency: string;
  createdAt: string;
  buyer: { id: string; name: string; email: string; phone: string | null } | null;
  b3Field: { id: string; name: string; city: string } | null;
  transportJobs: { id: string; status: string }[];
}

export interface RecyclingWasteRecord {
  id: string;
  wasteType: string;
  weight: number;
  volume: number | null;
  processedDate: string | null;
  recyclableWeight: number | null;
  recyclingRate: number | null;
  certificateUrl: string | null;
  createdAt: string;
  recyclingCenter: { id: string; name: string; city: string };
  containerOrder: {
    id: string;
    order: { id: string; orderNumber: string; buyer: { id: string; name: string } | null } | null;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function adminGetRecyclingJobs(
  token: string,
  params?: { page?: number; limit?: number; centerId?: string },
): Promise<PaginatedResponse<RecyclingInboundJob>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.centerId) qs.set('centerId', params.centerId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<PaginatedResponse<RecyclingInboundJob>>(
    `/admin/b3-recycling/jobs${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminGetRecyclingWasteRecords(
  token: string,
  params?: { page?: number; limit?: number; centerId?: string },
): Promise<PaginatedResponse<RecyclingWasteRecord>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.centerId) qs.set('centerId', params.centerId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<PaginatedResponse<RecyclingWasteRecord>>(
    `/admin/b3-recycling/waste-records${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
