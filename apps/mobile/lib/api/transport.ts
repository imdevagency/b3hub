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
  currency: string;
  status: TransportJobStatus;
  actualWeightKg: number | null;
  pickupPhotoUrl: string | null;
  driverId: string | null;
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

/** Extends ApiTransportJob with a precomputed distance from the anchor coords */
export interface ApiReturnTripJob extends ApiTransportJob {
  returnDistanceKm: number;
}

// ─── Vehicles ──────────────────────────────────────────────────────────────

export type VehicleType = 'TRUCK' | 'SEMI_TRUCK' | 'TIPPER' | 'FLATBED' | 'VAN' | 'OTHER';

export interface ApiVehicle {
  id: string;
  licensePlate: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  year?: number | null;
  payloadTonnes?: number | null;
  isActive: boolean;
  createdAt: string;
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

// ─── API ──────────────────────────────────────────────────────────────────

export const transportApi = {
  transportJobs: {
    available: (token: string) =>
      apiFetch<ApiTransportJob[]>('/transport-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myActive: (token: string) =>
      apiFetch<ApiTransportJob | null>('/transport-jobs/my-active', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    myJobs: (token: string) =>
      apiFetch<ApiTransportJob[]>('/transport-jobs/my-jobs', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    /** Buyer: returns all disposal & freight jobs the current user requested. */
    myRequests: (token: string) =>
      apiFetch<ApiTransportJob[]>('/transport-jobs/my-requests', {
        headers: { Authorization: `Bearer ${token}` },
      }),

    accept: (id: string, token: string) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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
      dto: { recipientName?: string; notes?: string; photos?: string[] },
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

    /** LoadingDock — seller confirms driver has loaded (AT_PICKUP → LOADED). */
    loadingDock: (id: string, token: string, weightKg?: number) =>
      apiFetch<ApiTransportJob>(`/transport-jobs/${id}/loading-dock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...(weightKg != null ? { weightKg } : {}) }),
      }),
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
  },
};
