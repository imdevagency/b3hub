import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiCompanyMember {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  companyRole: string | null;
  status: string;
  permCreateContracts: boolean;
  permReleaseCallOffs: boolean;
  permManageOrders: boolean;
  permViewFinancials: boolean;
  permManageTeam: boolean;
  createdAt: string;
}

export interface InviteMemberInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;
}

export type MemberPermissions = Pick<
  ApiCompanyMember,
  | 'permCreateContracts'
  | 'permReleaseCallOffs'
  | 'permManageOrders'
  | 'permViewFinancials'
  | 'permManageTeam'
>;

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
  pickupDate: string;
  deliveryCity: string | null;
}

export interface ApiFrameworkPosition {
  id: string;
  positionType: FrameworkPositionType;
  description: string;
  agreedQty: number;
  unit: string;
  unitPrice: number | null;
  pickupAddress: string | null;
  pickupCity: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  consumedQty: number;
  remainingQty: number;
  progressPct: number;
  callOffs: ApiFrameworkCallOff[];
}

export interface ApiFrameworkContract {
  id: string;
  contractNumber: string;
  title: string;
  status: FrameworkContractStatus;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  buyer: { id: string; name: string } | null;
  totalCallOffs: number;
  totalAgreedQty: number;
  totalConsumedQty: number;
  totalProgressPct: number;
  positions: ApiFrameworkPosition[];
  recentCallOffs: ApiFrameworkCallOff[];
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFrameworkContractInput {
  title: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  projectId?: string;
  positions?: {
    positionType: FrameworkPositionType;
    description: string;
    agreedQty: number;
    unit: string;
    unitPrice?: number;
    pickupAddress?: string;
    pickupCity?: string;
    deliveryAddress?: string;
    deliveryCity?: string;
  }[];
}

export interface CreateCallOffInput {
  quantity: number;
  pickupDate: string;
  deliveryDate?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  notes?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const companyApi = {
  companyMembers: {
    list: (token: string) =>
      apiFetch<ApiCompanyMember[]>('/company-members', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    invite: (data: InviteMemberInput, token: string) =>
      apiFetch<{ member: ApiCompanyMember; isNew: boolean; tempPassword?: string }>(
        '/company-members/invite',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        },
      ),

    updatePermissions: (
      userId: string,
      perms: Partial<MemberPermissions>,
      token: string,
    ) =>
      apiFetch<ApiCompanyMember>(`/company-members/${userId}/permissions`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(perms),
      }),

    remove: (userId: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/company-members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  frameworkContracts: {
    list: (token: string) =>
      apiFetch<ApiFrameworkContract[]>('/framework-contracts', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    get: (id: string, token: string) =>
      apiFetch<ApiFrameworkContract>(`/framework-contracts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (data: CreateFrameworkContractInput, token: string) =>
      apiFetch<ApiFrameworkContract>('/framework-contracts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (
      id: string,
      data: {
        title?: string;
        endDate?: string;
        notes?: string;
        status?: FrameworkContractStatus;
      },
      token: string,
    ) =>
      apiFetch<ApiFrameworkContract>(`/framework-contracts/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    addPosition: (
      contractId: string,
      data: CreateFrameworkContractInput['positions'] extends (infer U)[] ? U : never,
      token: string,
    ) =>
      apiFetch<ApiFrameworkContract>(`/framework-contracts/${contractId}/positions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    removePosition: (contractId: string, posId: string, token: string) =>
      apiFetch<void>(`/framework-contracts/${contractId}/positions/${posId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),

    createCallOff: (
      contractId: string,
      posId: string,
      data: CreateCallOffInput,
      token: string,
    ) =>
      apiFetch<{ id: string; jobNumber: string }>(
        `/framework-contracts/${contractId}/positions/${posId}/call-off`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        },
      ),

    activate: (id: string, token: string) =>
      apiFetch<ApiFrameworkContract>(`/framework-contracts/${id}/activate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
