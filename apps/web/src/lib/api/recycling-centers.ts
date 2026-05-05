/**
 * Recycling centers API module.
 * Functions to list and manage recycling facility profiles.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RecyclingCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  coordinates?: { lat: number; lng: number } | null;
  acceptedWasteTypes: string[];
  capacity: number;
  certifications: string[];
  operatingHours: Record<string, { open: string; close: string } | null>;
  licensed: boolean;
  licenceNumber: string | null;
  apusRegistrationId: string | null;
  active: boolean;
  company?: { id: string; name: string; logo: string | null };
  createdAt: string;
  updatedAt: string;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getRecyclingCenters(token: string): Promise<RecyclingCenter[]> {
  return apiFetch<RecyclingCenter[]>('/recycling-centers', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getMyRecyclingCenters(token: string): Promise<RecyclingCenter[]> {
  return apiFetch<RecyclingCenter[]>('/recycling-centers/mine', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
