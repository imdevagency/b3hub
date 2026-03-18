/**
 * Documents API module.
 * Functions to upload, list, get download URL, and action compliance documents.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'INVOICE'
  | 'WEIGHING_SLIP'
  | 'DELIVERY_PROOF'
  | 'WASTE_CERTIFICATE'
  | 'DELIVERY_NOTE'
  | 'CONTRACT'
  | 'OTHER';

export type DocumentStatus = 'DRAFT' | 'ISSUED' | 'SIGNED' | 'ARCHIVED';

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: number;
  orderId?: string;
  invoiceId?: string;
  transportJobId?: string;
  wasteRecordId?: string;
  skipHireId?: string;
  ownerId: string;
  issuedBy?: string;
  isGenerated: boolean;
  notes?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  total: number;
  byType: Partial<Record<DocumentType, number>>;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyDocuments(
  token: string,
  params?: {
    type?: DocumentType;
    status?: DocumentStatus;
    orderId?: string;
    search?: string;
  },
): Promise<{ documents: Document[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.status) qs.set('status', params.status);
  if (params?.orderId) qs.set('orderId', params.orderId);
  if (params?.search) qs.set('search', params.search);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/documents${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getDocumentSummary(token: string): Promise<DocumentSummary> {
  return apiFetch('/documents/summary', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
