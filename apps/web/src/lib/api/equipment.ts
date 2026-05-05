/**
 * Equipment API module.
 * Admin-only CRUD for the group-wide construction machinery registry.
 * Endpoint: /api/v1/equipment
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type EquipmentType =
  | 'EXCAVATOR'
  | 'DUMPER'
  | 'ROLLER'
  | 'COMPACTOR'
  | 'CRANE'
  | 'OTHER';

export type EquipmentStatus = 'ACTIVE' | 'MAINTENANCE' | 'IDLE';

export type BuContext =
  | 'CONSTRUCTION'
  | 'MARKETPLACE'
  | 'RECYCLING'
  | 'UNASSIGNED';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  licensePlate: string;
  yearManufactured: number;
  status: EquipmentStatus;
  buContext: BuContext;
  hourlyRate: number;
  assignedProject?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipmentInput {
  name: string;
  type: EquipmentType;
  licensePlate: string;
  yearManufactured: number;
  status?: EquipmentStatus;
  buContext?: BuContext;
  hourlyRate?: number;
  assignedProject?: string;
  notes?: string;
}

export type UpdateEquipmentInput = Partial<CreateEquipmentInput>;

// ─── API functions ──────────────────────────────────────────────────────────

export async function listEquipment(
  token: string,
  filters?: { status?: EquipmentStatus; buContext?: BuContext },
): Promise<Equipment[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.buContext) params.set('buContext', filters.buContext);
  const qs = params.toString();
  return apiFetch(`/equipment${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getEquipment(
  token: string,
  id: string,
): Promise<Equipment> {
  return apiFetch(`/equipment/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createEquipment(
  token: string,
  data: CreateEquipmentInput,
): Promise<Equipment> {
  return apiFetch('/equipment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateEquipment(
  token: string,
  id: string,
  data: UpdateEquipmentInput,
): Promise<Equipment> {
  return apiFetch(`/equipment/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteEquipment(
  token: string,
  id: string,
): Promise<void> {
  return apiFetch(`/equipment/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
