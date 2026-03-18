import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: string;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  order?: { id: string; orderNumber: string } | null;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const invoicesApi = {
  invoices: {
    getAll: (token: string) =>
      apiFetch<ApiInvoice[]>('/invoices', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getByOrder: (orderId: string, token: string) =>
      apiFetch<ApiInvoice[]>(`/invoices/order/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getOne: (id: string, token: string) =>
      apiFetch<ApiInvoice>(`/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    markAsPaid: (id: string, token: string) =>
      apiFetch<ApiInvoice>(`/invoices/${id}/pay`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
