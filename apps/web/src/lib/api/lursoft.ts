/**
 * Lursoft API module — Latvian company registry via Lursoft IT (https://lursoft.lv).
 *
 * Wraps backend proxy endpoints that server-side call the Lursoft REST API.
 *
 * Endpoints:
 *   GET  /api/v1/lursoft/settings          — admin
 *   PUT  /api/v1/lursoft/settings          — admin
 *   POST /api/v1/lursoft/test-connection   — admin
 *   GET  /api/v1/lursoft/companies?q=      — admin search by name
 *   GET  /api/v1/lursoft/cache/clear       — admin
 *   GET  /api/v1/lursoft/company/:regNr    — platform (auth optional) — reg form auto-fill
 *   GET  /api/v1/lursoft/risk/:regNr       — admin risk check
 */
import { apiFetch } from './common';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LursoftSettings {
  username: string;
  baseUrl: string;
  enabled: boolean;
  hasPassword: boolean;
}

export interface UpdateLursoftSettingsDto {
  username: string;
  password: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface LursoftCompany {
  regNr: string;
  name: string;
  legalForm: string;
  status: string;
  registeredAt: string | null;
  address: string;
  vatNr: string | null;
  nace: string | null;
  naceDescription: string | null;
  email: string | null;
  phone: string | null;
  web: string | null;
  hasInsolvency: boolean;
  hasTaxDebt: boolean;
  hasLiquidation: boolean;
  board: string[];
  lursoftUrl: string;
}

export interface LursoftRiskCheck {
  regNr: string;
  name: string;
  hasInsolvency: boolean;
  hasTaxDebt: boolean;
  hasLiquidation: boolean;
  isActive: boolean;
  checkedAt: string;
}

// ─── Admin: settings ────────────────────────────────────────────────────────

export async function getLursoftSettings(token: string): Promise<LursoftSettings> {
  const data = await apiFetch<{ data: LursoftSettings }>('/lursoft/settings', { token });
  return data.data;
}

export async function updateLursoftSettings(
  dto: UpdateLursoftSettingsDto,
  token: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/lursoft/settings', {
    method: 'PUT',
    body: JSON.stringify(dto),
    token,
  });
}

export async function lursoftTestConnection(token: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch<{ ok: boolean; message: string }>('/lursoft/test-connection', {
    method: 'POST',
    token,
  });
}

// ─── Admin: company search ──────────────────────────────────────────────────

export async function lursoftSearchCompanies(
  q: string,
  token: string,
): Promise<LursoftCompany[]> {
  const data = await apiFetch<{ data: LursoftCompany[] }>(
    `/lursoft/companies?q=${encodeURIComponent(q)}`,
    { token },
  );
  return data.data ?? [];
}

export async function lursoftClearCache(token: string): Promise<void> {
  await apiFetch<{ ok: boolean }>('/lursoft/cache/clear', { token });
}

// ─── Platform: company by reg.nr (registration auto-fill) ──────────────────

export async function lursoftGetCompany(
  regNr: string,
  token?: string,
): Promise<LursoftCompany | null> {
  const data = await apiFetch<{ data: LursoftCompany | null }>(
    `/lursoft/company/${encodeURIComponent(regNr)}`,
    token ? { token } : {},
  );
  return data.data ?? null;
}

// ─── Admin: risk check ───────────────────────────────────────────────────────

export async function lursoftRiskCheck(
  regNr: string,
  token: string,
): Promise<LursoftRiskCheck | null> {
  const data = await apiFetch<{ data: LursoftRiskCheck | null }>(
    `/lursoft/risk/${encodeURIComponent(regNr)}`,
    { token },
  );
  return data.data ?? null;
}
