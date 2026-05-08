/**
 * JumisService
 *
 * Manages the integration between B3Hub and the Jumis cloud accounting system
 * (https://mansjumis.lv). Jumis exposes a REST API that accepts XML-wrapped
 * import/export requests over HTTPS.
 *
 * REST API reference: https://atbalsts.mansjumis.lv/hc/lv/articles/6482469051922
 *
 * Credentials are stored as PlatformSetting key/value pairs:
 *   jumis.username   — Jumis cloud e-mail
 *   jumis.password   — SQL password (separate from web login password)
 *   jumis.database   — Jumis database name
 *   jumis.enabled    — "true" | "false"
 *
 * The API key "2BFC1C2B748D4C04BB0ECABA7FBFB1A6" is a fixed Jumis REST-API
 * access key shared across all integrations (public in Jumis docs).
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateJumisSettingsDto, JumisSyncRequestDto } from './dto/jumis.dto';

// Jumis fixed REST API key (public in official documentation)
const JUMIS_REST_APIKEY = '2BFC1C2B748D4C04BB0ECABA7FBFB1A6';
const JUMIS_BASE_URL =
  'https://vadiba.mansjumis.lv/cloudapi/JumisImportExportService.ImportExportService.svc';

@Injectable()
export class JumisService {
  private readonly logger = new Logger(JumisService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Settings ───────────────────────────────────────────────────────────────

  async getSettings() {
    const rows = await this.prisma.platformSetting.findMany({
      where: {
        key: { in: ['jumis.username', 'jumis.database', 'jumis.enabled'] },
      },
    });

    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }

    return {
      username: map['jumis.username'] ?? '',
      database: map['jumis.database'] ?? '',
      enabled: map['jumis.enabled'] === 'true',
      // password is intentionally omitted from GET response
      hasPassword: !!(await this.prisma.platformSetting.findUnique({
        where: { key: 'jumis.password' },
      })),
    };
  }

  async updateSettings(dto: UpdateJumisSettingsDto, adminId: string) {
    const upserts = [
      { key: 'jumis.username', value: dto.username },
      { key: 'jumis.password', value: dto.password },
      { key: 'jumis.database', value: dto.database },
      { key: 'jumis.enabled', value: String(dto.enabled ?? true) },
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

  // ─── Connection test ─────────────────────────────────────────────────────────

  async testConnection() {
    const creds = await this.loadCredentials();

    // Minimal export request — read first partner to verify credentials
    const xmlRequest = `<?xml version="1.0" ?><dataroot><tjDocument Version="TJ5.5.101"/><tjRequest Name="Partner" Operation="Read" Version="TJ7.0.112" Structure="Tree"><tjFields><Field Name="PartnerName"/></tjFields></tjRequest></dataroot>`;

    try {
      const result = await this.callJumisApi('/export', creds, xmlRequest);
      return { ok: true, message: 'Savienojums veiksmīgs', response: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    }
  }

  // ─── Sync ────────────────────────────────────────────────────────────────────

  async syncData(dto: JumisSyncRequestDto, adminId: string) {
    const creds = await this.loadCredentials();

    let pushed = 0;
    let xmlRequest: string;

    if (dto.syncType === 'partners') {
      const partners = await this.loadPartners(dto.since);
      xmlRequest = this.buildPartnersXml(partners);
      pushed = partners.length;
    } else {
      const invoices = await this.loadInvoices(dto.since);
      xmlRequest = this.buildInvoicesXml(invoices);
      pushed = invoices.length;
    }

    if (pushed === 0) {
      return {
        ok: true,
        pushed: 0,
        message: 'Nav jaunu ierakstu sinhronizācijai',
      };
    }

    let responseData: unknown;
    let success = false;
    let errorMessage: string | null = null;

    try {
      responseData = await this.callJumisApi('/import', creds, xmlRequest);
      success = true;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Jumis sync failed: ${errorMessage}`);
    }

    // Audit log
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: `JUMIS_SYNC_${dto.syncType.toUpperCase()}`,
        entityType: 'JumisSync',
        entityId: dto.syncType,
        after: {
          pushed,
          success,
          error: errorMessage,
          since: dto.since ?? null,
          response: success ? (responseData as object) : null,
        },
      },
    });

    if (!success) {
      throw new BadRequestException(
        `Jumis sinhronizācija neizdevās: ${errorMessage}`,
      );
    }

    return {
      ok: true,
      pushed,
      message: `${pushed} ieraksti nosūtīti uz Jumis`,
    };
  }

  async getSyncLog() {
    const logs = await this.prisma.adminAuditLog.findMany({
      where: { entityType: 'JumisSync' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        entityId: true,
        after: true,
        createdAt: true,
        admin: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return logs;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async loadCredentials() {
    const rows = await this.prisma.platformSetting.findMany({
      where: {
        key: {
          in: [
            'jumis.username',
            'jumis.password',
            'jumis.database',
            'jumis.enabled',
          ],
        },
      },
    });

    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }

    if (
      !map['jumis.username'] ||
      !map['jumis.password'] ||
      !map['jumis.database']
    ) {
      throw new BadRequestException(
        'Jumis savienojums nav konfigurēts. Aizpildiet iestatījumus.',
      );
    }

    if (map['jumis.enabled'] !== 'true') {
      throw new BadRequestException('Jumis integrācija nav iespējota.');
    }

    return {
      username: map['jumis.username'],
      password: map['jumis.password'],
      database: map['jumis.database'],
    };
  }

  private async callJumisApi(
    path: '/import' | '/export',
    creds: { username: string; password: string; database: string },
    xmlRequest: string,
  ): Promise<unknown> {
    const url = `${JUMIS_BASE_URL}${path}`;

    const body = JSON.stringify({
      username: creds.username,
      password: creds.password,
      database: creds.database,
      apikey: JUMIS_REST_APIKEY,
      XMLrequest: xmlRequest,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Jumis API atbildēja ar kļūdu: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  }

  /** Load companies from B3Hub for partner sync */
  private async loadPartners(since?: string) {
    return this.prisma.company.findMany({
      where: since ? { updatedAt: { gte: new Date(since) } } : {},
      select: {
        id: true,
        legalName: true,
        registrationNum: true,
        taxId: true,
        email: true,
        phone: true,
        street: true,
        city: true,
        postalCode: true,
        country: true,
      },
      take: 500,
    });
  }

  /** Load invoices from B3Hub for financial document sync */
  private async loadInvoices(since?: string) {
    return this.prisma.invoice.findMany({
      where: since ? { createdAt: { gte: new Date(since) } } : {},
      include: {
        buyerCompany: {
          select: {
            legalName: true,
            registrationNum: true,
            taxId: true,
          },
        },
      },
      take: 500,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Build Jumis XML for partner import */
  private buildPartnersXml(
    partners: Array<{
      id: string;
      legalName: string;
      registrationNum?: string | null;
      taxId?: string | null;
      email?: string | null;
      phone?: string | null;
      street?: string | null;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
    }>,
  ): string {
    const partnerXml = partners
      .map((p) => {
        const esc = (v: string | null | undefined) =>
          (v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const name = esc(p.legalName);
        const reg = esc(p.registrationNum);
        const vat = esc(p.taxId);
        const street = esc(p.street);
        const city = esc(p.city);
        const postal = esc(p.postalCode);
        const country = esc(p.country) || 'LV';

        return `<Partner>
  <PartnerKindName>Juridiska persona</PartnerKindName>
  <PartnerName>${name}</PartnerName>
  ${reg ? `<PartnerRegistrationNo>${reg}</PartnerRegistrationNo>` : ''}
  ${vat ? `<PartnerVatNo><VatNo>${vat}</VatNo><VatNoCountryCode>LV</VatNoCountryCode><VatNoDefaultNoticeID>1</VatNoDefaultNoticeID></PartnerVatNo>` : ''}
  <PartnerAddress>
    <AddressStreet>${street}</AddressStreet>
    <AddressCity>${city}</AddressCity>
    <AddressCountryCode>${country}</AddressCountryCode>
    <AddressPostalCode>${postal}</AddressPostalCode>
    <AddressJuridicalNoticeID>1</AddressJuridicalNoticeID>
    <AddressDefaultNoticeID>1</AddressDefaultNoticeID>
  </PartnerAddress>
</Partner>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8" ?><dataroot><tjDocument Version="TJ5.5.101"/><tjResponse Name="Partner" Operation="Insert" Version="TJ7.0.112" Structure="Tree">${partnerXml}</tjResponse></dataroot>`;
  }

  /** Build Jumis XML for financial document (invoice) import */
  private buildInvoicesXml(
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      total: number;
      createdAt: Date;
      buyerCompany?: {
        legalName: string;
        registrationNum?: string | null;
        taxId?: string | null;
      } | null;
    }>,
  ): string {
    const docXml = invoices
      .map((inv) => {
        const esc = (v: string | null | undefined) =>
          (v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const docDate = inv.createdAt.toISOString().slice(0, 10);
        const partnerName = inv.buyerCompany
          ? esc(inv.buyerCompany.legalName)
          : 'Fiziska persona';
        const total = (inv.total ?? 0).toFixed(2);
        const docNo = esc(inv.invoiceNumber);

        return `<Document>
  <DocumentKindName>Rēķins</DocumentKindName>
  <DocumentNo>${docNo}</DocumentNo>
  <DocumentDate>${docDate}</DocumentDate>
  <DocumentPartnerName>${partnerName}</DocumentPartnerName>
  <DocumentSum>${total}</DocumentSum>
  <DocumentCurrencyCode>EUR</DocumentCurrencyCode>
</Document>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="utf-8" ?><dataroot><tjDocument Version="TJ5.5.101"/><tjResponse Name="Document" Operation="Insert" Version="TJ7.0.112" Structure="Tree">${docXml}</tjResponse></dataroot>`;
  }
}
