/**
 * lib/api/carrier-settings.ts
 *
 * Carrier Settings API — skip-hire pricing, service zones, availability.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export type SkipSize = 'MINI' | 'MIDI' | 'BUILDERS' | 'LARGE';

export interface CarrierPricing {
  id: string;
  skipSize: SkipSize;
  price: number;
  currency: string;
}

export interface CarrierServiceZone {
  id: string;
  city: string;
  postcode?: string | null;
  surcharge?: number | null;
}

export interface CarrierBlockedDate {
  id: string;
  date: string; // "YYYY-MM-DD"
  reason?: string | null;
}

export interface CarrierRadiusSettings {
  serviceRadiusKm: number | null;
}

// ─── API ──────────────────────────────────────────────────────────────────

export const carrierSettingsApi = {
  pricing: {
    get: (token: string) =>
      apiFetch<CarrierPricing[]>('/carrier-settings/pricing', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    set: (token: string, size: SkipSize, price: number) =>
      apiFetch<CarrierPricing>(`/carrier-settings/pricing/${size}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      }),
    delete: (token: string, size: SkipSize) =>
      apiFetch<void>(`/carrier-settings/pricing/${size}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  zones: {
    get: (token: string) =>
      apiFetch<CarrierServiceZone[]>('/carrier-settings/zones', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    add: (token: string, zone: { city: string; postcode?: string; surcharge?: number }) =>
      apiFetch<CarrierServiceZone>('/carrier-settings/zones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(zone),
      }),
    delete: (token: string, id: string) =>
      apiFetch<void>(`/carrier-settings/zones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  availability: {
    get: (token: string) =>
      apiFetch<CarrierBlockedDate[]>('/carrier-settings/availability', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    block: (token: string, date: string, reason?: string) =>
      apiFetch<CarrierBlockedDate>('/carrier-settings/availability', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...(reason ? { reason } : {}) }),
      }),
    unblock: (token: string, id: string) =>
      apiFetch<void>(`/carrier-settings/availability/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  radius: {
    get: (token: string) =>
      apiFetch<CarrierRadiusSettings>('/carrier-settings/radius', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    set: (token: string, radiusKm: number | null) =>
      apiFetch<CarrierRadiusSettings>('/carrier-settings/radius', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ radiusKm }),
      }),
  },
};
