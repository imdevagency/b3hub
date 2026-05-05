/**
 * Vehicle Assignments API module.
 * Admin-only CRUD + fleet overview for the cross-BU vehicle assignment registry.
 * Endpoint: /api/v1/vehicle-assignments
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type VehicleJobType = 'ORDER' | 'DPR' | 'RECYCLING_JOB';

export type BuContextFleet =
  | 'CONSTRUCTION'
  | 'MARKETPLACE'
  | 'RECYCLING'
  | 'UNASSIGNED';

export interface ActiveAssignment {
  id: string;
  buContext: BuContextFleet;
  jobType: VehicleJobType;
  jobId: string;
  driverName: string | null;
  description: string | null;
  startedAt: string;
}

export interface FleetVehicle {
  id: string;
  licensePlate: string;
  make: string;
  model: string;
  vehicleType: string;
  status: string;
  currentAssignment: ActiveAssignment | null;
}

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  jobType: VehicleJobType;
  jobId: string;
  buContext: BuContextFleet;
  driverName: string | null;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: string;
    licensePlate: string;
    make: string;
    model: string;
    vehicleType: string;
  };
}

export interface CreateVehicleAssignmentInput {
  vehicleId: string;
  jobType: VehicleJobType;
  jobId: string;
  buContext: BuContextFleet;
  startedAt: string;
  endedAt?: string;
  driverName?: string;
  description?: string;
  notes?: string;
}

export type UpdateVehicleAssignmentInput = Partial<CreateVehicleAssignmentInput>;

// ─── API functions ──────────────────────────────────────────────────────────

const BASE = '/vehicle-assignments';

export function getFleetOverview(token: string): Promise<FleetVehicle[]> {
  return apiFetch<FleetVehicle[]>(`${BASE}/fleet-overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function listVehicleAssignments(
  token: string,
  filters?: { active?: boolean; buContext?: BuContextFleet },
): Promise<VehicleAssignment[]> {
  const params = new URLSearchParams();
  if (filters?.active) params.set('active', 'true');
  if (filters?.buContext) params.set('buContext', filters.buContext);
  const qs = params.toString();
  return apiFetch<VehicleAssignment[]>(`${BASE}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getVehicleAssignment(token: string, id: string): Promise<VehicleAssignment> {
  return apiFetch<VehicleAssignment>(`${BASE}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createVehicleAssignment(
  token: string,
  data: CreateVehicleAssignmentInput,
): Promise<VehicleAssignment> {
  return apiFetch<VehicleAssignment>(BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function updateVehicleAssignment(
  token: string,
  id: string,
  data: UpdateVehicleAssignmentInput,
): Promise<VehicleAssignment> {
  return apiFetch<VehicleAssignment>(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function deleteVehicleAssignment(token: string, id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
