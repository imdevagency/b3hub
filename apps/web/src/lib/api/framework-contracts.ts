/**
 * Framework contracts API module.
 * Functions wrapping /api/v1/framework-contracts/* endpoints.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type FrameworkContractStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type FrameworkPositionType =
  | 'MATERIAL_DELIVERY'
  | 'WASTE_DISPOSAL'
  | 'FREIGHT_TRANSPORT';

export interface ApiFrameworkCallOff {
  id: string;
  jobNumber: string;
  cargoWeight: number | null;
  status: string;
  pickupDate: string | null;
  deliveryDate?: string | null;
  pickupCity?: string | null;
  deliveryCity?: string | null;
  notes?: string | null;
}

export interface ApiFrameworkPosition {
  id: string;
  positionType: FrameworkPositionType;
  materialName: string;
  description?: string;
  unit: string;
  agreedQty: number;
  consumedQty: number;
  unitPrice: number;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  callOffs: ApiFrameworkCallOff[];
}

export interface ApiFrameworkContract {
  id: string;
  contractNumber: string;
  title: string;
  status: FrameworkContractStatus;
  startDate: string | null;
  endDate: string | null;
  notes?: string | null;
  supplier?: { id: string; name: string } | null;
  buyer?: { id: string; name: string } | null;
  totalAgreedQty: number;
  totalConsumedQty: number;
  totalProgressPct: number;
  totalCallOffs: number;
  positions: ApiFrameworkPosition[];
  recentCallOffs: ApiFrameworkCallOff[];
  createdAt: string;
  // Field pass extensions
  isFieldContract?: boolean;
  prepaidBalance?: number;
  prepaidUsed?: number;
}

export interface CreateFrameworkContractInput {
  title: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  supplierId?: string;
  positions: {
    positionType: FrameworkPositionType;
    materialName: string;
    unit: string;
    agreedQty: number;
    unitPrice: number;
    pickupAddress?: string;
    deliveryAddress?: string;
  }[];
}

export interface CreateCallOffInput {
  quantity: number;
  pickupDate?: string;
  deliveryDate?: string;
  pickupCity?: string;
  deliveryCity?: string;
  notes?: string;
}

interface RawFrameworkPosition {
  id: string;
  positionType: FrameworkPositionType;
  materialName?: string;
  description?: string;
  unit: string;
  agreedQty: number;
  consumedQty: number;
  unitPrice: number;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  callOffs: ApiFrameworkCallOff[];
}

interface RawFrameworkContract extends Omit<ApiFrameworkContract, 'positions'> {
  positions: RawFrameworkPosition[];
}

function normalizePosition(position: RawFrameworkPosition): ApiFrameworkPosition {
  const materialName = position.materialName ?? position.description ?? 'Pozīcija';
  return {
    ...position,
    materialName,
    description: position.description ?? position.materialName,
  };
}

function normalizeContract(contract: RawFrameworkContract): ApiFrameworkContract {
  return {
    ...contract,
    positions: (contract.positions ?? []).map(normalizePosition),
  };
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getFrameworkContracts(token: string): Promise<ApiFrameworkContract[]> {
  const data = await apiFetch<RawFrameworkContract[]>('/framework-contracts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.map(normalizeContract);
}

export async function getFrameworkContract(
  id: string,
  token: string,
): Promise<ApiFrameworkContract> {
  const data = await apiFetch<RawFrameworkContract>(`/framework-contracts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return normalizeContract(data);
}

export async function createFrameworkContract(
  data: CreateFrameworkContractInput,
  token: string,
): Promise<ApiFrameworkContract> {
  const payload = {
    title: data.title,
    startDate: data.startDate ?? new Date().toISOString(),
    endDate: data.endDate,
    notes: data.notes,
    supplierId: data.supplierId,
    positions: data.positions.map((position) => ({
      positionType: position.positionType,
      description: position.materialName,
      unit: position.unit,
      agreedQty: position.agreedQty,
      unitPrice: position.unitPrice,
      pickupAddress: position.pickupAddress,
      deliveryAddress: position.deliveryAddress,
    })),
  };

  const created = await apiFetch<RawFrameworkContract>('/framework-contracts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return normalizeContract(created);
}

export async function createFrameworkCallOff(
  contractId: string,
  positionId: string,
  data: CreateCallOffInput,
  token: string,
): Promise<{ id: string; jobNumber: string }> {
  const date = data.pickupDate ?? new Date().toISOString().split('T')[0];
  return apiFetch<{ id: string; jobNumber: string }>(
    `/framework-contracts/${contractId}/positions/${positionId}/call-off`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: data.quantity,
        pickupDate: date,
        deliveryDate: data.deliveryDate ?? date,
        pickupCity: data.pickupCity,
        deliveryCity: data.deliveryCity,
        notes: data.notes,
      }),
    },
  );
}

export async function activateFrameworkContract(
  id: string,
  token: string,
): Promise<ApiFrameworkContract> {
  const data = await apiFetch<RawFrameworkContract>(
    `/framework-contracts/${id}/activate`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
  );
  return normalizeContract(data);
}
