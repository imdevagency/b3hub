/**
 * Field Passes API module — /api/v1/field-passes
 */
import { apiFetch } from './common';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FieldPassStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface ApiFieldPass {
  id: string;
  passNumber: string;
  companyId: string;
  contractId: string;
  vehiclePlate: string;
  driverName?: string | null;
  validFrom: string;
  validTo: string;
  wasteClassCode?: string | null;
  wasteDescription?: string | null;
  unloadingPoint?: string | null;
  estimatedTonnes?: number | null;
  actualNetTonnes?: number | null;
  status: FieldPassStatus;
  fileUrl?: string | null;
  revokedReason?: string | null;
  revokedAt?: string | null;
  orderId?: string | null;
  createdAt: string;
  company?: { name: string; legalName: string; registrationNum?: string | null };
  contract?: { contractNumber: string; title: string; prepaidBalance?: number; prepaidUsed?: number };
  createdBy?: { firstName: string; lastName: string };
}

export interface CreateFieldPassInput {
  contractId: string;
  vehiclePlate: string;
  driverName?: string;
  validFrom: string;
  validTo: string;
  wasteClassCode?: string;
  wasteDescription?: string;
  unloadingPoint?: string;
  estimatedTonnes?: number;
  orderId?: string;
}

// ─── Functions ──────────────────────────────────────────────────────────────

export async function getFieldPasses(token: string): Promise<ApiFieldPass[]> {
  return apiFetch<ApiFieldPass[]>('/field-passes', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getFieldPassesAdmin(token: string): Promise<ApiFieldPass[]> {
  return apiFetch<ApiFieldPass[]>('/field-passes/admin', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getFieldPass(id: string, token: string): Promise<ApiFieldPass> {
  return apiFetch<ApiFieldPass>(`/field-passes/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createFieldPass(
  input: CreateFieldPassInput,
  token: string,
): Promise<ApiFieldPass> {
  return apiFetch<ApiFieldPass>('/field-passes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export async function revokeFieldPass(
  id: string,
  reason: string,
  token: string,
): Promise<ApiFieldPass> {
  return apiFetch<ApiFieldPass>(`/field-passes/${id}/revoke`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

export async function createAdvanceInvoice(
  contractId: string,
  amount: number,
  notes: string | undefined,
  token: string,
) {
  return apiFetch(`/framework-contracts/${contractId}/advance-invoice`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount, notes }),
  });
}

export async function markAdvancePaid(invoiceId: string, token: string) {
  return apiFetch(`/framework-contracts/advance-invoices/${invoiceId}/mark-paid`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ApiAdvanceInvoice {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  paidDate?: string | null;
  createdAt: string;
}

export async function getAdvanceInvoices(
  contractId: string,
  token: string,
): Promise<ApiAdvanceInvoice[]> {
  return apiFetch<ApiAdvanceInvoice[]>(
    `/framework-contracts/${contractId}/advance-invoices`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

// ─── Weighing Slips ──────────────────────────────────────────────────────────

export interface ApiWeighingSlip {
  id: string;
  slipNumber: string;
  passId: string;
  grossTonnes: number;
  tareTonnes: number;
  netTonnes: number;
  operatorName?: string | null;
  operatorCompany?: string | null;
  notes?: string | null;
  fileUrl?: string | null;
  voidedAt?: string | null;
  voidedReason?: string | null;
  createdAt: string;
  fieldPass?: { passNumber: string; vehiclePlate: string; driverName?: string | null } | null;
}

export interface CreateWeighingSlipInput {
  passId: string;
  grossTonnes: number;
  tareTonnes: number;
  operatorName?: string;
  operatorCompany?: string;
  notes?: string;
}

export async function getWeighingSlipsAdmin(token: string): Promise<ApiWeighingSlip[]> {
  return apiFetch<ApiWeighingSlip[]>('/weighing-slips/admin', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getWeighingSlipsByPass(
  passId: string,
  token: string,
): Promise<ApiWeighingSlip[]> {
  return apiFetch<ApiWeighingSlip[]>(`/weighing-slips/pass/${passId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createWeighingSlip(
  input: CreateWeighingSlipInput,
  token: string,
): Promise<ApiWeighingSlip> {
  return apiFetch<ApiWeighingSlip>('/weighing-slips', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
}

export async function voidWeighingSlip(
  id: string,
  reason: string,
  token: string,
): Promise<ApiWeighingSlip> {
  return apiFetch<ApiWeighingSlip>(`/weighing-slips/${id}/void`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}
