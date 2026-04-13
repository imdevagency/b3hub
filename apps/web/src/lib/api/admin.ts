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
    firstName: string;
    lastName: string;
    email?: string;
    company: { id: string; name: string } | null;
  };
  items: { id: string }[];
  transportJobs: { id: string; status: string }[];
}

export async function adminGetOrders(token: string): Promise<AdminOrder[]> {
  return apiFetch<AdminOrder[]>('/admin/orders', {
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
  return apiFetch<AdminTransportJob[]>('/admin/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
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
