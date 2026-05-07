/**
 * Construction ERP API — company-scoped.
 * All endpoints require JWT + CONSTRUCTION_MANAGEMENT feature flag.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type DailyReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

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

export interface DailyReportLine {
  costCode: string;
  description: string;
  quantity: number;
  unit: string;
  unitRate: number;
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

// ─── Daily Reports ──────────────────────────────────────────────────────────

export async function getConstructionDailyReports(
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

export async function createConstructionDailyReport(
  data: {
    projectId: string;
    reportDate: string;
    siteLabel?: string;
    weatherNote?: string;
    notes?: string;
    lines?: DailyReportLine[];
  },
  token: string,
): Promise<DailyReport> {
  return apiFetch('/construction/daily-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export const constructionApi = {
  getProjects: getConstructionProjects,
  getDailyReports: getConstructionDailyReports,
  createDailyReport: createConstructionDailyReport,
};
