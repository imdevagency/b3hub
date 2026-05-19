/**
 * Recycling centers API module.
 * Functions to list and manage recycling facility profiles.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RecyclingCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates?: { lat: number; lng: number } | null;
  acceptedWasteTypes: string[];
  capacity: number;
  certifications: string[];
  operatingHours: Record<string, { open: string; close: string } | null>;
  licensed: boolean;
  licenceNumber: string | null;
  apusRegistrationId: string | null;
  active: boolean;
  company?: { id: string; name: string; logo: string | null };
  createdAt: string;
  updatedAt: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getRecyclingCenters(token: string): Promise<RecyclingCenter[]> {
  return apiFetch<RecyclingCenter[]>('/recycling-centers', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyRecyclingCenters(token: string): Promise<RecyclingCenter[]> {
  return apiFetch<RecyclingCenter[]>('/recycling-centers/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Recycler operator types ────────────────────────────────────────────────

export interface RecyclerIncomingJob {
  id: string;
  status: string;
  jobType: string;
  createdAt: string;
  updatedAt?: string;
  scheduledAt?: string | null;
  notes?: string | null;
  recyclingCenter?: { id: string; name: string; address?: string | null } | null;
  requester?: { id: string; firstName: string; lastName: string; phone?: string | null } | null;
  vehicle?: { id: string; licensePlate: string; vehicleType: string } | null;
}

export interface RecyclerWasteRecord {
  id: string;
  wasteType: string;
  weight?: number | null;
  volume?: number | null;
  weightKg?: number | null;
  recyclableWeight?: number | null;
  recyclingRate?: number | null;
  processingStage?: string | null;
  rcGrade?: string | null;
  certificateUrl?: string | null;
  processedDate?: string | null;
  apusStatus?: string | null;
  apusSubmissionId?: string | null;
  apusNote?: string | null;
  apusSubmittedAt?: string | null;
  weighbridgeTicketRef?: string | null;
  producedMaterialId?: string | null;
  processingStatus?: string | null;
  createdAt: string;
  recyclingCenter?: { id: string; name: string } | null;
  containerOrder?: { id: string; order: { id: string; createdAt: string } } | null;
}

// ─── Recycler operator functions ────────────────────────────────────────────

/** GET /recycling-centers/mine-incoming-jobs — disposal transport jobs heading to this operator's centers */
export async function getRecyclerIncomingJobs(token: string): Promise<RecyclerIncomingJob[]> {
  return apiFetch<RecyclerIncomingJob[]>('/recycling-centers/mine-incoming-jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** GET /recycling-centers/waste-records/mine — all waste records for this operator's centers */
export async function getRecyclerWasteRecords(token: string): Promise<RecyclerWasteRecord[]> {
  return apiFetch<RecyclerWasteRecord[]>('/recycling-centers/waste-records/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
