/**
 * Recycler role API — operators of recycling/waste-processing centers.
 * All endpoints require a valid JWT with canRecycle: true.
 */
import { API_BASE } from './config';

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
  certificateUrl?: string;
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
