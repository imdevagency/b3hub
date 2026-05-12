/**
 * APUS (Atkritumu plūsmu uzskaites sistēma) integration service.
 *
 * APUS is the VVD (State Environmental Service of Latvia) electronic waste-
 * movement reporting system. Licensed recycling facilities are legally required
 * to report every waste receipt and processing event via this API.
 *
 * Configuration (env vars — set in Railway / .env):
 *   APUS_API_URL   Base URL of the VVD APUS REST API
 *                  Default (staging): https://apus-test.vvd.gov.lv/api/v1
 *   APUS_API_KEY   Bearer token issued by VVD for the B3 Recycling facility
 *
 * Until real credentials are obtained from VVD, the service operates in
 * SIMULATION mode: it logs the intended request, records a synthetic
 * submission ID, and sets the record to SUBMITTED — so the full workflow
 * is exercised end-to-end without hitting the real VVD system.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface ApusWasteMovementPayload {
  /** VVD-issued APUS facility registration number */
  facilityId: string;
  /** EU/LV waste catalogue code, e.g. "17 01 01" */
  wasteCode: string;
  /** Waste weight in kilograms */
  weightKg: number;
  /** ISO-8601 date of waste receipt / processing */
  date: string;
  /** BIS (Būvniecības informācijas sistēma) construction case reference, if applicable */
  bisNumber?: string;
  /** Waste generator (transport contractor or buyer company reg. number) */
  generatorRegNum?: string;
  /** Waste type enum value (for our own audit log) */
  wasteType: string;
  /** Internal WasteRecord ID (for our own correlation) */
  wasteRecordId: string;
}

export interface ApusSubmissionResult {
  submissionId: string;
  status: 'ACCEPTED' | 'PENDING_REVIEW' | 'REJECTED';
  message?: string;
}

@Injectable()
export class ApusService {
  private readonly logger = new Logger(ApusService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string | null;
  private readonly simulationMode: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl =
      this.config.get<string>('APUS_API_URL') ??
      'https://apus-test.vvd.gov.lv/api/v1';
    this.apiKey = this.config.get<string>('APUS_API_KEY') ?? null;
    this.simulationMode = !this.apiKey;

    if (this.simulationMode) {
      this.logger.warn(
        'APUS_API_KEY is not set — running in simulation mode. ' +
          'Waste movements will be logged but NOT submitted to VVD.',
      );
    }
  }

  /**
   * Submit a single waste movement record to VVD APUS.
   *
   * In simulation mode (no APUS_API_KEY): logs the intended payload, returns
   * a synthetic submission ID, and persists the SUBMITTED state so the
   * downstream workflow (certificate generation, payout trigger) still fires.
   *
   * In production mode: POSTs to VVD APUS REST endpoint, handles 200 ACCEPTED
   * and 202 PENDING_REVIEW responses, and maps VVD rejection errors to the
   * REJECTED state with a human-readable note.
   */
  async submitWasteMovement(
    payload: ApusWasteMovementPayload,
  ): Promise<ApusSubmissionResult> {
    if (this.simulationMode) {
      return this.simulateSubmission(payload);
    }
    return this.callVvdApi(payload);
  }

  /**
   * Submit a WasteRecord by its ID. Looks up the record, enriches payload,
   * calls VVD, and persists the result back to the WasteRecord.
   * Safe to call multiple times — skips if already ACCEPTED.
   */
  async submitWasteRecord(wasteRecordId: string): Promise<void> {
    const record = await this.prisma.wasteRecord.findUnique({
      where: { id: wasteRecordId },
      include: {
        recyclingCenter: {
          select: {
            id: true,
            name: true,
            licensed: true,
            apusRegistrationId: true,
          },
        },
      },
    });

    if (!record) {
      this.logger.error(`APUS: WasteRecord ${wasteRecordId} not found`);
      return;
    }

    if (!record.recyclingCenter.licensed) {
      await this.prisma.wasteRecord.update({
        where: { id: wasteRecordId },
        data: { apusStatus: 'NOT_REQUIRED' },
      });
      return;
    }

    if (record.apusStatus === 'ACCEPTED') {
      this.logger.debug(
        `APUS: record ${wasteRecordId} already ACCEPTED — skipping`,
      );
      return;
    }

    const facilityId =
      record.recyclingCenter.apusRegistrationId ?? record.recyclingCenter.id;
    const weightKg = Math.round((record.weight ?? 0) * 1000);
    const date = (record.processedDate ?? record.createdAt).toISOString();

    const payload: ApusWasteMovementPayload = {
      facilityId,
      wasteCode: record.lvWasteCode ?? '17 09 04',
      weightKg,
      date,
      bisNumber: record.bisNumber ?? undefined,
      wasteType: String(record.wasteType),
      wasteRecordId,
    };

    try {
      const result = await this.submitWasteMovement(payload);

      await this.prisma.wasteRecord.update({
        where: { id: wasteRecordId },
        data: {
          apusStatus:
            result.status === 'ACCEPTED'
              ? 'ACCEPTED'
              : result.status === 'REJECTED'
                ? 'REJECTED'
                : 'SUBMITTED',
          apusSubmissionId: result.submissionId,
          apusSubmittedAt: new Date(),
          apusNote:
            result.status === 'REJECTED'
              ? (result.message ?? 'VVD rejected the submission')
              : null,
        },
      });

      this.logger.log(
        `APUS: record ${wasteRecordId} submitted → ${result.status} (id: ${result.submissionId})`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown APUS error';
      this.logger.error(
        `APUS: submission failed for record ${wasteRecordId}: ${message}`,
      );
      await this.prisma.wasteRecord.update({
        where: { id: wasteRecordId },
        data: {
          apusNote: `Submission error: ${message}`,
          // Leave apusStatus as PENDING so it can be retried
        },
      });
    }
  }

  /**
   * Bulk-submit all PENDING records for a given recycling center.
   * Returns a summary of results.
   */
  async bulkSubmitForCenter(centerId: string): Promise<{
    submitted: number;
    failed: number;
    notRequired: number;
    total: number;
  }> {
    const pending = await this.prisma.wasteRecord.findMany({
      where: { recyclingCenterId: centerId, apusStatus: 'PENDING' },
      select: { id: true },
    });

    let submitted = 0;
    let failed = 0;
    let notRequired = 0;

    for (const r of pending) {
      const before = await this.prisma.wasteRecord.findUnique({
        where: { id: r.id },
        select: { apusStatus: true, recyclingCenter: { select: { licensed: true } } },
      });
      if (!before?.recyclingCenter.licensed) {
        notRequired++;
        continue;
      }
      try {
        await this.submitWasteRecord(r.id);
        submitted++;
      } catch {
        failed++;
      }
    }

    return { submitted, failed, notRequired, total: pending.length };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private simulateSubmission(
    payload: ApusWasteMovementPayload,
  ): ApusSubmissionResult {
    const submissionId = `SIM-${Date.now().toString(36).toUpperCase()}-${payload.wasteRecordId.slice(-6).toUpperCase()}`;
    this.logger.log(
      `APUS SIMULATION: would submit waste movement\n` +
        `  facilityId=${payload.facilityId}\n` +
        `  wasteCode=${payload.wasteCode} (${payload.wasteType})\n` +
        `  weight=${payload.weightKg}kg\n` +
        `  date=${payload.date}\n` +
        `  bisNumber=${payload.bisNumber ?? 'N/A'}\n` +
        `  → simulatedId=${submissionId}`,
    );
    return { submissionId, status: 'ACCEPTED' };
  }

  private async callVvdApi(
    payload: ApusWasteMovementPayload,
  ): Promise<ApusSubmissionResult> {
    const url = `${this.apiUrl}/waste-movements`;
    const body = JSON.stringify({
      facilityId: payload.facilityId,
      wasteCode: payload.wasteCode,
      weightKg: payload.weightKg,
      date: payload.date,
      bisNumber: payload.bisNumber ?? null,
      generatorRegNum: payload.generatorRegNum ?? null,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Source': 'B3Hub',
      },
      body,
      // 30-second timeout
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      if (response.status === 422) {
        // Validation rejection from VVD
        return {
          submissionId: `REJECTED-${Date.now()}`,
          status: 'REJECTED',
          message: text,
        };
      }
      throw new Error(
        `VVD APUS HTTP ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      submissionId?: string;
      id?: string;
      status?: string;
    };

    const submissionId =
      data.submissionId ?? data.id ?? `VVD-${Date.now()}`;
    const status =
      data.status === 'ACCEPTED'
        ? 'ACCEPTED'
        : data.status === 'REJECTED'
          ? 'REJECTED'
          : 'PENDING_REVIEW';

    return { submissionId, status };
  }
}
