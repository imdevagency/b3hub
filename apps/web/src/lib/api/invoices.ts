/**
 * Invoices API module.
 * Functions to list, fetch, and update invoices via /api/v1/invoices/*.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  orderId?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  paymentStatus: PaymentStatus;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    orderType: string;
    status: string;
  } | null;
  /** Present when this is an advance invoice for a field contract */
  advanceForContract?: {
    id: string;
    contractNumber: string;
    title: string;
  } | null;
}

export interface InvoiceListResponse {
  data: ApiInvoice[];
  meta: { page: number; limit: number; total: number };
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyInvoices(
  token: string,
  page = 1,
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED',
): Promise<InvoiceListResponse> {
  const qs = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) qs.set('status', status);
  return apiFetch<InvoiceListResponse>(`/invoices?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getInvoiceById(id: string, token: string): Promise<ApiInvoice> {
  return apiFetch<ApiInvoice>(`/invoices/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getInvoicesByOrder(orderId: string, token: string): Promise<ApiInvoice[]> {
  return apiFetch<ApiInvoice[]>(`/invoices/order/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markInvoicePaid(id: string, token: string): Promise<ApiInvoice> {
  return apiFetch<ApiInvoice>(`/invoices/${id}/pay`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}
