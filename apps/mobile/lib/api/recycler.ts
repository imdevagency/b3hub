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
  /** ISO date — when the driver picks up waste at buyer's site. */
  pickupDate?: string;
  notes?: string;
  // Pickup origin
  pickupAddress?: string;
  pickupCity?: string;
  // Waste / cargo metadata — critical for recycler pre-planning
  cargoType?: string;          // waste type / material type
  cargoWeight?: number;        // estimated weight in tonnes
  requiredVehicleType?: string;
  // Site coordination
  bisNumber?: string;
  loadingBy?: 'BUYER_CREW' | 'DRIVER_HANDS' | 'NEEDS_MACHINERY' | string;
  contactWillBePresent?: boolean;
  wasteReadiness?: 'PILED' | 'NEEDS_PREP' | string;
  siteContactName?: string;
  siteContactPhone?: string;
  /** rate === 0 means this is a scrap buyback — recycler owes the buyer a payout. */
  rate?: number;
  recyclingCenter?: { id: string; name: string; address: string };
  requester?: { id: string; firstName: string; lastName: string; phone?: string };
  vehicle?: { id: string; licensePlate: string; vehicleType: string };
  /** Order-level fields (present when job was created via the disposal order flow). */
  order?: {
    id: string;
    orderNumber: string;
    bisNumber?: string | null;
    createdBy?: {
      id: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
    } | null;
  } | null;
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

export interface CreateRecyclingCenterInput {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates?: { lat: number; lng: number };
  acceptedWasteTypes: string[];
  capacity: number;
  certifications?: string[];
  operatingHours: Record<string, { open: string; close: string } | null>;
  licensed?: boolean;
  licenceNumber?: string;
}

/** POST /recycling-centers — register a new recycling/waste center */
export async function createRecyclingCenter(
  token: string,
  data: CreateRecyclingCenterInput,
): Promise<RecyclerCenter> {
  const res = await fetch(`${API_BASE}/recycling-centers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message ?? 'Failed to create recycling center');
  }
  return res.json();
}
