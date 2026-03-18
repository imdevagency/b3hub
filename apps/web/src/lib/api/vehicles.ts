import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type VehicleType =
  | 'DUMP_TRUCK'
  | 'FLATBED_TRUCK'
  | 'SEMI_TRAILER'
  | 'HOOK_LIFT'
  | 'SKIP_LOADER'
  | 'TANKER'
  | 'VAN';

export type VehicleStatus = 'ACTIVE' | 'IN_USE' | 'MAINTENANCE' | 'INACTIVE';

export interface Vehicle {
  id: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  imageUrl?: string;
  capacity: number; // load weight in tonnes
  maxGrossWeight?: number; // total permitted weight in tonnes
  volumeCapacity?: number; // m³
  driveType?: string;
  status: VehicleStatus;
  ownerId?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  vehicleType: VehicleType;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  imageUrl?: string;
  capacity: number;
  maxGrossWeight?: number;
  volumeCapacity?: number;
  driveType?: string;
  status?: VehicleStatus;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getMyVehicles(token: string): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>('/vehicles', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createVehicle(data: CreateVehicleInput, token: string): Promise<Vehicle> {
  return apiFetch<Vehicle>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateVehicle(
  id: string,
  data: Partial<CreateVehicleInput>,
  token: string,
): Promise<Vehicle> {
  return apiFetch<Vehicle>(`/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteVehicle(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/vehicles/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
