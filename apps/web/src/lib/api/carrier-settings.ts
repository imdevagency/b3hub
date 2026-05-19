/**
 * Carrier Settings API module (web).
 * Wraps /api/v1/carrier-settings/* endpoints for service zones and availability.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CarrierServiceZone {
  id: string;
  city: string;
  postcode?: string | null;
  surcharge?: number | null;
}

export interface CarrierBlockedDate {
  id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  reason?: string | null;
}

// ─── Service Zones ─────────────────────────────────────────────────────────

/** Get the carrier's configured service zones. */
export async function getCarrierZones(token: string): Promise<CarrierServiceZone[]> {
  return apiFetch<CarrierServiceZone[]>('/carrier-settings/zones', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Add a new service zone. */
export async function addCarrierZone(
  token: string,
  zone: { city: string; postcode?: string; surcharge?: number },
): Promise<CarrierServiceZone> {
  return apiFetch<CarrierServiceZone>('/carrier-settings/zones', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(zone),
  });
}

/** Remove a service zone by ID. */
export async function deleteCarrierZone(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/carrier-settings/zones/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Availability (Blocked Dates) ──────────────────────────────────────────

/** Get dates the carrier has blocked (unavailable). */
export async function getCarrierBlockedDates(token: string): Promise<CarrierBlockedDate[]> {
  return apiFetch<CarrierBlockedDate[]>('/carrier-settings/availability', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Block a date (mark carrier unavailable). */
export async function blockCarrierDate(
  token: string,
  date: string,
  reason?: string,
): Promise<CarrierBlockedDate> {
  return apiFetch<CarrierBlockedDate>('/carrier-settings/availability', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date, ...(reason ? { reason } : {}) }),
  });
}

/** Remove a blocked date by ID. */
export async function unblockCarrierDate(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/carrier-settings/availability/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Radius ────────────────────────────────────────────────────────────────

export interface CarrierRadiusSettings {
  serviceRadiusKm: number | null;
}

/** Get the carrier's configured service radius (null = no restriction). */
export async function getCarrierRadius(token: string): Promise<CarrierRadiusSettings> {
  return apiFetch<CarrierRadiusSettings>('/carrier-settings/radius', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Update the carrier's service radius (null = no restriction). */
export async function setCarrierRadius(
  token: string,
  radiusKm: number | null,
): Promise<CarrierRadiusSettings> {
  return apiFetch<CarrierRadiusSettings>('/carrier-settings/radius', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ radiusKm }),
  });
}
