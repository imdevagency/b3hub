/**
 * Recycler role API — operators of recycling/waste-processing centers.
 * All endpoints require a valid JWT with canRecycle: true.
 */
import { API_URL as API_BASE } from './common';

export interface RecyclerCenter {
  id: string;
  name: string;
  address: string;
  city?: string;
  active: boolean;
  licensed: boolean;
  acceptedWasteTypes: string[];
}

export interface IncomingJob {
  id: string;
  jobType: string;
  status: string;
  scheduledPickupAt?: string;
  notes?: string;
  recyclingCenter?: { id: string; name: string; address: string };
  requester?: { id: string; firstName: string; lastName: string; phone?: string };
  vehicle?: { id: string; plateNumber: string; type: string };
  createdAt: string;
}

export interface WasteRecord {
  id: string;
  recyclingCenterId: string;
  wasteType: string;
  weightKg?: number;
  processedDate?: string;
  recyclableWeight?: number;
  recyclingRate?: number;
  processingStage?: string;
  rcGrade?: string;
  certificateUrl?: string;
  apusStatus?: string;
  apusSubmissionId?: string;
  apusNote?: string;
  apusSubmittedAt?: string;
  createdAt: string;
  recyclingCenter?: { id: string; name: string };
}

/** GET /recycling-centers/mine — operator's centers */
export async function getMyRecyclingCenters(token: string): Promise<RecyclerCenter[]> {
  const res = await fetch(`${API_BASE}/recycling-centers/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load recycling centers');
  return res.json();
}

/** GET /recycling-centers/mine-incoming-jobs — disposal jobs heading to operator's center */
export async function getRecyclerIncomingJobs(token: string): Promise<IncomingJob[]> {
  const res = await fetch(`${API_BASE}/recycling-centers/mine-incoming-jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load incoming jobs');
  return res.json();
}

/** GET /recycling-centers/waste-records/mine — all waste records for operator's centers */
export async function getRecyclerWasteRecords(token: string): Promise<WasteRecord[]> {
  const res = await fetch(`${API_BASE}/recycling-centers/waste-records/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load waste records');
  return res.json();
}

export interface UpdateWasteRecordInput {
  processingStage?: string;
  recyclableWeight?: number;
  recyclingRate?: number;
  rcGrade?: string;
  apusStatus?: string;
  apusSubmissionId?: string;
  apusNote?: string;
  processedDate?: string;
  weighbridgeTicketRef?: string;
}

/** PATCH /recycling-centers/:centerId/waste-records/:recordId */
export async function updateWasteRecord(
  token: string,
  centerId: string,
  recordId: string,
  input: UpdateWasteRecordInput,
): Promise<WasteRecord> {
  const res = await fetch(
    `${API_BASE}/recycling-centers/${centerId}/waste-records/${recordId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error('Failed to update waste record');
  return res.json();
}

/** POST /recycling-centers/:centerId/incoming-jobs/:jobId/cancel */
export async function cancelIncomingJob(
  token: string,
  centerId: string,
  jobId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/recycling-centers/${centerId}/incoming-jobs/${jobId}/cancel`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) throw new Error('Failed to cancel job');
}
