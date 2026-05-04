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

// ─── Transport Drivers (dispatcher view) ────────────────────────────────────

export interface TransportDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export async function adminGetDrivers(token: string): Promise<TransportDriver[]> {
  return apiFetch<TransportDriver[]>('/transport-jobs/drivers', {
    headers: { Authorization: `Bearer ${token}` },
  });
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

// ── B3 Construction ────────────────────────────────────────────────────────

export type ConstructionProjectStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

export interface AdminConstructionProject {
  id: string;
  name: string;
  description: string | null;
  clientName: string | null;
  siteAddress: string | null;
  status: ConstructionProjectStatus;
  contractValue: number;
  budgetAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string };
  orderCount: number;
  transportJobCount: number;
  materialCosts: number;
  grossMargin: number;
  marginPct: number;
  budgetUsedPct: number | null;
}

export interface AdminConstructionProjectOrder {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  category: string | null;
  total: number;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryDate: string | null;
  wasteTypes: string | null;
  disposalVolume: number | null;
  createdAt: string;
  items: {
    material: { name: string; category: string } | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
}

export interface AdminConstructionProjectDetail extends AdminConstructionProject {
  pendingCosts: number;
  orders: AdminConstructionProjectOrder[];
  sites: {
    id: string;
    label: string;
    address: string;
    lat: number | null;
    lng: number | null;
    type: string;
    isDefault: boolean;
  }[];
  frameworkContracts: {
    id: string;
    contractNumber: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string | null;
    totalValue: number | null;
    supplier: { id: string; name: string } | null;
  }[];
  transportJobs: {
    id: string;
    jobNumber: string;
    status: string;
    cargoType: string;
    cargoWeight: number | null;
    pickupAddress: string;
    pickupCity: string;
    deliveryAddress: string;
    deliveryCity: string;
    pickupDate: string;
    deliveryDate: string;
    rate: number;
    driver: { id: string; firstName: string; lastName: string } | null;
  }[];
  createdBy: { id: string; firstName: string; lastName: string; email: string | null };
}

export interface AdminConstructionDisposalOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  deliveryDate: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  wasteTypes: string | null;
  disposalVolume: number | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  buyer: { id: string; firstName: string; lastName: string } | null;
  buyerCompany: { id: string; name: string } | null;
}

export async function adminGetConstructionProjects(
  token: string,
  params?: { page?: number; limit?: number; status?: string; companyId?: string },
): Promise<PaginatedResponse<AdminConstructionProject>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.companyId) qs.set('companyId', params.companyId);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<PaginatedResponse<AdminConstructionProject>>(
    `/admin/b3-construction/projects${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminGetConstructionProjectById(
  id: string,
  token: string,
): Promise<AdminConstructionProjectDetail> {
  return apiFetch<AdminConstructionProjectDetail>(
    `/admin/b3-construction/projects/${id}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminUpdateConstructionProject(
  id: string,
  data: {
    status?: ConstructionProjectStatus;
    name?: string;
    description?: string;
    clientName?: string;
    siteAddress?: string;
    contractValue?: number;
    budgetAmount?: number;
    startDate?: string | null;
    endDate?: string | null;
  },
  token: string,
): Promise<{ id: string; name: string; status: ConstructionProjectStatus; updatedAt: string }> {
  return apiFetch(`/admin/b3-construction/projects/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface CreateConstructionProjectPayload {
  name: string;
  companyId: string;
  contractValue: number;
  clientName?: string;
  description?: string;
  siteAddress?: string;
  budgetAmount?: number;
  startDate?: string;
  endDate?: string;
  status?: ConstructionProjectStatus;
}

export async function adminCreateConstructionProject(
  data: CreateConstructionProjectPayload,
  token: string,
): Promise<{ id: string; name: string; status: ConstructionProjectStatus; contractValue: number; createdAt: string }> {
  return apiFetch('/admin/b3-construction/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminGetConstructionDisposalOrders(
  token: string,
  params?: { page?: number; limit?: number; projectId?: string; status?: string },
): Promise<PaginatedResponse<AdminConstructionDisposalOrder>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.projectId) qs.set('projectId', params.projectId);
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch<PaginatedResponse<AdminConstructionDisposalOrder>>(
    `/admin/b3-construction/disposal${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

// ── B3 Construction — Clients ─────────────────────────────────────────────────

export interface AdminConstructionClient {
  id: string;
  name: string;
  legalName: string;
  registrationNum: string | null;
  email: string;
  phone: string;
  city: string;
  country: string;
  verified: boolean;
  createdAt: string;
  _count: { users: number; orders: number };
}

export interface CreateConstructionClientPayload {
  name: string;
  legalName: string;
  registrationNum?: string;
  taxId?: string;
  email: string;
  phone: string;
  city?: string;
  street?: string;
  postalCode?: string;
}

export async function adminGetConstructionClients(
  token: string,
): Promise<AdminConstructionClient[]> {
  return apiFetch<AdminConstructionClient[]>('/admin/b3-construction/clients', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateConstructionClient(
  data: CreateConstructionClientPayload,
  token: string,
): Promise<AdminConstructionClient> {
  return apiFetch<AdminConstructionClient>('/admin/b3-construction/clients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── B3 Recycling — job actions ────────────────────────────────────────────────

export async function adminUpdateRecyclingJob(
  id: string,
  data: { status?: string; notes?: string },
  token: string,
): Promise<{ id: string; orderNumber: string; status: string; updatedAt: string }> {
  return apiFetch(`/admin/b3-recycling/jobs/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminCreateWasteRecord(
  data: {
    recyclingCenterId: string;
    wasteType: string;
    weight: number;
    volume?: number;
    processedDate?: string;
    recyclableWeight?: number;
    recyclingRate?: number;
  },
  token: string,
): Promise<RecyclingWasteRecord> {
  return apiFetch<RecyclingWasteRecord>('/admin/b3-recycling/waste-records', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── B3 Construction — Rate Library ────────────────────────────────────────────

export type CostCode = 'LABOUR' | 'EQUIPMENT' | 'MATERIAL' | 'TRANSPORT' | 'SUBCONTRACTOR' | 'OTHER';
export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
export type UnitOfMeasure = 'T' | 'M3' | 'M2' | 'M' | 'H' | 'DAY' | 'KM' | 'LOAD' | 'PC';
export type RateCategory = 'MATERIAL' | 'TRANSPORT' | 'LABOUR' | 'EQUIPMENT' | 'SUBCONTRACTOR' | 'OTHER';

export interface MaterialRateEntry {
  id: string;
  name: string;
  unit: UnitOfMeasure;
  category: RateCategory;
  supplierName: string;
  supplierNote: string | null;
  pricePerUnit: number;
  deliveryFee: number;
  selfCostPerUnit: number | null;
  densityCoeff: number | null;
  truckConfig: string | null;
  zone: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRateEntryPayload {
  name: string;
  unit: UnitOfMeasure;
  category: RateCategory;
  supplierName: string;
  supplierNote?: string;
  pricePerUnit: number;
  deliveryFee?: number;
  selfCostPerUnit?: number;
  densityCoeff?: number;
  truckConfig?: string;
  zone?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export async function adminGetRateEntries(
  token: string,
  params?: { category?: RateCategory; activeOnly?: boolean; page?: number; limit?: number },
): Promise<PaginatedResponse<MaterialRateEntry>> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.activeOnly) qs.set('activeOnly', 'true');
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiFetch<PaginatedResponse<MaterialRateEntry>>(
    `/admin/b3-construction/rates${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminCreateRateEntry(
  data: CreateRateEntryPayload,
  token: string,
): Promise<MaterialRateEntry> {
  return apiFetch<MaterialRateEntry>('/admin/b3-construction/rates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateRateEntry(
  id: string,
  data: Partial<CreateRateEntryPayload> & { effectiveTo?: string | null },
  token: string,
): Promise<MaterialRateEntry> {
  return apiFetch<MaterialRateEntry>(`/admin/b3-construction/rates/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteRateEntry(id: string, token: string): Promise<void> {
  return apiFetch(`/admin/b3-construction/rates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── B3 Construction — Daily Production Reports ────────────────────────────────

export interface DailyReportLine {
  id: string;
  reportId: string;
  costCode: CostCode;
  description: string;
  personName: string | null;
  quantity: number;
  unit: UnitOfMeasure;
  unitRate: number;
  total: number;
  rateEntryId: string | null;
  notes: string | null;
  rateEntry?: { id: string; name: string; supplierName: string } | null;
}

export interface DailyReport {
  id: string;
  projectId: string;
  createdById: string;
  approvedById: string | null;
  reportDate: string;
  siteLabel: string | null;
  weatherNote: string | null;
  notes: string | null;
  status: DailyReportStatus;
  totalCost?: number;
  project?: { id: string; name: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  lines?: DailyReportLine[];
  _count?: { lines: number };
}

export interface CreateDailyReportPayload {
  projectId: string;
  reportDate: string;
  siteLabel?: string;
  weatherNote?: string;
  notes?: string;
  lines: {
    costCode: CostCode;
    description: string;
    personName?: string;
    quantity: number;
    unit: UnitOfMeasure;
    unitRate: number;
    rateEntryId?: string;
    employeeId?: string;
    notes?: string;
  }[];
}

export async function adminGetDailyReports(
  token: string,
  params?: { projectId?: string; status?: string; page?: number; limit?: number },
): Promise<PaginatedResponse<DailyReport>> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', params.projectId);
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiFetch<PaginatedResponse<DailyReport>>(
    `/admin/b3-construction/daily-reports${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminGetDailyReportById(id: string, token: string): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/admin/b3-construction/daily-reports/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateDailyReport(
  data: CreateDailyReportPayload,
  token: string,
): Promise<DailyReport> {
  return apiFetch<DailyReport>('/admin/b3-construction/daily-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateDailyReport(
  id: string,
  data: { siteLabel?: string; weatherNote?: string; notes?: string; status?: DailyReportStatus },
  token: string,
): Promise<DailyReport> {
  return apiFetch<DailyReport>(`/admin/b3-construction/daily-reports/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteDailyReport(id: string, token: string): Promise<void> {
  return apiFetch(`/admin/b3-construction/daily-reports/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── B3 Construction — Employee Roster ─────────────────────────────────────────

export interface ConstructionEmployee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  personalCode: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  defaultRateEntryId: string | null;
  defaultRateEntry?: { id: string; name: string; unit: UnitOfMeasure; pricePerUnit: number } | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  role: string;
  personalCode?: string;
  phone?: string;
  email?: string;
  notes?: string;
  defaultRateEntryId?: string;
}

export async function adminGetEmployees(
  token: string,
  params?: { activeOnly?: boolean; page?: number; limit?: number },
): Promise<PaginatedResponse<ConstructionEmployee>> {
  const qs = new URLSearchParams();
  if (params?.activeOnly) qs.set('activeOnly', 'true');
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiFetch<PaginatedResponse<ConstructionEmployee>>(
    `/admin/b3-construction/employees${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminCreateEmployee(
  data: CreateEmployeePayload,
  token: string,
): Promise<ConstructionEmployee> {
  return apiFetch<ConstructionEmployee>('/admin/b3-construction/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateEmployee(
  id: string,
  data: Partial<CreateEmployeePayload> & { defaultRateEntryId?: string | null; active?: boolean },
  token: string,
): Promise<ConstructionEmployee> {
  return apiFetch<ConstructionEmployee>(`/admin/b3-construction/employees/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminDeactivateEmployee(id: string, token: string): Promise<ConstructionEmployee> {
  return apiFetch<ConstructionEmployee>(`/admin/b3-construction/employees/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface EmployeeHoursLine {
  id: string;
  costCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
  totalCost: number;
  report: {
    id: string;
    reportDate: string;
    project: { id: string; name: string };
  };
}

export interface EmployeeHoursResponse {
  employee: ConstructionEmployee;
  lines: EmployeeHoursLine[];
  totalQuantity: number;
}

export async function adminGetEmployeeHours(id: string, token: string): Promise<EmployeeHoursResponse> {
  return apiFetch<EmployeeHoursResponse>(`/admin/b3-construction/employees/${id}/hours`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── B3 Construction — Profitability ───────────────────────────────────────────

export interface ProjectProfitabilitySummary {
  id: string;
  name: string;
  clientName: string | null;
  status: ConstructionProjectStatus;
  contractValue: number;
  budgetAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  dprCost: number;
  grossMargin: number;
  marginPct: number;
  budgetUsedPct: number | null;
  costByCode: Partial<Record<CostCode, number>>;
  budgetByCode: Partial<Record<CostCode, number>>;
}

export interface ConstructionProfitabilityResponse {
  projects: ProjectProfitabilitySummary[];
  totals: {
    contractValue: number;
    dprCost: number;
    grossMargin: number;
    marginPct: number;
  };
  costBreakdown: Partial<Record<CostCode, number>>;
  monthlyCosts: { month: string; cost: number }[];
}

export async function adminGetConstructionProfitability(
  token: string,
  params?: { projectId?: string; from?: string; to?: string },
): Promise<ConstructionProfitabilityResponse> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', params.projectId);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const q = qs.toString();
  return apiFetch<ConstructionProfitabilityResponse>(
    `/admin/b3-construction/profitability${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}


// ── DPR Templates ─────────────────────────────────────────────────────────────

export interface DprTemplateLine {
  id: string;
  templateId: string;
  costCode: CostCode;
  description: string;
  quantity: number;
  unit: UnitOfMeasure;
  unitRate: number;
  rateEntryId?: string | null;
  rateEntry?: { id: string; name: string; unit: UnitOfMeasure; pricePerUnit: number } | null;
  employeeId?: string | null;
  employee?: { id: string; firstName: string; lastName: string; role: string } | null;
  notes?: string | null;
  sortOrder: number;
}

export interface DprTemplate {
  id: string;
  name: string;
  description?: string | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  active: boolean;
  lines: DprTemplateLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDprTemplatePayload {
  name: string;
  description?: string;
  projectId?: string;
  lines: Array<{
    costCode: CostCode;
    description: string;
    quantity: number;
    unit: UnitOfMeasure;
    unitRate: number;
    rateEntryId?: string;
    employeeId?: string;
    notes?: string;
    sortOrder?: number;
  }>;
}

export async function adminGetDprTemplates(
  token: string,
  params?: { projectId?: string; includeGlobal?: boolean },
): Promise<DprTemplate[]> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', params.projectId);
  if (params?.includeGlobal === false) qs.set('includeGlobal', 'false');
  const q = qs.toString();
  return apiFetch<DprTemplate[]>(
    `/admin/b3-construction/dpr-templates${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminCreateDprTemplate(
  token: string,
  payload: CreateDprTemplatePayload,
): Promise<DprTemplate> {
  return apiFetch<DprTemplate>('/admin/b3-construction/dpr-templates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateDprTemplate(
  token: string,
  id: string,
  payload: Partial<CreateDprTemplatePayload>,
): Promise<DprTemplate> {
  return apiFetch<DprTemplate>(`/admin/b3-construction/dpr-templates/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteDprTemplate(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/admin/b3-construction/dpr-templates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Project Budget Lines (Estimator) ─────────────────────────────────────────

export interface ProjectBudgetLine {
  id: string;
  projectId: string;
  costCode: CostCode;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
  amount: number;
  rateEntryId?: string | null;
  sortOrder: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  rateEntry?: {
    id: string;
    name: string;
    supplierName: string;
    unit: string;
    pricePerUnit: number;
  } | null;
}

export interface CreateBudgetLinePayload {
  costCode: CostCode;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
  rateEntryId?: string;
  sortOrder?: number;
  notes?: string;
}

export async function adminGetProjectBudgetLines(
  token: string,
  projectId: string,
): Promise<ProjectBudgetLine[]> {
  return apiFetch<ProjectBudgetLine[]>(
    `/admin/b3-construction/projects/${projectId}/budget-lines`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function adminCreateBudgetLine(
  token: string,
  projectId: string,
  data: CreateBudgetLinePayload,
): Promise<ProjectBudgetLine> {
  return apiFetch<ProjectBudgetLine>(
    `/admin/b3-construction/projects/${projectId}/budget-lines`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export async function adminUpdateBudgetLine(
  token: string,
  lineId: string,
  data: Partial<CreateBudgetLinePayload> & { rateEntryId?: string | null },
): Promise<ProjectBudgetLine> {
  return apiFetch<ProjectBudgetLine>(
    `/admin/b3-construction/budget-lines/${lineId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export async function adminDeleteBudgetLine(
  token: string,
  lineId: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(
    `/admin/b3-construction/budget-lines/${lineId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function adminSetProjectBudgetLines(
  token: string,
  projectId: string,
  lines: CreateBudgetLinePayload[],
): Promise<ProjectBudgetLine[]> {
  return apiFetch<ProjectBudgetLine[]>(
    `/admin/b3-construction/projects/${projectId}/budget-lines`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines }),
    },
  );
}

// ── B3 Construction — Project Documents ──────────────────────────────────────

export type ProjectDocumentType =
  | 'CONTRACT'
  | 'INVOICE'
  | 'WASTE_CERTIFICATE'
  | 'DELIVERY_NOTE'
  | 'WASTE_TRANSPORT_NOTE'
  | 'DELIVERY_PROOF'
  | 'WEIGHING_SLIP'
  | 'OTHER';

export type ProjectDocumentStatus = 'DRAFT' | 'ISSUED' | 'SIGNED' | 'ARCHIVED';

export interface ProjectDocument {
  id: string;
  title: string;
  type: ProjectDocumentType;
  status: ProjectDocumentStatus;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  notes: string | null;
  expiresAt: string | null;
  issuedBy: string | null;
  isGenerated: boolean;
  role: string;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; firstName: string; lastName: string; email: string } | null;
}

export async function adminGetProjectDocuments(
  token: string,
  projectId: string,
): Promise<ProjectDocument[]> {
  return apiFetch<ProjectDocument[]>(
    `/admin/b3-construction/projects/${projectId}/documents`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export interface CreateProjectDocumentPayload {
  title: string;
  type: ProjectDocumentType;
  status?: ProjectDocumentStatus;
  fileUrl?: string;
  notes?: string;
  expiresAt?: string;
  issuedBy?: string;
}

export async function adminCreateProjectDocument(
  token: string,
  projectId: string,
  data: CreateProjectDocumentPayload,
): Promise<Pick<ProjectDocument, 'id' | 'title' | 'type' | 'status' | 'fileUrl' | 'createdAt'>> {
  return apiFetch(
    `/admin/b3-construction/projects/${projectId}/documents`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}

export async function adminDeleteProjectDocument(
  token: string,
  projectId: string,
  documentId: string,
): Promise<{ ok: boolean }> {
  return apiFetch(
    `/admin/b3-construction/projects/${projectId}/documents/${documentId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

// ── B3 Construction — Subcontractor Spend ─────────────────────────────────────

export interface SubcontractorSpendEntry {
  name: string;
  totalCost: number;
  lineCount: number;
  projectCount: number;
  projects: string[];
  lastSeen: string;
}

export interface SubcontractorSpendResponse {
  summary: SubcontractorSpendEntry[];
  totalSpend: number;
  lineCount: number;
}

export async function adminGetSubcontractorSpend(
  token: string,
  params?: { projectId?: string; from?: string; to?: string },
): Promise<SubcontractorSpendResponse> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', params.projectId);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const q = qs.toString();
  return apiFetch<SubcontractorSpendResponse>(
    `/admin/b3-construction/subcontractors${q ? `?${q}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

// ── B3 Construction — Subcontractor Register ──────────────────────────────────

export interface ConstructionSubcontractor {
  id: string;
  name: string;
  registrationNo?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  speciality?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  engagements?: SubcontractorEngagement[];
}

export interface SubcontractorEngagement {
  id: string;
  subcontractorId: string;
  projectId: string;
  description: string;
  agreedAmount: number;
  invoicedAmount?: number | null;
  paidAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  subcontractor?: ConstructionSubcontractor;
  project?: { id: string; name: string };
}

export async function adminGetSubcontractorRegister(
  token: string,
  params?: { active?: boolean; limit?: number; skip?: number },
): Promise<{ data: ConstructionSubcontractor[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.active != null) qs.set('active', String(params.active));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.skip) qs.set('skip', String(params.skip));
  const q = qs.toString();
  return apiFetch(`/admin/b3-construction/subcontractor-register${q ? `?${q}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateSubcontractorRecord(
  token: string,
  data: {
    name: string;
    registrationNo?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    speciality?: string;
    notes?: string;
  },
): Promise<ConstructionSubcontractor> {
  return apiFetch('/admin/b3-construction/subcontractor-register', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateSubcontractorRecord(
  token: string,
  id: string,
  data: Partial<Omit<ConstructionSubcontractor, 'id' | 'createdAt' | 'updatedAt' | 'engagements'>>,
): Promise<ConstructionSubcontractor> {
  return apiFetch(`/admin/b3-construction/subcontractor-register/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteSubcontractorRecord(
  token: string,
  id: string,
): Promise<ConstructionSubcontractor> {
  return apiFetch(`/admin/b3-construction/subcontractor-register/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Engagements (project-level)
export async function adminGetProjectEngagements(
  token: string,
  projectId: string,
): Promise<SubcontractorEngagement[]> {
  return apiFetch(`/admin/b3-construction/projects/${projectId}/subcontractor-engagements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateEngagement(
  token: string,
  projectId: string,
  data: {
    subcontractorId: string;
    description: string;
    agreedAmount: number;
    invoicedAmount?: number;
    paidAmount?: number;
    startDate?: string;
    endDate?: string;
    notes?: string;
  },
): Promise<SubcontractorEngagement> {
  return apiFetch(`/admin/b3-construction/projects/${projectId}/subcontractor-engagements`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateEngagement(
  token: string,
  id: string,
  data: Partial<Omit<SubcontractorEngagement, 'id' | 'subcontractorId' | 'projectId' | 'createdAt' | 'updatedAt' | 'subcontractor' | 'project'>>,
): Promise<SubcontractorEngagement> {
  return apiFetch(`/admin/b3-construction/subcontractor-engagements/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteEngagement(token: string, id: string): Promise<{ id: string }> {
  return apiFetch(`/admin/b3-construction/subcontractor-engagements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── B3 Construction — Client Invoices ─────────────────────────────────────────

export type ClientInvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface ConstructionClientInvoice {
  id: string;
  projectId: string;
  invoiceNo: string;
  issueDate: string;
  dueDate?: string | null;
  amount: number;
  vatAmount?: number | null;
  description?: string | null;
  status: ClientInvoiceStatus;
  paidAt?: string | null;
  paidAmount?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string; clientName?: string | null };
}

export async function adminGetClientInvoices(
  token: string,
  params?: { projectId?: string; status?: string; limit?: number; skip?: number },
): Promise<{ data: ConstructionClientInvoice[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set('projectId', params.projectId);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.skip) qs.set('skip', String(params.skip));
  const q = qs.toString();
  return apiFetch(`/admin/b3-construction/client-invoices${q ? `?${q}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminCreateClientInvoice(
  token: string,
  projectId: string,
  data: {
    invoiceNo: string;
    issueDate: string;
    dueDate?: string;
    amount: number;
    vatAmount?: number;
    description?: string;
    status?: ClientInvoiceStatus;
    notes?: string;
  },
): Promise<ConstructionClientInvoice> {
  return apiFetch(`/admin/b3-construction/projects/${projectId}/client-invoices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminUpdateClientInvoice(
  token: string,
  id: string,
  data: Partial<Omit<ConstructionClientInvoice, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'project'>>,
): Promise<ConstructionClientInvoice> {
  return apiFetch(`/admin/b3-construction/client-invoices/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function adminDeleteClientInvoice(token: string, id: string): Promise<{ id: string }> {
  return apiFetch(`/admin/b3-construction/client-invoices/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── B3Hub Platform Finance Stats ────────────────────────────────────────────

export interface AdminFinanceStats {
  gmv: {
    allTime: number;
    thisMonth: number;
    lastMonth: number;
    skipThisMonth: number;
    skipCountThisMonth: number;
  };
  commission: {
    allTime: number;
    thisMonth: number;
    lastMonth: number;
  };
  orders: {
    thisMonth: number;
    lastMonth: number;
  };
  pendingPayouts: {
    supplierAmount: number;
    supplierCount: number;
    carrierAmount: number;
    carrierCount: number;
    total: number;
    totalCount: number;
  };
  byOrderType: Array<{ type: string; gmv: number; count: number }>;
  monthlyTrend: Array<{ month: string; gmv: number; commission: number; orders: number }>;
}

export async function adminGetFinanceStats(token: string): Promise<AdminFinanceStats> {
  return apiFetch('/admin/finance-stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── APUS ──────────────────────────────────────────────────────────────────────

export type ApusStatus = 'NOT_REQUIRED' | 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

export interface ApusStats {
  pending: number;
  submitted: number;
  accepted: number;
  rejected: number;
  notRequired: number;
  total: number;
}

export interface ApusWasteRecord {
  id: string;
  wasteType: string;
  weight: number;
  volume: number | null;
  processedDate: string | null;
  apusStatus: ApusStatus;
  apusSubmissionId: string | null;
  apusSubmittedAt: string | null;
  apusNote: string | null;
  bisNumber: string | null;
  certificateUrl: string | null;
  createdAt: string;
  recyclingCenter: { id: string; name: string; city: string; licensed: boolean };
  order: { id: string; orderNumber: string } | null;
  containerOrder: {
    id: string;
    order: { id: string; orderNumber: string } | null;
  } | null;
}

export async function adminGetApusStats(token: string, centerId?: string): Promise<ApusStats> {
  const qs = centerId ? `?centerId=${centerId}` : '';
  return apiFetch(`/admin/b3-recycling/apus-stats${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminGetApusRecords(
  token: string,
  params?: { page?: number; limit?: number; centerId?: string; status?: string },
): Promise<PaginatedResponse<ApusWasteRecord>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.centerId) qs.set('centerId', params.centerId);
  if (params?.status) qs.set('status', params.status);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/admin/b3-recycling/apus-records${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminApusSubmitRecord(
  token: string,
  wasteRecordId: string,
): Promise<ApusWasteRecord> {
  return apiFetch(`/admin/b3-recycling/waste-records/${wasteRecordId}/apus-submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function adminApusBulkSubmit(
  token: string,
  centerId: string,
): Promise<{ submitted: number; failed: number; total: number }> {
  return apiFetch('/admin/b3-recycling/apus-bulk-submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ centerId }),
  });
}

export async function adminApusSetStatus(
  token: string,
  wasteRecordId: string,
  status: ApusStatus,
  note?: string,
): Promise<ApusWasteRecord> {
  return apiFetch(`/admin/b3-recycling/waste-records/${wasteRecordId}/apus-status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  });
}
