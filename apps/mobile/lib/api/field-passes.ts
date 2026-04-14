/**
 * Field Passes API — mobile
 * /api/v1/field-passes  &  /api/v1/weighing-slips
 */
import { apiFetch } from './common';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FieldPassStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface ApiFieldPass {
  id: string;
  passNumber: string;
  companyId: string;
  contractId: string;
  vehiclePlate: string;
  driverName?: string | null;
  validFrom: string;
  validTo: string;
  wasteClassCode?: string | null;
  wasteDescription?: string | null;
  unloadingPoint?: string | null;
  estimatedTonnes?: number | null;
  actualNetTonnes?: number | null;
  status: FieldPassStatus;
  fileUrl?: string | null;
  revokedReason?: string | null;
  revokedAt?: string | null;
  orderId?: string | null;
  createdAt: string;
  company?: { name: string; legalName: string } | null;
  contract?: { contractNumber: string; title: string; prepaidBalance?: number; prepaidUsed?: number } | null;
}

export interface CreateFieldPassInput {
  contractId: string;
  vehiclePlate: string;
  driverName?: string;
  validFrom: string;
  validTo: string;
  wasteClassCode?: string;
  wasteDescription?: string;
  unloadingPoint?: string;
  estimatedTonnes?: number;
  orderId?: string;
}

export interface ApiFieldPassValidation extends ApiFieldPass {
  isValid: boolean;
  validationTimestamp: string;
}

export interface ApiWeighingSlip {
  id: string;
  slipNumber: string;
  fieldPassId: string;
  grossTonnes: number;
  tareTonnes: number;
  netTonnes: number;
  vehiclePlate: string;
  operatorName?: string | null;
  notes?: string | null;
  voidedAt?: string | null;
  voidedReason?: string | null;
  recordedAt: string;
}

// ─── Field Pass functions ────────────────────────────────────────────────────

export const fieldPassesApi = {
  fieldPasses: {
    getAll: (token: string) =>
      apiFetch<ApiFieldPass[]>('/field-passes', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getOne: (id: string, token: string) =>
      apiFetch<ApiFieldPass>(`/field-passes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    validate: (passNumber: string) =>
      apiFetch<ApiFieldPassValidation>(`/field-passes/validate/${passNumber}`),

    create: (input: CreateFieldPassInput, token: string) =>
      apiFetch<ApiFieldPass>('/field-passes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      }),
  },

  weighingSlips: {
    getByPass: (passId: string, token: string) =>
      apiFetch<ApiWeighingSlip[]>(`/weighing-slips?passId=${passId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
