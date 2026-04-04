/**
 * Dispute/Claims API for the web portal.
 */
import { apiFetch } from './common';

export type DisputeReason =
  | 'SHORT_DELIVERY'
  | 'WRONG_MATERIAL'
  | 'DAMAGE'
  | 'LATE_DELIVERY'
  | 'NO_DELIVERY'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface ApiDispute {
  id: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedAt: string | null;
  orderId: string;
  raisedById: string;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    deliveryAddress: string;
  };
  raisedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
}

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  SHORT_DELIVERY: 'Nepietiekams daudzums',
  WRONG_MATERIAL: 'Nepareizs materiāls',
  DAMAGE: 'Bojājumi piegādes laikā',
  LATE_DELIVERY: 'Piegāde kavējas',
  NO_DELIVERY: 'Nav saņemta piegāde',
  QUALITY_ISSUE: 'Kvalitātes problēma',
  OTHER: 'Cits jautājums',
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: 'Jauns',
  UNDER_REVIEW: 'Izskatīšanā',
  RESOLVED: 'Atrisināts',
  REJECTED: 'Noraidīts',
};

export function getDisputeStatusColor(status: DisputeStatus): string {
  switch (status) {
    case 'OPEN': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'UNDER_REVIEW': return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'RESOLVED': return 'text-green-700 bg-green-50 border-green-200';
    case 'REJECTED': return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

export function listDisputes(token: string, orderId?: string): Promise<ApiDispute[]> {
  const qs = orderId ? `?orderId=${encodeURIComponent(orderId)}` : '';
  return apiFetch<ApiDispute[]>(`/disputes${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateDispute(
  id: string,
  data: { status?: DisputeStatus; resolution?: string },
  token: string,
): Promise<ApiDispute> {
  return apiFetch<ApiDispute>(`/disputes/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
