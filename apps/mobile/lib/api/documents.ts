import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'INVOICE'
  | 'WEIGHING_SLIP'
  | 'DELIVERY_NOTE'
  | 'CMR_NOTE'
  | 'CONTRACT';

export type DocumentStatus = 'DRAFT' | 'ISSUED' | 'EXPIRED' | 'ARCHIVED';

export interface ApiDocument {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl: string | null;
  mimeType: string | null;
  orderId: string | null;
  transportJobId: string | null;
  isGenerated: boolean;
  notes: string | null;
  createdAt: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const documentsApi = {
  documents: {
    getByOrder: (orderId: string, token: string) =>
      apiFetch<ApiDocument[]>(`/documents?orderId=${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getAll: (token: string) =>
      apiFetch<ApiDocument[]>('/documents', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  reviews: {
    /** Buyer: submit a rating for a completed order. */
    create: (
      dto: {
        rating: number;
        comment?: string;
        orderId?: string;
        skipOrderId?: string;
      },
      token: string,
    ) =>
      apiFetch<{ id: string }>('/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    /** Check whether the user already reviewed an order. */
    status: (params: { orderId?: string; skipOrderId?: string }, token: string) => {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).filter(([, v]) => v != null) as [string, string][],
        ),
      ).toString();
      return apiFetch<{ reviewed: boolean }>(`/reviews/status?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },

    /** Get all reviews for a company (public). */
    byCompany: (companyId: string, token: string) =>
      apiFetch<{ id: string; rating: number; comment?: string; createdAt: string }[]>(
        `/reviews/company/${companyId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
  },
};
