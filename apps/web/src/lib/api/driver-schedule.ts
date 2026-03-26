/**
 * Driver schedule API module.
 * Functions wrapping /api/v1/driver-schedule/* endpoints for availability management.
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DriverScheduleDay {
  id?: string;
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  enabled: boolean;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface DriverDateBlock {
  id: string;
  blockedDate: string;
  reason?: string | null;
  createdAt: string;
}

export interface DriverAvailability {
  id: string;
  isOnline: boolean;
  autoSchedule: boolean;
  maxJobsPerDay: number | null;
  available: boolean;
  effectiveOnline: boolean;
  weeklySchedule: DriverScheduleDay[];
  dateBlocks: DriverDateBlock[];
}

export interface UpdateDriverScheduleInput {
  days: DriverScheduleDay[];
  autoSchedule?: boolean;
  maxJobsPerDay?: number | null;
}

// ─── Functions ─────────────────────────────────────────────────────────────

export async function getDriverAvailability(token: string): Promise<DriverAvailability> {
  return apiFetch<DriverAvailability>('/driver-schedule', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function toggleDriverOnline(
  isOnline: boolean,
  token: string,
): Promise<{ isOnline: boolean }> {
  return apiFetch<{ isOnline: boolean }>('/driver-schedule/online', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isOnline }),
  });
}

export async function updateDriverSchedule(
  data: UpdateDriverScheduleInput,
  token: string,
): Promise<DriverAvailability> {
  return apiFetch<DriverAvailability>('/driver-schedule', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export async function blockDriverDate(
  date: string,
  reason: string | undefined,
  token: string,
): Promise<DriverDateBlock> {
  return apiFetch<DriverDateBlock>('/driver-schedule/blocks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date, reason }),
  });
}

export async function unblockDriverDate(id: string, token: string): Promise<void> {
  await apiFetch<void>(`/driver-schedule/blocks/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
