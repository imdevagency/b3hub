/**
 * Recycler portal API client — wraps /api/v1/recycling-centers/* company-scoped endpoints
 */

import { apiFetch } from './common';

export type RecyclerJobStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'EN_ROUTE_DROPOFF'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RecyclerIncomingJob {
  id: string;
  status: RecyclerJobStatus;
  jobType: string;
  createdAt: string;
  scheduledAt?: string;
  recyclingCenter?: { id: string; name: string; address?: string } | null;
  requester?: { id: string; firstName: string; lastName: string; phone?: string } | null;
  vehicle?: { id: string; licensePlate: string; vehicleType: string } | null;
}

export interface RecyclerWasteRecord {
  id: string;
  wasteType: string;
  weightKg?: number | null;
  recyclableWeight?: number | null;
  recyclingRate?: number | null;
  processingStage?: string | null;
  rcGrade?: string | null;
  weighbridgeTicketRef?: string | null;
  producedMaterialId?: string | null;
  processingStatus?: string | null;
  certificateUrl?: string | null;
  apusStatus?: string | null;
  apusSubmissionId?: string | null;
  apusNote?: string | null;
  apusSubmittedAt?: string | null;
  createdAt: string;
  recyclingCenter?: { id: string; name: string } | null;
}

export interface PricingRule {
  id: string;
  recyclingCenterId: string;
  wasteType: string;
  pricePerTonne: number;
  minimumWeight: number | null;
  minimumFee: number | null;
  maximumWeight: number | null;
  accepted: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertPricingRulePayload {
  wasteType: string;
  pricePerTonne: number;
  minimumWeight?: number | null;
  minimumFee?: number | null;
  maximumWeight?: number | null;
  accepted?: boolean;
  notes?: string | null;
}

export async function recyclerGetPricingRules(
  token: string,
  centerId: string,
): Promise<PricingRule[]> {
  return apiFetch(`/recycling-centers/${centerId}/pricing-rules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function recyclerUpsertPricingRule(
  token: string,
  centerId: string,
  payload: UpsertPricingRulePayload,
): Promise<PricingRule> {
  return apiFetch(`/recycling-centers/${centerId}/pricing-rules`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function recyclerDeletePricingRule(
  token: string,
  centerId: string,
  wasteType: string,
): Promise<void> {
  return apiFetch(`/recycling-centers/${centerId}/pricing-rules/${wasteType}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function recyclerCreateListing(
  token: string,
  recordId: string,
  data: { basePrice: number; name?: string },
): Promise<{ wasteRecord: RecyclerWasteRecord; material: { id: string; name: string } }> {
  return apiFetch(`/recycling-centers/waste-records/${recordId}/create-listing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function recyclerUpdateWasteRecord(
  token: string,
  centerId: string,
  recordId: string,
  data: {
    processingStage?: string;
    recyclableWeight?: number;
    recyclingRate?: number;
    rcGrade?: string;
    apusStatus?: string;
    apusSubmissionId?: string;
    apusNote?: string;
    processedDate?: string;
  },
): Promise<RecyclerWasteRecord> {
  return apiFetch(`/recycling-centers/${centerId}/waste-records/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function recyclerCancelIncomingJob(
  token: string,
  centerId: string,
  jobId: string,
): Promise<{ id: string; status: string }> {
  return apiFetch(`/recycling-centers/${centerId}/incoming-jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
