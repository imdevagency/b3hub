/**
 * BIS API module — Latvian Construction Information System (https://bis.gov.lv).
 *
 * Wraps the backend proxy endpoints that server-side call the BIS OAuth2 API.
 *
 * Endpoints:
 *   GET  /api/v1/admin/bis/settings
 *   PUT  /api/v1/admin/bis/settings
 *   POST /api/v1/admin/bis/test-connection
 *   GET  /api/v1/admin/bis/companies?q=...
 *   GET  /api/v1/admin/bis/company?regNr=...
 *   GET  /api/v1/admin/bis/specialists?q=...
 *   GET  /api/v1/admin/bis/cache/clear?prefix=...
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BisSettings {
  clientId: string;
  clientSecret: string;
  apiBaseUrl: string;
  enabled: boolean;
  hasClientSecret: boolean;
}

export interface UpdateBisSettingsDto {
  clientId: string;
  clientSecret: string;
  apiBaseUrl?: string;
  enabled: boolean;
}

export interface BisCompany {
  bisId: string;
  name: string;
  regNr: string;
  bisNr: string;
  classGroup: string;
  status: string;
  validFrom: string | null;
  validTo: string | null;
  activities: string[];
  profileUrl: string;
}

export interface BisSpecialist {
  bisId: string;
  name: string;
  certNr: string;
  activity: string;
  classGroup: string;
  status: string;
  validFrom: string | null;
  validTo: string | null;
  profileUrl: string;
}

// ─── Settings ──────────────────────────────────────────────────────────────

export async function getBisSettings(token: string): Promise<BisSettings> {
  const data = await apiFetch<{ data: BisSettings }>('/admin/bis/settings', { token });
  return data.data;
}

export async function updateBisSettings(
  token: string,
  dto: UpdateBisSettingsDto,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/admin/bis/settings', {
    token,
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function bisTestConnection(token: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>('/admin/bis/test-connection', {
    token,
    method: 'POST',
  });
}

// ─── Company registry ───────────────────────────────────────────────────────

export async function bisSearchCompanies(
  token: string,
  query: string,
): Promise<BisCompany[]> {
  const data = await apiFetch<{ data: BisCompany[] }>(
    `/admin/bis/companies?q=${encodeURIComponent(query)}`,
    { token },
  );
  return data.data;
}

export async function bisGetCompanyByRegNr(
  token: string,
  regNr: string,
): Promise<BisCompany | null> {
  const data = await apiFetch<{ data: BisCompany | null }>(
    `/admin/bis/company?regNr=${encodeURIComponent(regNr)}`,
    { token },
  );
  return data.data;
}

// ─── Specialist registry ────────────────────────────────────────────────────

export async function bisSearchSpecialists(
  token: string,
  query: string,
): Promise<BisSpecialist[]> {
  const data = await apiFetch<{ data: BisSpecialist[] }>(
    `/admin/bis/specialists?q=${encodeURIComponent(query)}`,
    { token },
  );
  return data.data;
}

// ─── Cache management ───────────────────────────────────────────────────────

export async function bisClearCache(
  token: string,
  prefix?: string,
): Promise<void> {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  await apiFetch<{ ok: boolean }>(`/admin/bis/cache/clear${qs}`, { token });
}
