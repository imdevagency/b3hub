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
  },
};
