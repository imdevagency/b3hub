/**
 * Projects API module.
 * Functions wrapping /api/v1/projects/* endpoints.
 * Construction project management — group orders, track P&L against contract value.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

export interface ApiProjectFinancials {
  contractValue: number;
  budgetAmount: number | null;
  materialCosts: number;
  pendingCosts: number;
  grossMargin: number;
  marginPct: number;
  budgetUsedPct: number | null;
  co2Kg: number;
  co2Tonnes: number;
}

export interface ApiProjectOrder {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  total: number;
  deliveryAddress: string;
  deliveryDate: string | null;
  createdAt: string;
  items: {
    material: { name: string; category: string } | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }[];
}

export interface ApiProject extends ApiProjectFinancials {
  id: string;
  name: string;
  description: string | null;
  clientName: string | null;
  siteAddress: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProjectDetail extends ApiProject {
  createdBy: { id: string; firstName: string; lastName: string; email: string | null };
  orders: ApiProjectOrder[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  clientName?: string;
  siteAddress?: string;
  contractValue: number;
  budgetAmount?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: ProjectStatus;
}

export type ProjectSiteType = 'LOADING' | 'UNLOADING' | 'BOTH';

export interface ApiProjectSite {
  id: string;
  projectId: string;
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
  type: ProjectSiteType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectSiteInput {
  label: string;
  address: string;
  lat?: number;
  lng?: number;
  type?: ProjectSiteType;
  isDefault?: boolean;
}

export interface ApiProjectDocument {
  id: string;
  title: string;
  type: string;
  status: string;
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  isGenerated: boolean;
  role: string;
  createdAt: string;
}

// ─── API functions ─────────────────────────────────────────────────────────

export function getProjects(token: string): Promise<ApiProject[]> {
  return apiFetch('/projects', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getProject(id: string, token: string): Promise<ApiProjectDetail> {
  return apiFetch(`/projects/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createProject(
  input: CreateProjectInput,
  token: string,
): Promise<ApiProject> {
  return apiFetch('/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function updateProject(
  id: string,
  input: UpdateProjectInput,
  token: string,
): Promise<ApiProject> {
  return apiFetch(`/projects/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function assignOrders(
  projectId: string,
  orderIds: string[],
  token: string,
): Promise<{ assigned: number }> {
  return apiFetch(`/projects/${projectId}/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderIds }),
  });
}

export function unassignOrder(
  projectId: string,
  orderId: string,
  token: string,
): Promise<{ unassigned: number }> {
  return apiFetch(`/projects/${projectId}/orders/${orderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getProjectFinancials(
  projectId: string,
  token: string,
): Promise<ApiProjectFinancials> {
  return apiFetch(`/projects/${projectId}/financials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getProjectDocuments(
  projectId: string,
  token: string,
): Promise<ApiProjectDocument[]> {
  return apiFetch(`/projects/${projectId}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getProjectSites(projectId: string, token: string): Promise<ApiProjectSite[]> {
  return apiFetch(`/projects/${projectId}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function addProjectSite(
  projectId: string,
  input: CreateProjectSiteInput,
  token: string,
): Promise<ApiProjectSite> {
  return apiFetch(`/projects/${projectId}/sites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function updateProjectSite(
  projectId: string,
  siteId: string,
  input: Partial<CreateProjectSiteInput>,
  token: string,
): Promise<ApiProjectSite> {
  return apiFetch(`/projects/${projectId}/sites/${siteId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export function removeProjectSite(
  projectId: string,
  siteId: string,
  token: string,
): Promise<{ deleted: number }> {
  return apiFetch(`/projects/${projectId}/sites/${siteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
