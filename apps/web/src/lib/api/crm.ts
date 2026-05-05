import { apiFetch } from './common';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
export type LeadSource = 'PLATFORM' | 'WHATSAPP' | 'EMAIL' | 'PHONE' | 'REFERRAL' | 'OTHER';
export type LeadType = 'BUYER' | 'SUPPLIER' | 'CARRIER' | 'RECYCLER' | 'OTHER';
export type BuContextCrm = 'MARKETPLACE' | 'CONSTRUCTION' | 'RECYCLING' | 'UNASSIGNED';

export interface CrmNote {
  id: string;
  leadId: string;
  content: string;
  authorId: string;
  createdAt: string;
}

export interface CrmTask {
  id: string;
  leadId: string;
  title: string;
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  linkedUserId: string | null;
  linkedCompanyId: string | null;
  type: LeadType;
  source: LeadSource;
  status: LeadStatus;
  buContext: BuContextCrm;
  value: number | null;
  description: string | null;
  assignedTo: string | null;
  notes: CrmNote[];
  tasks: CrmTask[];
  _count?: { notes: number; tasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface PipelineItem {
  status: LeadStatus;
  count: number;
  totalValue: number;
}

export interface CreateLeadInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  linkedUserId?: string;
  linkedCompanyId?: string;
  type?: LeadType;
  source?: LeadSource;
  status?: LeadStatus;
  buContext?: BuContextCrm;
  value?: number;
  description?: string;
  assignedTo?: string;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

// ─── Pipeline ────────────────────────────────────────────────────────────────

export function getPipelineSummary(token: string): Promise<PipelineItem[]> {
  return apiFetch('/crm/pipeline', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export function listLeads(
  token: string,
  filters?: { status?: LeadStatus; buContext?: BuContextCrm; search?: string },
): Promise<CrmLead[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.buContext) params.set('buContext', filters.buContext);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/crm/leads${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getLead(token: string, id: string): Promise<CrmLead> {
  return apiFetch(`/crm/leads/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createLead(token: string, data: CreateLeadInput): Promise<CrmLead> {
  return apiFetch('/crm/leads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateLead(token: string, id: string, data: UpdateLeadInput): Promise<CrmLead> {
  return apiFetch(`/crm/leads/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteLead(token: string, id: string): Promise<void> {
  return apiFetch(`/crm/leads/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function addNote(token: string, leadId: string, content: string): Promise<CrmNote> {
  return apiFetch(`/crm/leads/${leadId}/notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export function deleteNote(token: string, leadId: string, noteId: string): Promise<void> {
  return apiFetch(`/crm/leads/${leadId}/notes/${noteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function addTask(
  token: string,
  leadId: string,
  data: { title: string; dueAt?: string; assignedTo?: string },
): Promise<CrmTask> {
  return apiFetch(`/crm/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateTask(
  token: string,
  leadId: string,
  taskId: string,
  data: { title?: string; dueAt?: string; done?: boolean; assignedTo?: string },
): Promise<CrmTask> {
  return apiFetch(`/crm/leads/${leadId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deleteTask(token: string, leadId: string, taskId: string): Promise<void> {
  return apiFetch(`/crm/leads/${leadId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
