import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';

export interface ApiProjectFinancials {
  contractValue: number;
  budgetAmount: number | null;
  materialCosts: number;
  pendingCosts: number;
  grossMargin: number;
  marginPct: number | null;
  budgetUsedPct: number | null;
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
  frameworkContracts: {
    id: string;
    contractNumber: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string | null;
    supplier: { id: string; name: string } | null;
  }[];
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

// ─── API ──────────────────────────────────────────────────────────────────

export const projectsApi = {
  projects: {
    getAll: (token: string) =>
      apiFetch<ApiProject[]>('/projects', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getOne: (id: string, token: string) =>
      apiFetch<ApiProjectDetail>(`/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (data: CreateProjectInput, token: string) =>
      apiFetch<ApiProject>('/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateProjectInput, token: string) =>
      apiFetch<ApiProject>(`/projects/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    assignOrders: (id: string, orderIds: string[], token: string) =>
      apiFetch<ApiProject>(`/projects/${id}/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderIds }),
      }),

    unassignOrder: (projectId: string, orderId: string, token: string) =>
      apiFetch<ApiProject>(`/projects/${projectId}/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),

    getDocuments: (id: string, token: string) =>
      apiFetch<ApiProjectDocument[]>(`/projects/${id}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getSites: (id: string, token: string) =>
      apiFetch<ApiProjectSite[]>(`/projects/${id}/sites`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    addSite: (id: string, data: CreateProjectSiteInput, token: string) =>
      apiFetch<ApiProjectSite>(`/projects/${id}/sites`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    updateSite: (id: string, siteId: string, data: Partial<CreateProjectSiteInput>, token: string) =>
      apiFetch<ApiProjectSite>(`/projects/${id}/sites/${siteId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    removeSite: (id: string, siteId: string, token: string) =>
      apiFetch<{ deleted: number }>(`/projects/${id}/sites/${siteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
