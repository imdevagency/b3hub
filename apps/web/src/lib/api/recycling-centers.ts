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
  lat?: number;
  lng?: number;
  phone?: string;
  openingHours?: string;
  materials: string[];
  company?: { id: string; name: string };
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
