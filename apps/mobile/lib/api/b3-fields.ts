/**
 * B3 Fields API — mobile
 * /api/v1/b3-fields
 */
import { apiFetch } from './common';

// ─── Types ──────────────────────────────────────────────────────────────────

export type B3FieldServiceType = 'MATERIAL_PICKUP' | 'WASTE_DISPOSAL' | 'TRAILER_RENTAL';

export interface ApiMobileB3Field {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  services: B3FieldServiceType[];
  openingHours: Record<string, { open: string; close: string } | null>;
  active: boolean;
  notes?: string | null;
}

export interface ApiPickupSlotMobile {
  id: string;
  fieldId: string;
  slotStart: string;
  slotEnd: string;
  capacity: number;
  booked: number;
  available: number;
}

export interface ApiPassScanResult {
  pass: {
    id: string;
    passNumber: string;
    vehiclePlate: string;
    driverName?: string | null;
    validFrom: string;
    validTo: string;
    status: string;
    wasteClassCode?: string | null;
    wasteDescription?: string | null;
    unloadingPoint?: string | null;
    estimatedTonnes?: number | null;
    revokedReason?: string | null;
    fileUrl?: string | null;
    company: { name: string; legalName: string; registrationNum?: string | null };
    contract: { contractNumber: string; title: string };
    order?: { orderNumber: string } | null;
    weighingSlips: { id: string; slipNumber: string; netTonnes?: number | null; createdAt: string }[];
  };
  isValid: boolean;
  /** false when pass.wasteClassCode is not in the field's acceptedWasteTypes list */
  wasteAccepted: boolean;
  /** accepted waste types configured on this field's recycling center */
  acceptedWasteTypes: string[];
  field: { id: string; name: string };
  scannedAt: string;
}

// ─── API Functions ───────────────────────────────────────────────────────────

export const b3Fields = {
  /**
   * List all active B3 Field locations (available for pickup).
   */
  list: (): Promise<ApiMobileB3Field[]> =>
    apiFetch<ApiMobileB3Field[]>('/b3-fields?active=true'),

  /**
   * Get a single B3 Field by id.
   */
  get: (id: string): Promise<ApiMobileB3Field> =>
    apiFetch<ApiMobileB3Field>(`/b3-fields/${id}`),

  /**
   * Get available pickup slots for a field on a given date.
   * @param fieldId  B3 Field id
   * @param date     ISO date string (e.g. '2025-07-15')
   */
  getSlots: (fieldId: string, date: string): Promise<ApiPickupSlotMobile[]> =>
    apiFetch<ApiPickupSlotMobile[]>(`/b3-fields/${fieldId}/slots?date=${date}`),

  /**
   * Gate: validate a FieldPass by pass number (QR scan or manual entry).
   */
  scanPass: (token: string, fieldId: string, passNumber: string): Promise<ApiPassScanResult> =>
    apiFetch<ApiPassScanResult>(`/b3-fields/${fieldId}/passes/scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ passNumber }),
    }),
};
