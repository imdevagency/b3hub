/**
 * Construction ERP API — company-scoped.
 * All endpoints require JWT + CONSTRUCTION_MANAGEMENT feature flag.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

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
  _count?: { orders: number };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function getConstructionProjects(
  token: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<Paginated<ConstructionProject>> {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return apiFetch(`/construction/projects?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const constructionApi = {
  getProjects: getConstructionProjects,
};
