import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type FrameworkContractStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
export type FrameworkPositionType =
  | 'MATERIAL_DELIVERY'
  | 'WASTE_DISPOSAL'
  | 'FREIGHT_TRANSPORT';

export interface ApiFrameworkCallOff {
  id: string;
  callOffNumber: string;
  requestedQty: number;
  scheduledDate: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface ApiFrameworkPosition {
  id: string;
  positionType: FrameworkPositionType;
  materialName: string;
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
  totalAgreedQty: number;
  totalConsumedQty: number;
  totalProgressPct: number;
  totalCallOffs: number;
  positions: ApiFrameworkPosition[];
  recentCallOffs: ApiFrameworkCallOff[];
  createdAt: string;
}

export interface CreateFrameworkContractInput {
  title: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
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
  requestedQty: number;
  scheduledDate?: string;
  notes?: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getFrameworkContracts(token: string): Promise<ApiFrameworkContract[]> {
  return apiFetch<ApiFrameworkContract[]>('/framework-contracts', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getFrameworkContract(
  id: string,
  token: string,
): Promise<ApiFrameworkContract> {
  return apiFetch<ApiFrameworkContract>(`/framework-contracts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createFrameworkContract(
  data: CreateFrameworkContractInput,
  token: string,
): Promise<ApiFrameworkContract> {
  return apiFetch<ApiFrameworkContract>('/framework-contracts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function createFrameworkCallOff(
  contractId: string,
  positionId: string,
  data: CreateCallOffInput,
  token: string,
): Promise<{ id: string; jobNumber: string }> {
  return apiFetch<{ id: string; jobNumber: string }>(
    `/framework-contracts/${contractId}/positions/${positionId}/call-off`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}
