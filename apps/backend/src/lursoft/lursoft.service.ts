/**
 * LursoftService
 *
 * Integration with Lursoft IT — Latvia's leading company data provider
 * (https://lursoft.lv). Lursoft aggregates data directly from the
 * Enterprise Register of the Republic of Latvia plus court, insolvency,
 * and tax-debt registries.
 *
 * API specification: https://www.lursoft.lv/uploads/doc/API_service_1.3.68_en.pdf
 * Contact: info@lursoft.lv / +371 67844300
 *
 * Authentication: HTTP Basic Auth — username (Lursoft login e-mail) +
 * password (Lursoft API password). All requests are HTTPS.
 *
 * Base URL: https://api.lursoft.lv  (or per-account URL provided by Lursoft)
 *
 * Credentials are stored as PlatformSetting key/value pairs:
 *   lursoft.username   — Lursoft account e-mail
 *   lursoft.password   — Lursoft API password
 *   lursoft.baseUrl    — Override API base (default: https://api.lursoft.lv)
 *   lursoft.enabled    — "true" | "false"
 *
 * Primary use cases for B3Hub:
 *   1. Company auto-fill at B2B registration — type reg.nr, get name/address/VAT
 *   2. Admin company verification — check for insolvency, tax debts, status
 *   3. Risk signals on order placement — warn if buyer company has active risk flags
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LURSOFT_DEFAULT_BASE = 'https://api.lursoft.lv';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Public types ────────────────────────────────────────────────────────────

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
  // Risk signals
  hasInsolvency: boolean;
  hasTaxDebt: boolean;
  hasLiquidation: boolean;
  // Officials
  board: string[];
  // Source link
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

@Injectable()
export class LursoftService {
  private readonly logger = new Logger(LursoftService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getSettings(): Promise<LursoftSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: ['lursoft.username', 'lursoft.baseUrl', 'lursoft.enabled'] } },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const hasPassword = !!(await this.prisma.platformSetting.findUnique({
      where: { key: 'lursoft.password' },
    }))?.value;

    return {
      username: map['lursoft.username'] ?? '',
      baseUrl: map['lursoft.baseUrl'] ?? LURSOFT_DEFAULT_BASE,
      enabled: map['lursoft.enabled'] === 'true',
      hasPassword,
    };
  }

  async updateSettings(dto: UpdateLursoftSettingsDto, adminId: string): Promise<{ ok: boolean }> {
    const upserts = [
      { key: 'lursoft.username', value: dto.username },
      { key: 'lursoft.password', value: dto.password },
      { key: 'lursoft.baseUrl', value: dto.baseUrl || LURSOFT_DEFAULT_BASE },
      { key: 'lursoft.enabled', value: String(dto.enabled ?? true) },
    ];

    await this.prisma.$transaction(
      upserts.map((s) =>
        this.prisma.platformSetting.upsert({
          where: { key: s.key },
          create: { key: s.key, value: s.value, updatedBy: adminId },
          update: { value: s.value, updatedBy: adminId },
        }),
      ),
    );

    return { ok: true };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const creds = await this.loadCredentials();
    if (!creds) {
      return { ok: false, message: 'Nav konfigurēti Lursoft akreditācijas dati' };
    }

    try {
      // Ping with a known Latvian reg.nr (Lursoft itself: 40003030799)
      const res = await fetch(`${creds.base}/get_company_short_info?reģ_nr=40003030799`, {
        headers: this.authHeaders(creds),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) return { ok: true, message: 'Savienojums veiksmīgs' };
      if (res.status === 401) return { ok: false, message: 'Nepareizi akreditācijas dati (401)' };
      return { ok: false, message: `Lursoft atbildēja ar kļūdu: ${res.status}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn('Lursoft test connection failed', err);
      return { ok: false, message: `Savienojuma kļūda: ${message}` };
    }
  }

  // ─── Company lookup ──────────────────────────────────────────────────────────

  /**
   * Look up a company by exact registration number.
   * Used by registration forms for auto-fill (no auth required on the caller side —
   * authentication to Lursoft is done server-side).
   */
  async getCompanyByRegNr(regNr: string): Promise<LursoftCompany | null> {
    const clean = regNr.replace(/\s/g, '');
    const cacheKey = `lursoft.company.${clean}`;

    const cached = await this.getCached<LursoftCompany>(cacheKey);
    if (cached !== undefined) return cached;

    const creds = await this.loadCredentials();
    if (!creds) return this.buildPlaceholder(clean, null);

    const company = await this.fetchCompanyFromApi(clean, creds);
    await this.setCache(cacheKey, company);
    return company;
  }

  /**
   * Search companies by name fragment (for admin lookup tool).
   */
  async searchCompanies(query: string): Promise<LursoftCompany[]> {
    const cacheKey = `lursoft.search.${query.trim().toLowerCase()}`;
    const cached = await this.getCached<LursoftCompany[]>(cacheKey);
    if (cached !== undefined) return cached;

    const creds = await this.loadCredentials();
    if (!creds) {
      return [this.buildPlaceholder('', query)];
    }

    const results = await this.fetchSearchFromApi(query.trim(), creds);
    await this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Quick risk check — returns only risk flags, suitable for order placement warnings.
   */
  async riskCheck(regNr: string): Promise<LursoftRiskCheck | null> {
    const company = await this.getCompanyByRegNr(regNr);
    if (!company) return null;

    return {
      regNr: company.regNr,
      name: company.name,
      hasInsolvency: company.hasInsolvency,
      hasTaxDebt: company.hasTaxDebt,
      hasLiquidation: company.hasLiquidation,
      isActive: /aktīv|active|reģistr/i.test(company.status),
      checkedAt: new Date().toISOString(),
    };
  }

  async clearCacheForKey(prefix: string): Promise<void> {
    try {
      await this.prisma.platformSetting.deleteMany({
        where: { key: { startsWith: prefix } },
      });
    } catch {
      // ignore
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async loadCredentials(): Promise<{ base: string; username: string; password: string } | null> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: ['lursoft.username', 'lursoft.password', 'lursoft.baseUrl', 'lursoft.enabled'] } },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    if (map['lursoft.enabled'] !== 'true') return null;
    const username = map['lursoft.username'];
    const password = map['lursoft.password'];
    if (!username || !password) return null;

    return {
      base: map['lursoft.baseUrl'] || LURSOFT_DEFAULT_BASE,
      username,
      password,
    };
  }

  private authHeaders(creds: { username: string; password: string }): Record<string, string> {
    const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    return {
      Authorization: `Basic ${encoded}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'B3Hub/1.0',
    };
  }

  private async fetchCompanyFromApi(
    regNr: string,
    creds: { base: string; username: string; password: string },
  ): Promise<LursoftCompany | null> {
    try {
      const url = `${creds.base}/get_company_short_info?reģ_nr=${encodeURIComponent(regNr)}`;
      const res = await fetch(url, {
        headers: this.authHeaders(creds),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        this.logger.warn(`Lursoft company lookup responded ${res.status}`);
        return null;
      }

      const body = (await res.json()) as unknown;
      return this.normaliseCompany(body, regNr);
    } catch (err) {
      this.logger.error('Lursoft company fetch failed', err);
      return null;
    }
  }

  private async fetchSearchFromApi(
    query: string,
    creds: { base: string; username: string; password: string },
  ): Promise<LursoftCompany[]> {
    try {
      const url = `${creds.base}/search_companies?name=${encodeURIComponent(query)}&limit=20`;
      const res = await fetch(url, {
        headers: this.authHeaders(creds),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`Lursoft search responded ${res.status}`);
        return [];
      }

      const body = (await res.json()) as unknown;
      const items: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray((body as Record<string, unknown>)?.data)
          ? ((body as Record<string, unknown>).data as unknown[])
          : [];

      return items.flatMap((item) => {
        const c = this.normaliseCompany(item, '');
        return c ? [c] : [];
      });
    } catch (err) {
      this.logger.error('Lursoft search fetch failed', err);
      return [];
    }
  }

  /**
   * Normalise a raw Lursoft API response to our LursoftCompany shape.
   * Lursoft API v1.3 returns camelCase JSON.
   */
  private normaliseCompany(raw: unknown, fallbackRegNr: string): LursoftCompany | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;

    const regNr = String(r.regNr ?? r.reg_nr ?? r.registration_number ?? fallbackRegNr);
    const name = String(r.name ?? r.companyName ?? r.nosaukums ?? '');
    if (!name && !regNr) return null;

    const officials = (r.officials ?? r.board ?? r.boardMembers ?? []) as unknown[];
    const board: string[] = Array.isArray(officials)
      ? officials.map((o) => {
          if (typeof o === 'string') return o;
          if (typeof o === 'object' && o !== null) {
            const p = o as Record<string, unknown>;
            return String(p.name ?? p.fullName ?? p.vards ?? '');
          }
          return '';
        }).filter(Boolean)
      : [];

    return {
      regNr,
      name,
      legalForm: String(r.legalForm ?? r.legal_form ?? r.juridiskaisStatuss ?? ''),
      status: String(r.status ?? r.statuss ?? 'AKTĪVS'),
      registeredAt: (r.registrationDate ?? r.registration_date ?? r.registeredAt ?? null) as string | null,
      address: String(r.address ?? r.legalAddress ?? r.adrese ?? ''),
      vatNr: (r.vatNumber ?? r.vat_number ?? r.pvn ?? null) as string | null,
      nace: (r.naceCode ?? r.nace_code ?? r.nace ?? null) as string | null,
      naceDescription: (r.naceDescription ?? r.nace_description ?? null) as string | null,
      email: (r.email ?? null) as string | null,
      phone: (r.phone ?? r.telefons ?? null) as string | null,
      web: (r.web ?? r.website ?? r.www ?? null) as string | null,
      hasInsolvency: Boolean(r.hasInsolvency ?? r.insolvency ?? r.maksatnespeja ?? false),
      hasTaxDebt: Boolean(r.hasTaxDebt ?? r.taxDebt ?? r.nodesunu_paradi ?? false),
      hasLiquidation: Boolean(r.hasLiquidation ?? r.liquidation ?? r.likvidacija ?? false),
      board,
      lursoftUrl: `https://lursoft.lv/lv/uznemums/${encodeURIComponent(name)}/${regNr}`,
    };
  }

  private buildPlaceholder(regNr: string, name: string | null): LursoftCompany {
    return {
      regNr,
      name: name ?? regNr,
      legalForm: '',
      status: 'NAV_PIESLĒGUMA',
      registeredAt: null,
      address: '',
      vatNr: null,
      nace: null,
      naceDescription: null,
      email: null,
      phone: null,
      web: null,
      hasInsolvency: false,
      hasTaxDebt: false,
      hasLiquidation: false,
      board: [],
      lursoftUrl: `https://lursoft.lv/lv/search?q=${encodeURIComponent(name ?? regNr)}`,
    };
  }

  private async getCached<T>(key: string): Promise<T | undefined> {
    try {
      const row = await this.prisma.platformSetting.findUnique({ where: { key } });
      if (!row) return undefined;
      const payload = JSON.parse(row.value) as { data: T; cachedAt: number };
      if (Date.now() - payload.cachedAt > CACHE_TTL_MS) return undefined;
      return payload.data;
    } catch {
      return undefined;
    }
  }

  private async setCache(key: string, data: unknown): Promise<void> {
    const value = JSON.stringify({ data, cachedAt: Date.now() });
    try {
      await this.prisma.platformSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    } catch (err) {
      this.logger.warn(`Lursoft cache write failed for ${key}`, err);
    }
  }
}
