import { apiFetch } from './common';
import type { TransportJobStatus } from '@b3hub/shared';

export type { TransportJobStatus };

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiTransportJob {
  id: string;
  jobNumber: string;
  jobType: string;
  requiredVehicleType: string | null;
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
  rate: number;
  pricePerTonne: number | null;
  buyerOfferedRate: number | null;
  currency: string;
  status: TransportJobStatus;
  acceptedAt?: string | null;
  statusUpdatedAt?: string | null;
  slaEscalatedAt?: string | null;
  slaEscalationStage?: string | null;
  statusTimestamps?: Record<string, string> | null;
  createdAt?: string | null;
  sla?: {
    stage: string | null;
    overdueMinutes: number;
    isOverdue: boolean;
  };
  actualWeightKg: number | null;
  pickupPhotoUrl: string | null;
  driverId: string | null;
  offeredToDriverId?: string | null;
  offerExpiresAt?: string | null;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
  } | null;
  vehicle: { id: string; licensePlate: string; vehicleType: string } | null;
  order: {
    id: string;
    orderNumber: string;
    siteContactName: string | null;
    siteContactPhone: string | null;
    sitePhotoUrl: string | null;
    notes: string | null;
    supplierName: string | null;
    supplierPhone: string | null;
  } | null;
}

export interface JobLocation {
  id: string;
  status: string;
  currentLocation: { lat: number; lng: number; updatedAt: string } | null;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  estimatedArrival: string | null;
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

/** Extends ApiTransportJob with a precomputed distance from the anchor coords */
export interface ApiReturnTripJob extends ApiTransportJob {
  returnDistanceKm: number;
}

// ─── Vehicles ──────────────────────────────────────────────────────────────

export type VehicleType =
  | 'DUMP_TRUCK'
  | 'FLATBED_TRUCK'
  | 'SEMI_TRAILER'
  | 'HOOK_LIFT'
  | 'SKIP_LOADER'
  | 'TANKER'
  | 'VAN';

export interface ApiVehicle {
  id: string;
  licensePlate: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year?: number | null;
  capacity?: number | null;
  isActive: boolean;
  createdAt: string;
  insuranceExpiry?: string | null;
  inspectionExpiry?: string | null;
}

// ─── Driver Schedule ──────────────────────────────────────────────────────

export interface DriverWeeklySlot {
  id: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon … 6 = Sat
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
  isActive: boolean;
}

export interface DriverDateBlock {
  id: string;
  blockedDate: string; // ISO date string
  reason?: string | null;
}

export interface DriverAvailability {
  isOnline: boolean;
  effectiveOnline: boolean;
  autoSchedule: boolean;
  maxJobsPerDay: number | null;
  weeklySchedule: DriverWeeklySlot[];
  dateBlocks: DriverDateBlock[];
}

function extractJobsList(
  payload: ApiTransportJob[] | { data?: ApiTransportJob[] } | null | undefined,
): ApiTransportJob[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

// ─── API ──────────────────────────────────────────────────────────────────

export const transportApi = {
  transportJobs: {
    available: async (token: string): Promise<ApiTransportJob[]> => {
      const res = await apiFetch<ApiTransportJob[] | { data?: ApiTransportJob[] }>('/transport-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return extractJobsList(res);
    },

    myActive: (token: string) =>
      apiFetch<ApiTransportJob | null>('/transport-jobs/my-active', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myJobs: async (token: string): Promise<ApiTransportJob[]> => {
      const res = await apiFetch<ApiTransportJob[] | { data?: ApiTransportJob[] }>('/transport-jobs/my-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return extractJobsList(res);
    },

    /** Buyer: returns all disposal & freight jobs the current user requested. */
    myRequests: async (token: string): Promise<ApiTransportJob[]> => {
      const res = await apiFetch<ApiTransportJob[] | { data?: ApiTransportJob[] }>('/transport-jobs/my-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return extractJobsList(res);
    },

    getOne: (id: string, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    accept: (id: string, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    declineOffer: (id: string, token: string) =>
      apiFetch<{ ok: boolean }>(`/transport-jobs/${id}/decline-offer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Upload a pickup photo as base64 and get back a Storage URL. */
    uploadPickupPhoto: (id: string, base64: string, mimeType: string, token: string) =>
      apiFetch<{ url: string }>(`/transport-jobs/${id}/pickup-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
      }),

    updateStatus: (
      id: string,
      status: TransportJobStatus,
      token: string,
      weightKg?: number,
      pickupPhotoUrl?: string,
    ) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status,
          ...(weightKg != null ? { weightKg } : {}),
          ...(pickupPhotoUrl ? { pickupPhotoUrl } : {}),
        }),
      }),

    /** Submit delivery proof — transitions job AT_DELIVERY → DELIVERED. */
    deliveryProof: (
      id: string,
      dto: {
        recipientName?: string;
        notes?: string;
        photos?: string[];
        loadCondition?: 'FULL' | 'PARTIAL' | 'DAMAGED';
        isPartialLoad?: boolean;
        hasDamage?: boolean;
        damageNote?: string;
        gradeConfirmed?: boolean;
        /** SVG path data of recipient signature */
        signatureSvg?: string;
        /** Device GPS latitude at proof submission time */
        proofLat?: number;
        /** Device GPS longitude at proof submission time */
        proofLng?: number;
      },
      token: string,
    ) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/delivery-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    /** Avoid Empty Runs — jobs near the given coords (delivery destination). */
    returnTrips: (lat: number, lng: number, radiusKm: number, token: string) =>
      apiFetch<ApiReturnTripJob[]>(
        `/transport-jobs/return-trips?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),

    /** Driver pushes current GPS position — fire-and-forget. */
    updateLocation: (id: string, lat: number, lng: number, token: string) =>
      apiFetch<{ lat: number; lng: number; updatedAt: string }>(
        `/transport-jobs/${id}/location`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ lat, lng }),
        },
      ),

    /** Buyer polls this to get live driver position. */
    getLocation: (id: string, token: string) =>
      apiFetch<JobLocation>(`/transport-jobs/${id}/location`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    documentReadiness: (id: string, token: string) =>
      apiFetch<TransportDocumentReadiness>(
        `/transport-jobs/${id}/document-readiness`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),

    /** LoadingDock — seller confirms driver has loaded (AT_PICKUP → LOADED). */
    loadingDock: (id: string, token: string, weightKg?: number) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/loading-dock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...(weightKg != null ? { weightKg } : {}) }),
      }),

    listExceptions: (id: string, token: string) =>
      apiFetch<ApiTransportJobException[]>(`/transport-jobs/${id}/exceptions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    reportException: (
      id: string,
      dto: {
        type: TransportExceptionType;
        notes: string;
        photoUrls?: string[];
        requiresDispatchAction?: boolean;
        actualQuantity?: number;
      },
      token: string,
    ) =>
      apiFetch<ApiTransportJobException>(`/transport-jobs/${id}/exceptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    reportDelay: (
      id: string,
      dto: { estimatedDelayMinutes: number; reason?: string },
      token: string,
    ) =>
      apiFetch<{ jobId: string; reported: boolean }>(
        `/transport-jobs/${id}/report-delay`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(dto),
        },
      ),

    resolveException: (
      id: string,
      exceptionId: string,
      resolution: string,
      token: string,
    ) =>
      apiFetch<ApiTransportJobException>(
        `/transport-jobs/${id}/exceptions/${exceptionId}/resolve`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ resolution }),
        },
      ),

    /** Buyer: rate the driver after a DELIVERED transport job (1-5 stars). */
    rateDriver: (
      id: string,
      dto: { rating: number; comment?: string },
      token: string,
    ) =>
      apiFetch<{ id: string; rating: number; createdAt: string }>(
        `/transport-jobs/${id}/review`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(dto),
        },
      ),

    /** Driver: rate the buyer's site/instructions after a DELIVERED transport job. */
    rateBuyer: (
      id: string,
      dto: { rating: number; comment?: string },
      token: string,
    ) =>
      apiFetch<{ id: string; rating: number; createdAt: string }>(
        `/transport-jobs/${id}/rate-buyer`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(dto),
        },
      ),

    /** Driver: check if they have already rated the buyer for this job. */
    rateBuyerStatus: (id: string, token: string) =>
      apiFetch<{ rated: boolean }>(
        `/transport-jobs/${id}/rate-buyer/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),

    /** Driver: self-cancel a job before loading has started (ACCEPTED or EN_ROUTE_PICKUP). */
    driverCancel: (id: string, dto: { reason: string }, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/driver-cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(dto),
      }),

    addSurcharge: (
      id: string,
      dto: { type: string; amount: number; label?: string; billable?: boolean },
      token: string,
    ) =>
      apiFetch<{ id: string; type: string; amount: number; label: string; approvalStatus: 'PENDING' | 'APPROVED'; createdAt: string }>(
        `/transport-jobs/${id}/surcharges`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(dto),
        },
      ),

    approveSurcharge: (id: string, surchargeId: string, token: string) =>
      apiFetch<{ id: string; approvalStatus: string }>(
        `/transport-jobs/${id}/surcharges/${surchargeId}/approve`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      ),

    rejectSurcharge: (id: string, surchargeId: string, token: string, note?: string) =>
      apiFetch<{ id: string; approvalStatus: string }>(
        `/transport-jobs/${id}/surcharges/${surchargeId}/reject`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ note }),
        },
      ),
  },

  vehicles: {
    getAll: (token: string) =>
      apiFetch<ApiVehicle[]>('/vehicles', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    getOne: (id: string, token: string) =>
      apiFetch<ApiVehicle>(`/vehicles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),

    create: (data: Omit<ApiVehicle, 'id' | 'createdAt'>, token: string) =>
      apiFetch<ApiVehicle>('/vehicles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    update: (
      id: string,
      data: Partial<Omit<ApiVehicle, 'id' | 'createdAt'>>,
      token: string,
    ) =>
      apiFetch<ApiVehicle>(`/vehicles/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),

    remove: (id: string, token: string) =>
      apiFetch<void>(`/vehicles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },

  driverSchedule: {
    /** Returns the driver's full availability profile including weekly schedule. */
    getStatus: (token: string) =>
      apiFetch<DriverAvailability>('/driver-schedule', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Toggle online / offline. Returns updated { isOnline } state. */
    toggleOnline: (isOnline: boolean, token: string) =>
      apiFetch<{ isOnline: boolean }>('/driver-schedule/online', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isOnline }),
      }),
    /** Upsert the entire weekly schedule */
    updateSchedule: (
      data: {
        days: {
          dayOfWeek: number;
          enabled: boolean;
          startTime: string;
          endTime: string;
        }[];
        autoSchedule?: boolean;
        maxJobsPerDay?: number | null;
      },
      token: string,
    ) =>
      apiFetch<DriverAvailability>('/driver-schedule', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),  },
};
