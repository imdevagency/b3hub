/**
 * Construction ERP API — company-scoped.
 * All endpoints sit under /api/v1/construction/* and require
 * JwtAuthGuard + CONSTRUCTION_MANAGEMENT feature flag.
 */
import { apiFetch } from './common';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';
export type ClientInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

export interface ConstructionProject {
  id: string;
  name: string;
  description?: string | null;
  clientName?: string | null;
  siteAddress?: string | null;
  status: ProjectStatus;
  contractValue: number;
  budgetAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  _count?: { orders: number; dailyReports: number; clientInvoices: number };
}

export interface DailyReport {
  id: string;
  projectId: string;
  reportDate: string;
  siteLabel?: string | null;
  weatherNote?: string | null;
  notes?: string | null;
  status: DailyReportStatus;
  totalCost: number;
  createdAt: string;
  project?: { id: string; name: string };
  createdBy?: { id: string; firstName: string; lastName: string };
  _count?: { lines: number };
}

export interface DailyReportDetail extends DailyReport {
  lines: Array<{
    id: string;
    costCode: string;
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    total: number;
    rateEntry?: { id: string; name: string; unit: string; pricePerUnit: number } | null;
    employee?: { id: string; firstName: string; lastName: string; role: string } | null;
  }>;
}

export interface DprTemplate {
  id: string;
  name: string;
  description?: string | null;
  projectId?: string | null;
  active: boolean;
  createdAt: string;
  project?: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    costCode: string;
    description: string;
    quantity: number;
    unit: string;
    unitRate: number;
    rateEntry?: { id: string; name: string; unit: string; pricePerUnit: number } | null;
    employee?: { id: string; firstName: string; lastName: string; role: string } | null;
    sortOrder: number;
  }>;
}

export interface RateEntry {
  id: string;
  name: string;
  unit: string;
  category: string;
  supplierName: string;
  supplierNote?: string | null;
  pricePerUnit: number;
  deliveryFee: number;
  selfCostPerUnit?: number | null;
  densityCoeff?: number | null;
  notes?: string | null;
  companyId?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface ConstructionEmployee {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  personalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active: boolean;
  defaultRateEntry?: { id: string; name: string; unit: string } | null;
  createdAt: string;
}

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
  companyId?: string | null;
  _count?: { engagements: number };
  createdAt: string;
}

export interface SubcontractorEngagement {
  id: string;
  projectId: string;
  subcontractorId: string;
  description: string;
  agreedAmount: number;
  startDate?: string | null;
  endDate?: string | null;
  paidAmount?: number | null;
  notes?: string | null;
  createdAt: string;
  subcontractor?: { id: string; name: string; speciality?: string | null };
}

export interface ClientInvoice {
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
  project?: { id: string; name: string; clientName?: string | null };
}

export interface ProjectBudgetLine {
  id: string;
  projectId: string;
  costCode: string;
  budgetAmount: number;
  notes?: string | null;
}

export interface ProfitabilityProject {
  id: string;
  name: string;
  contractValue: number;
  budgetAmount?: number | null;
  status: ProjectStatus;
  dprCost: number;
  margin: number;
  marginPct: number;
  budgetLines: ProjectBudgetLine[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getConstructionProjects(
  token: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<Paginated<ConstructionProject>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/projects?${q}`, { headers: { Authorization: `Bearer ${token}` } });
}

export async function getConstructionProjectById(
  id: string,
  token: string,
): Promise<ConstructionProject> {
  return apiFetch(`/construction/projects/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createConstructionProject(
  data: Omit<ConstructionProject, 'id' | 'createdAt' | 'updatedAt' | '_count' | 'createdBy'>,
  token: string,
): Promise<ConstructionProject> {
  return apiFetch('/construction/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateConstructionProject(
  id: string,
  data: Partial<ConstructionProject>,
  token: string,
): Promise<ConstructionProject> {
  return apiFetch(`/construction/projects/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Budget Lines ─────────────────────────────────────────────────────────────

export async function getProjectBudgetLines(projectId: string, token: string): Promise<ProjectBudgetLine[]> {
  return apiFetch(`/construction/projects/${projectId}/budget-lines`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setProjectBudgetLines(
  projectId: string,
  lines: Array<{ costCode: string; budgetAmount: number; notes?: string }>,
  token: string,
): Promise<{ count: number }> {
  return apiFetch(`/construction/projects/${projectId}/budget-lines`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lines }),
  });
}

// ─── Daily Reports ─────────────────────────────────────────────────────────────

export async function getDailyReports(
  token: string,
  params: { projectId?: string; status?: string; page?: number; limit?: number } = {},
): Promise<Paginated<DailyReport>> {
  const q = new URLSearchParams();
  if (params.projectId) q.set('projectId', params.projectId);
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/daily-reports?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getDailyReportById(id: string, token: string): Promise<DailyReportDetail> {
  return apiFetch(`/construction/daily-reports/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createDailyReport(data: any, token: string): Promise<DailyReportDetail> {
  return apiFetch('/construction/daily-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateDailyReport(
  id: string,
  data: Partial<{ status: string; notes: string; weatherNote: string; siteLabel: string }>,
  token: string,
): Promise<DailyReport> {
  return apiFetch(`/construction/daily-reports/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteDailyReport(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/daily-reports/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── DPR Templates ─────────────────────────────────────────────────────────────

export async function getDprTemplates(
  token: string,
  params: { projectId?: string } = {},
): Promise<DprTemplate[]> {
  const q = new URLSearchParams();
  if (params.projectId) q.set('projectId', params.projectId);
  return apiFetch(`/construction/dpr-templates?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createDprTemplate(data: any, token: string): Promise<DprTemplate> {
  return apiFetch('/construction/dpr-templates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateDprTemplate(
  id: string,
  data: Partial<DprTemplate>,
  token: string,
): Promise<DprTemplate> {
  return apiFetch(`/construction/dpr-templates/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteDprTemplate(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/dpr-templates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Rate Entries ─────────────────────────────────────────────────────────────

export async function getRateEntries(
  token: string,
  params: { category?: string; page?: number; limit?: number } = {},
): Promise<Paginated<RateEntry>> {
  const q = new URLSearchParams();
  if (params.category) q.set('category', params.category);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/rates?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createRateEntry(data: Omit<RateEntry, 'id' | 'effectiveFrom' | 'companyId'>, token: string): Promise<RateEntry> {
  return apiFetch('/construction/rates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateRateEntry(id: string, data: Partial<RateEntry>, token: string): Promise<RateEntry> {
  return apiFetch(`/construction/rates/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteRateEntry(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/rates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Employees ─────────────────────────────────────────────────────────────────

export async function getConstructionEmployees(
  token: string,
  params: { activeOnly?: boolean; page?: number; limit?: number } = {},
): Promise<Paginated<ConstructionEmployee>> {
  const q = new URLSearchParams();
  if (params.activeOnly) q.set('activeOnly', 'true');
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/employees?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createConstructionEmployee(data: Omit<ConstructionEmployee, 'id' | 'createdAt' | 'defaultRateEntry'>, token: string): Promise<ConstructionEmployee> {
  return apiFetch('/construction/employees', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateConstructionEmployee(id: string, data: Partial<ConstructionEmployee>, token: string): Promise<ConstructionEmployee> {
  return apiFetch(`/construction/employees/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteConstructionEmployee(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/employees/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Subcontractors ───────────────────────────────────────────────────────────

export async function getConstructionSubcontractors(
  token: string,
  params: { active?: boolean; page?: number; limit?: number } = {},
): Promise<Paginated<ConstructionSubcontractor>> {
  const q = new URLSearchParams();
  if (params.active !== undefined) q.set('active', String(params.active));
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/subcontractors?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createConstructionSubcontractor(
  data: Omit<ConstructionSubcontractor, 'id' | 'createdAt' | '_count' | 'companyId'>,
  token: string,
): Promise<ConstructionSubcontractor> {
  return apiFetch('/construction/subcontractors', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateConstructionSubcontractor(
  id: string,
  data: Partial<ConstructionSubcontractor>,
  token: string,
): Promise<ConstructionSubcontractor> {
  return apiFetch(`/construction/subcontractors/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteConstructionSubcontractor(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/subcontractors/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSubcontractorEngagements(projectId: string, token: string): Promise<SubcontractorEngagement[]> {
  return apiFetch(`/construction/projects/${projectId}/subcontractor-engagements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createSubcontractorEngagement(projectId: string, data: any, token: string): Promise<SubcontractorEngagement> {
  return apiFetch(`/construction/projects/${projectId}/subcontractor-engagements`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateSubcontractorEngagement(id: string, data: any, token: string): Promise<SubcontractorEngagement> {
  return apiFetch(`/construction/subcontractor-engagements/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteSubcontractorEngagement(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/subcontractor-engagements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Client Invoices ──────────────────────────────────────────────────────────

export async function getClientInvoices(
  token: string,
  params: { projectId?: string; status?: string; limit?: number } = {},
): Promise<{ data: ClientInvoice[]; total: number }> {
  const q = new URLSearchParams();
  if (params.projectId) q.set('projectId', params.projectId);
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/client-invoices?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createClientInvoice(projectId: string, data: any, token: string): Promise<ClientInvoice> {
  return apiFetch(`/construction/projects/${projectId}/client-invoices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateClientInvoice(id: string, data: any, token: string): Promise<ClientInvoice> {
  return apiFetch(`/construction/client-invoices/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteClientInvoice(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/client-invoices/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Profitability ─────────────────────────────────────────────────────────────

export async function getConstructionProfitability(
  token: string,
  params: { projectId?: string; from?: string; to?: string } = {},
): Promise<{ projects: ProfitabilityProject[] }> {
  const q = new URLSearchParams();
  if (params.projectId) q.set('projectId', params.projectId);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return apiFetch(`/construction/profitability?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getConstructionClients(token: string): Promise<{ name: string }[]> {
  return apiFetch('/construction/clients', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Equipment ────────────────────────────────────────────────────────────────

export type EquipmentType = 'EXCAVATOR' | 'DUMPER' | 'ROLLER' | 'COMPACTOR' | 'CRANE' | 'OTHER';
export type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE';

export interface ConstructionEquipment {
  id: string;
  name: string;
  type: EquipmentType;
  licensePlate: string;
  yearManufactured: number;
  status: EquipmentStatus;
  hourlyRate: number;
  assignedProject?: string | null;
  notes?: string | null;
  createdAt: string;
}

export async function getConstructionEquipment(
  token: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<Paginated<ConstructionEquipment>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/equipment?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createConstructionEquipment(
  data: Omit<ConstructionEquipment, 'id' | 'createdAt'>,
  token: string,
): Promise<ConstructionEquipment> {
  return apiFetch('/construction/equipment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateConstructionEquipment(
  id: string,
  data: Partial<ConstructionEquipment>,
  token: string,
): Promise<ConstructionEquipment> {
  return apiFetch(`/construction/equipment/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteConstructionEquipment(id: string, token: string): Promise<void> {
  return apiFetch(`/construction/equipment/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Project Sites ─────────────────────────────────────────────────────────────

export type ProjectSiteType = 'LOADING' | 'UNLOADING' | 'BOTH';

export interface ProjectSite {
  id: string;
  projectId: string;
  label: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  type: ProjectSiteType;
  isDefault: boolean;
  createdAt: string;
}

export async function getProjectSites(projectId: string, token: string): Promise<ProjectSite[]> {
  return apiFetch(`/construction/projects/${projectId}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createProjectSite(
  projectId: string,
  data: { label: string; address: string; lat?: number; lng?: number; type?: ProjectSiteType; isDefault?: boolean },
  token: string,
): Promise<ProjectSite> {
  return apiFetch(`/construction/projects/${projectId}/sites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteProjectSite(
  projectId: string,
  siteId: string,
  token: string,
): Promise<void> {
  return apiFetch(`/construction/projects/${projectId}/sites/${siteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── DPR Approve ──────────────────────────────────────────────────────────────

export async function approveDailyReport(id: string, token: string): Promise<DailyReport> {
  return apiFetch(`/construction/daily-reports/${id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}
