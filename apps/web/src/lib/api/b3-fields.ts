/**
 * B3 Fields API module — /api/v1/b3-fields
 */
import { apiFetch } from './common';

// ─── Types ──────────────────────────────────────────────────────────────────

export type B3FieldService = 'MATERIAL_PICKUP' | 'WASTE_DISPOSAL' | 'TRAILER_RENTAL';

export interface ApiB3Field {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  services: B3FieldService[];
  openingHours: Record<string, { open: string; close: string } | null>;
  active: boolean;
  notes?: string | null;
  recyclingCenterId?: string | null;
  recyclingCenter?: {
    id: string;
    name: string;
    acceptedWasteTypes: string[];
  } | null;
  _count?: { pickupSlots: number };
  createdAt: string;
  updatedAt: string;
}

export interface ApiPickupSlot {
  id: string;
  fieldId: string;
  slotStart: string;
  slotEnd: string;
  capacity: number;
  booked: number;
}

export interface ApiTodayArrivals {
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    deliveryDate: string | null;
    buyer: { name: string };
    items: Array<{
      quantity: number;
      unit: string;
      material: { name: string; unit: string };
    }>;
    pickupSlot: { slotStart: string; slotEnd: string } | null;
    fieldPasses: Array<{
      id: string;
      passNumber: string;
      vehiclePlate: string;
      driverName: string | null;
      status: string;
    }>;
  }>;
  passes: Array<{
    id: string;
    passNumber: string;
    vehiclePlate: string;
    driverName: string | null;
    validFrom: string;
    validTo: string;
    status: string;
    company: { name: string };
    weighingSlips: Array<{
      id: string;
      netTonnes: number;
      recordedAt: string;
    }>;
    order: {
      id: string;
      orderNumber: string;
      orderType: string;
      status: string;
    } | null;
  }>;
}

// ─── Functions ──────────────────────────────────────────────────────────────

export async function getB3Fields(all = false): Promise<ApiB3Field[]> {
  return apiFetch<ApiB3Field[]>(`/b3-fields${all ? '?all=true' : ''}`, {});
}

export async function getB3Field(id: string): Promise<ApiB3Field> {
  return apiFetch<ApiB3Field>(`/b3-fields/${id}`, {});
}

export async function getB3FieldBySlug(slug: string): Promise<ApiB3Field> {
  return apiFetch<ApiB3Field>(`/b3-fields/by-slug/${slug}`, {});
}

export async function getB3FieldSlots(
  fieldId: string,
  date: string,
): Promise<ApiPickupSlot[]> {
  return apiFetch<ApiPickupSlot[]>(`/b3-fields/${fieldId}/slots?date=${date}`, {});
}

export async function getTodayArrivals(
  token: string,
  fieldId: string,
): Promise<ApiTodayArrivals> {
  return apiFetch<ApiTodayArrivals>(`/b3-fields/${fieldId}/today`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createB3Field(
  token: string,
  data: {
    name: string;
    slug: string;
    address: string;
    city: string;
    postalCode: string;
    lat: number;
    lng: number;
    services: B3FieldService[];
    openingHours: Record<string, { open: string; close: string } | null>;
    recyclingCenterId?: string;
    active?: boolean;
    notes?: string;
  },
): Promise<ApiB3Field> {
  return apiFetch<ApiB3Field>('/b3-fields', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateB3Field(
  token: string,
  id: string,
  data: Partial<Parameters<typeof createB3Field>[1]>,
): Promise<ApiB3Field> {
  return apiFetch<ApiB3Field>(`/b3-fields/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function createPickupSlot(
  token: string,
  data: {
    fieldId: string;
    slotStart: string;
    slotEnd: string;
    capacity?: number;
  },
): Promise<ApiPickupSlot> {
  return apiFetch<ApiPickupSlot>('/b3-fields/slots', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Inventory ──────────────────────────────────────────────────────────────

export interface ApiInventoryItem {
  id: string;
  fieldId: string;
  name: string;
  unit: string;
  pricePerUnit: number;
  stockQty: number;
  minStockQty: number;
  available: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InventoryItemInput = {
  name: string;
  unit: string;
  pricePerUnit: number;
  stockQty?: number;
  minStockQty?: number;
  available?: boolean;
  notes?: string;
};

export async function getFieldInventory(
  token: string,
  fieldId: string,
): Promise<ApiInventoryItem[]> {
  return apiFetch<ApiInventoryItem[]>(`/b3-fields/${fieldId}/inventory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createInventoryItem(
  token: string,
  fieldId: string,
  data: InventoryItemInput,
): Promise<ApiInventoryItem> {
  return apiFetch<ApiInventoryItem>(`/b3-fields/${fieldId}/inventory`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function updateInventoryItem(
  token: string,
  fieldId: string,
  itemId: string,
  data: Partial<InventoryItemInput>,
): Promise<ApiInventoryItem> {
  return apiFetch<ApiInventoryItem>(`/b3-fields/${fieldId}/inventory/${itemId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function deleteInventoryItem(
  token: string,
  fieldId: string,
  itemId: string,
): Promise<void> {
  return apiFetch<void>(`/b3-fields/${fieldId}/inventory/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Bulk slot generator ─────────────────────────────────────────────────────

export async function bulkCreateSlots(
  token: string,
  fieldId: string,
  data: {
    startDate: string;
    endDate: string;
    slotTimes: string[];
    durationMinutes: number;
    capacity: number;
    daysOfWeek: number[];
  },
): Promise<{ created: number }> {
  return apiFetch<{ created: number }>(`/b3-fields/${fieldId}/slots/bulk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ─── Gate: scan a FieldPass ──────────────────────────────────────────────────

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
  field: { id: string; name: string };
  scannedAt: string;
}

export async function scanPass(
  token: string,
  fieldId: string,
  passNumber: string,
): Promise<ApiPassScanResult> {
  return apiFetch<ApiPassScanResult>(`/b3-fields/${fieldId}/passes/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ passNumber }),
  });
}

// ─── Cameras ────────────────────────────────────────────────────────────────

export interface ApiCamera {
  id: string;
  name: string;
  deviceSerial: string;
  channelNo: number;
  fieldId: string;
  sortOrder: number;
}

export interface ApiCameraToken {
  viewerToken: string;
  expiresAt: string;
}

/** Returns [] gracefully when the endpoint is not yet configured. */
export async function getFieldCameras(token: string, fieldId: string): Promise<ApiCamera[]> {
  return apiFetch<ApiCamera[]>(`/b3-fields/${fieldId}/cameras`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => []);
}

export async function getCameraToken(
  token: string,
  fieldId: string,
  cameraId: string,
): Promise<ApiCameraToken> {
  return apiFetch<ApiCameraToken>(`/b3-fields/${fieldId}/cameras/${cameraId}/token`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
