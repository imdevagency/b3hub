/**
 * BisService
 *
 * Proxy integration with the Latvian Construction Information System (BIS —
 * Būvniecības informācijas sistēma, https://bis.gov.lv).
 *
 * BIS launched an official REST API in November 2023 (ERAF project
 * "Būvniecības procesu un IS attīstība 2.kārta").  The API is operated by
 * BVKB and covers:
 *   • Construction project preparation
 *   • E-service submissions (ieceres, atļaujas, etc.)
 *   • Construction journal (Būvdarbu žurnāls) filling
 *
 * Access requires company self-registration via the BISP portal and uses
 * OAuth2 client credentials.  Credentials (client_id / client_secret) are
 * stored as PlatformSetting key/value pairs:
 *   bis.clientId        — OAuth2 client ID
 *   bis.clientSecret    — OAuth2 client secret
 *   bis.apiBaseUrl      — Override API base (default: https://bis.gov.lv/bisp)
 *   bis.enabled         — "true" | "false"
 *
 * When credentials are not configured the service falls back to providing
 * deep-links to the public BIS portal so the admin can look up data manually.
 *
 * Registry lookups (Būvkomersantu & Būvspeciālistu reģistrs) also use the
 * authenticated API.  Without credentials a placeholder entry with a direct
 * BIS portal link is returned.
 *
 * For registration and API documentation contact: Liene.Folkmane@bvkb.gov.lv
 * Webinar archive: https://bis.gov.lv/apmacibas/apmacibu-video-arhivs/bis-vebinaru-arhivs
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BIS_PORTAL_BASE = 'https://bis.gov.lv/bisp/lv';
const BIS_DEFAULT_API_BASE = 'https://bis.gov.lv/bisp';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_CACHE_TTL_MS = 55 * 60 * 1000; // 55 min (tokens expire after 60)

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

@Injectable()
export class BisService {
  private readonly logger = new Logger(BisService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getSettings(): Promise<BisSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: ['bis.clientId', 'bis.apiBaseUrl', 'bis.enabled'] } },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const secretRow = await this.prisma.platformSetting.findUnique({
      where: { key: 'bis.clientSecret' },
    });

    return {
      clientId: map['bis.clientId'] ?? '',
      clientSecret: '',
      apiBaseUrl: map['bis.apiBaseUrl'] ?? BIS_DEFAULT_API_BASE,
      enabled: map['bis.enabled'] === 'true',
      hasClientSecret: !!secretRow?.value,
    };
  }

  async updateSettings(
    dto: UpdateBisSettingsDto,
    adminId: string,
  ): Promise<{ ok: boolean }> {
    const upserts = [
      { key: 'bis.clientId', value: dto.clientId },
      { key: 'bis.clientSecret', value: dto.clientSecret },
      { key: 'bis.apiBaseUrl', value: dto.apiBaseUrl || BIS_DEFAULT_API_BASE },
      { key: 'bis.enabled', value: String(dto.enabled ?? true) },
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

    // Invalidate cached OAuth token when credentials change
    this.tokenCache = null;
    return { ok: true };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        return {
          ok: false,
          message: 'Nav konfigurēti BIS API akreditācijas dati',
        };
      }
      // Verify the token works by calling a lightweight endpoint
      const settings = await this.getSettings();
      const base = settings.apiBaseUrl || BIS_DEFAULT_API_BASE;
      const res = await fetch(
        `${base}/api/v1/construction_companies?per_page=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.ok || res.status === 401) {
        // 401 = wrong scope/token; still proves the server responded
        return res.ok
          ? { ok: true, message: 'Savienojums veiksmīgs' }
          : {
              ok: false,
              message: `BIS atbildēja ar ${res.status} — pārbaudiet client_id/secret`,
            };
      }
      return { ok: false, message: `BIS atbildēja ar kļūdu: ${res.status}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn('BIS test connection failed', err);
      return { ok: false, message: `Savienojuma kļūda: ${message}` };
    }
  }

  // ─── OAuth2 token management ────────────────────────────────────────────────

  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const rows = await this.prisma.platformSetting.findMany({
      where: {
        key: {
          in: [
            'bis.clientId',
            'bis.clientSecret',
            'bis.apiBaseUrl',
            'bis.enabled',
          ],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    if (map['bis.enabled'] !== 'true') return null;
    const clientId = map['bis.clientId'];
    const clientSecret = map['bis.clientSecret'];
    if (!clientId || !clientSecret) return null;

    const base = map['bis.apiBaseUrl'] || BIS_DEFAULT_API_BASE;
    // BIS uses OAuth2 client credentials flow.
    // Token endpoint follows standard OAuth2 convention.
    const tokenUrl = `${base}/oauth/token`;

    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });

      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`BIS token request failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        access_token: string;
        expires_in?: number;
      };
      const expiresIn = data.expires_in ?? 3600;
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + Math.min(expiresIn * 1000, TOKEN_CACHE_TTL_MS),
      };
      return data.access_token;
    } catch (err) {
      this.logger.error('BIS OAuth2 token fetch failed', err);
      return null;
    }
  }

  // ─── Company registry ──────────────────────────────────────────────────────

  async searchCompanies(query: string): Promise<BisCompany[]> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException(
        'Meklēšanas vaicājumam jābūt vismaz 2 rakstzīmes',
      );
    }

    const cacheKey = `bis.company.search.${query.trim().toLowerCase()}`;
    const cached = await this.getCached<BisCompany[]>(cacheKey);
    if (cached) return cached;

    const results = await this.fetchCompanies(query.trim());
    await this.setCache(cacheKey, results);
    return results;
  }

  async getCompanyByRegNr(regNr: string): Promise<BisCompany | null> {
    const cacheKey = `bis.company.reg.${regNr}`;
    const cached = await this.getCached<BisCompany | null>(cacheKey);
    if (cached !== undefined) return cached;

    const results = await this.fetchCompanies(regNr);
    const match = results.find((c) => c.regNr === regNr) ?? results[0] ?? null;
    await this.setCache(cacheKey, match);
    return match;
  }

  // ─── Specialist registry ───────────────────────────────────────────────────

  async searchSpecialists(query: string): Promise<BisSpecialist[]> {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException(
        'Meklēšanas vaicājumam jābūt vismaz 2 rakstzīmes',
      );
    }

    const cacheKey = `bis.specialist.search.${query.trim().toLowerCase()}`;
    const cached = await this.getCached<BisSpecialist[]>(cacheKey);
    if (cached) return cached;

    const results = await this.fetchSpecialists(query.trim());
    await this.setCache(cacheKey, results);
    return results;
  }

  // ─── BIS HTTP fetch helpers ────────────────────────────────────────────────

  private async fetchCompanies(query: string): Promise<BisCompany[]> {
    const isRegNr = /^\d{11}$/.test(query.replace(/\s/g, ''));
    const token = await this.getAccessToken();

    if (token) {
      return this.fetchCompaniesApi(query, isRegNr, token);
    }

    // No credentials — return a deep-link placeholder
    return [
      {
        bisId: '',
        name: query,
        regNr: isRegNr ? query : '',
        bisNr: '',
        classGroup: '',
        status: 'NAV_PIESLĒGUMA',
        validFrom: null,
        validTo: null,
        activities: [],
        profileUrl: `${BIS_PORTAL_BASE}/construction_companies?${isRegNr ? 'reg_nr' : 'company_name'}=${encodeURIComponent(query)}`,
      },
    ];
  }

  private async fetchCompaniesApi(
    query: string,
    isRegNr: boolean,
    token: string,
  ): Promise<BisCompany[]> {
    const settings = await this.getSettings();
    const base = settings.apiBaseUrl || BIS_DEFAULT_API_BASE;
    const paramKey = isRegNr ? 'reg_nr' : 'company_name';
    const url = `${base}/api/v1/construction_companies?${paramKey}=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'B3Hub-Admin/1.0',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`BIS company API responded ${res.status}`);
        return [];
      }

      const body = (await res.json()) as unknown;
      return this.normaliseCompanyResponse(body, base);
    } catch (err) {
      this.logger.error('BIS company API fetch failed', err);
      return [];
    }
  }

  private normaliseCompanyResponse(body: unknown, base: string): BisCompany[] {
    const items: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as Record<string, unknown>)?.data)
        ? ((body as Record<string, unknown>).data as unknown[])
        : Array.isArray((body as Record<string, unknown>)?.results)
          ? ((body as Record<string, unknown>).results as unknown[])
          : [];

    return items.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const r = item as Record<string, unknown>;
      return [
        {
          bisId: String(r.id ?? r.bis_id ?? ''),
          name: String(r.name ?? r.nosaukums ?? r.company_name ?? ''),
          regNr: String(r.reg_nr ?? r.registration_number ?? r.regNr ?? ''),
          bisNr: String(r.bis_nr ?? r.bisNr ?? ''),
          classGroup: String(r.class_group ?? r.klase ?? r.classGroup ?? ''),
          status: String(r.status ?? r.statuss ?? 'AKTĪVS'),
          validFrom: (r.valid_from ?? r.validFrom ?? null) as string | null,
          validTo: (r.valid_to ?? r.validTo ?? null) as string | null,
          activities: Array.isArray(r.activities)
            ? r.activities.map(String)
            : [],
          profileUrl: `${base}/lv/construction_companies/${r.id ?? ''}`,
        },
      ];
    });
  }

  private async fetchSpecialists(query: string): Promise<BisSpecialist[]> {
    const token = await this.getAccessToken();

    if (token) {
      return this.fetchSpecialistsApi(query, token);
    }

    return [
      {
        bisId: '',
        name: query,
        certNr: '',
        activity: '',
        classGroup: '',
        status: 'NAV_PIESLĒGUMA',
        validFrom: null,
        validTo: null,
        profileUrl: `${BIS_PORTAL_BASE}/specialist_certificates?name=${encodeURIComponent(query)}`,
      },
    ];
  }

  private async fetchSpecialistsApi(
    query: string,
    token: string,
  ): Promise<BisSpecialist[]> {
    const settings = await this.getSettings();
    const base = settings.apiBaseUrl || BIS_DEFAULT_API_BASE;
    const url = `${base}/api/v1/specialist_certificates?name=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'B3Hub-Admin/1.0',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`BIS specialist API responded ${res.status}`);
        return [];
      }

      const body = (await res.json()) as unknown;
      return this.normaliseSpecialistResponse(body, base);
    } catch (err) {
      this.logger.error('BIS specialist API fetch failed', err);
      return [];
    }
  }

  private normaliseSpecialistResponse(
    body: unknown,
    base: string,
  ): BisSpecialist[] {
    const items: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as Record<string, unknown>)?.data)
        ? ((body as Record<string, unknown>).data as unknown[])
        : [];

    return items.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return [];
      const r = item as Record<string, unknown>;
      return [
        {
          bisId: String(r.id ?? ''),
          name: String(r.name ?? r.vards_uzvards ?? ''),
          certNr: String(r.cert_nr ?? r.certNr ?? r.sertifikats ?? ''),
          activity: String(r.activity ?? r.darbibas_veids ?? ''),
          classGroup: String(r.class_group ?? r.klase ?? ''),
          status: String(r.status ?? r.statuss ?? 'AKTĪVS'),
          validFrom: (r.valid_from ?? r.validFrom ?? null) as string | null,
          validTo: (r.valid_to ?? r.validTo ?? null) as string | null,
          profileUrl: `${base}/lv/specialist_certificates/${r.id ?? ''}`,
        },
      ];
    });
  }

  // ─── Cache helpers ─────────────────────────────────────────────────────────

  private async getCached<T>(key: string): Promise<T | undefined> {
    try {
      const row = await this.prisma.platformSetting.findUnique({
        where: { key },
      });
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
      this.logger.warn(`BIS cache write failed for ${key}`, err);
    }
  }

  async clearCacheForKey(key: string): Promise<void> {
    try {
      await this.prisma.platformSetting.deleteMany({
        where: { key: { startsWith: key } },
      });
    } catch {
      // ignore
    }
  }
}
