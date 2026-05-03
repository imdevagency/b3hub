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
  processingStatus?: string | null;
  certificateUrl?: string | null;
  createdAt: string;
  recyclingCenter?: { id: string; name: string } | null;
}

export async function getRecyclerIncomingJobs(token: string): Promise<RecyclerIncomingJob[]> {
  return apiFetch<RecyclerIncomingJob[]>('/recycling-centers/mine-incoming-jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getRecyclerWasteRecords(token: string): Promise<RecyclerWasteRecord[]> {
  return apiFetch<RecyclerWasteRecord[]>('/recycling-centers/waste-records/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
