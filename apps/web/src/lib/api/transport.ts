/**
 * Transport jobs API module.
 * Functions for creating, listing, accepting, and updating transport jobs.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TransportJobStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_PICKUP'
  | 'AT_PICKUP'
  | 'LOADED'
  | 'EN_ROUTE_DELIVERY'
  | 'AT_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type TransportJobType =
  | 'MATERIAL_DELIVERY'
  | 'CONTAINER_DELIVERY'
  | 'CONTAINER_PICKUP'
  | 'WASTE_COLLECTION'
  | 'EQUIPMENT_TRANSPORT';

export type VehicleTypeEnum =
  | 'DUMP_TRUCK'
  | 'FLATBED_TRUCK'
  | 'SEMI_TRAILER'
  | 'HOOK_LIFT'
  | 'SKIP_LOADER'
  | 'TANKER'
  | 'VAN';

export interface ApiTransportJob {
  id: string;
  jobNumber: string;
  jobType: string;
  requiredVehicleType: string | null;
  requiredVehicleEnum: string | null;
  cargoType: string;
  cargoWeight: number | null;
  pickupAddress: string;
  pickupCity: string;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupDate: string;
  pickupWindow: string | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryDate: string;
  deliveryWindow: string | null;
  distanceKm: number | null;
  rate: number | null;
  pricePerTonne: number | null;
  buyerOfferedRate: number | null;
  currency: string;
  status: TransportJobStatus;
  acceptedAt?: string | null;
  statusUpdatedAt?: string | null;
  slaEscalatedAt?: string | null;
  slaEscalationStage?: string | null;
  sla?: {
    stage: string | null;
    overdueMinutes: number;
    isOverdue: boolean;
  };
  driverId: string | null;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  } | null;
  vehicle: { id: string; licensePlate: string; vehicleType: string } | null;
  order: {
    id: string;
    orderNumber: string;
    siteContactName: string | null;
    siteContactPhone: string | null;
  } | null;
}

export interface ApiDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export interface TransportJobLocation {
  id: string;
  status: TransportJobStatus;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string;
  estimatedArrival: string | null;
}

export interface CreateTransportJobInput {
  jobType: TransportJobType;
  // Pickup
  pickupAddress: string;
  pickupCity: string;
  pickupState?: string;
  pickupPostal?: string;
  pickupDate: string;
  pickupWindow?: string;
  // Delivery
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState?: string;
  deliveryPostal?: string;
  deliveryDate: string;
  deliveryWindow?: string;
  // Cargo
  cargoType: string;
  cargoWeight?: number;
  cargoVolume?: number;
  specialRequirements?: string;
  // Vehicle
  requiredVehicleType?: string;
  requiredVehicleEnum?: VehicleTypeEnum;
  // Pricing
  rate: number;
  pricePerTonne?: number;
  distanceKm?: number;
  orderId?: string;
}

export interface DeliveryProofInput {
  recipientName?: string;
  notes?: string;
  photoUrls?: string[];
}

export interface DeliveryProof {
  id: string;
  transportJobId: string;
  notes?: string;
  photoUrls: string[];
  submittedAt: string;
}

export type TransportExceptionType =
  | 'DRIVER_NO_SHOW'
  | 'SUPPLIER_NOT_READY'
  | 'WRONG_MATERIAL'
  | 'PARTIAL_DELIVERY'
  | 'REJECTED_DELIVERY'
  | 'SITE_CLOSED'
  | 'OVERWEIGHT'
  | 'OTHER';

export type TransportExceptionStatus = 'OPEN' | 'RESOLVED';

export interface ApiTransportJobException {
  id: string;
  transportJobId: string;
  type: TransportExceptionType;
  status: TransportExceptionStatus;
  notes: string;
  photoUrls: string[];
  reportedById: string;
  resolvedById: string | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  transportJob?: {
    id: string;
    jobNumber: string;
    status: TransportJobStatus;
    pickupCity: string;
    deliveryCity: string;
    driver: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  };
}

export interface TransportDocumentReadiness {
  transportJobId: string;
  status: TransportJobStatus;
  requires: {
    deliveryProof: boolean;
    weighingSlip: boolean;
  };
  has: {
    deliveryProof: boolean;
    weighingSlip: boolean;
    deliveryNote: boolean;
  };
  canMarkDelivered: boolean;
  missing: string[];
}

interface PaginatedTransportJobsResponse {
  data?: ApiTransportJob[];
}

function normalizeTransportJobsPayload(
  payload: ApiTransportJob[] | PaginatedTransportJobsResponse,
): ApiTransportJob[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getAvailableTransportJobs(token: string): Promise<ApiTransportJob[]> {
  const payload = await apiFetch<ApiTransportJob[] | PaginatedTransportJobsResponse>(
    '/transport-jobs',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return normalizeTransportJobsPayload(payload);
}

export async function getAllTransportJobs(token: string): Promise<ApiTransportJob[]> {
  const payload = await apiFetch<ApiTransportJob[] | PaginatedTransportJobsResponse>(
    '/transport-jobs/fleet',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return normalizeTransportJobsPayload(payload);
}

export async function getSlaOverdueTransportJobs(
  token: string,
): Promise<ApiTransportJob[]> {
  const payload = await apiFetch<ApiTransportJob[] | PaginatedTransportJobsResponse>(
    '/transport-jobs/sla-overdue',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return normalizeTransportJobsPayload(payload);
}

export async function getOpenTransportExceptions(
  token: string,
): Promise<ApiTransportJobException[]> {
  return apiFetch<ApiTransportJobException[]>('/transport-jobs/exceptions/open', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function acceptTransportJob(id: string, token: string): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyTransportJobs(token: string): Promise<ApiTransportJob[]> {
  const payload = await apiFetch<ApiTransportJob[] | PaginatedTransportJobsResponse>(
    '/transport-jobs/my-jobs',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return normalizeTransportJobsPayload(payload);
}

export async function getMyActiveTransportJob(
  token: string,
): Promise<ApiTransportJob | null> {
  const result = await apiFetch<ApiTransportJob | null>('/transport-jobs/my-active', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return result ?? null;
}

export async function updateTransportJobStatus(
  id: string,
  status: string,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function getTransportDrivers(token: string): Promise<ApiDriver[]> {
  return apiFetch<ApiDriver[]>('/transport-jobs/drivers', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function assignTransportJob(
  id: string,
  body: { driverId: string; vehicleId?: string },
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/assign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function reassignTransportJob(
  id: string,
  body: { driverId: string; vehicleId?: string },
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/reassign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function unassignTransportJob(
  id: string,
  reason: string | undefined,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}/unassign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(reason ? { reason } : {}) }),
  });
}

export async function listTransportJobExceptions(
  id: string,
  token: string,
): Promise<ApiTransportJobException[]> {
  return apiFetch<ApiTransportJobException[]>(`/transport-jobs/${id}/exceptions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function reportTransportJobException(
  id: string,
  dto: {
    type: TransportExceptionType;
    notes: string;
    photoUrls?: string[];
    requiresDispatchAction?: boolean;
  },
  token: string,
): Promise<ApiTransportJobException> {
  return apiFetch<ApiTransportJobException>(`/transport-jobs/${id}/exceptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
}

export async function resolveTransportJobException(
  id: string,
  exceptionId: string,
  resolution: string,
  token: string,
): Promise<ApiTransportJobException> {
  return apiFetch<ApiTransportJobException>(
    `/transport-jobs/${id}/exceptions/${exceptionId}/resolve`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    },
  );
}

export async function getTransportJob(id: string, token: string): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTransportJobLocation(
  id: string,
  token: string,
): Promise<TransportJobLocation> {
  return apiFetch<TransportJobLocation>(`/transport-jobs/${id}/location`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTransportDocumentReadiness(
  id: string,
  token: string,
): Promise<TransportDocumentReadiness> {
  return apiFetch<TransportDocumentReadiness>(
    `/transport-jobs/${id}/document-readiness`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

export async function updateTransportJobLocation(
  id: string,
  dto: { lat: number; lng: number },
  token: string,
): Promise<{ lat: number; lng: number; updatedAt: string }> {
  return apiFetch<{ lat: number; lng: number; updatedAt: string }>(
    `/transport-jobs/${id}/location`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(dto),
    },
  );
}

export async function createTransportJob(
  input: CreateTransportJobInput,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>('/transport-jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function submitDeliveryProof(
  jobId: string,
  data: DeliveryProofInput,
  token: string,
): Promise<ApiTransportJob> {
  return apiFetch<ApiTransportJob>(`/transport-jobs/${jobId}/delivery-proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

interface MyTransportRequestsResponse {
  data: ApiTransportJob[];
  pagination: { total: number; limit: number; skip: number; hasMore: boolean };
}

/** Buyer: returns all disposal & freight transport jobs the current user requested. */
export async function getMyTransportRequests(token: string): Promise<ApiTransportJob[]> {
  const res = await apiFetch<MyTransportRequestsResponse>('/transport-jobs/my-requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(res.data) ? res.data : [];
}
