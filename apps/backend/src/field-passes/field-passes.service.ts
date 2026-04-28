/**
 * Field Passes service — B3 Fields site access passes.
 *
 * Flow: buyer has an ACTIVE isFieldContract=true FrameworkContract with
 * prepaidBalance > prepaidUsed → creates a FieldPass → PDF generated →
 * driver prints/downloads → presents at gate.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { SupabaseService } from '../supabase/supabase.service';
import { FieldPassStatus, FrameworkContractStatus } from '@prisma/client';
import { CreateFieldPassDto } from './dto/create-field-pass.dto';
import { RevokeFieldPassDto } from './dto/revoke-field-pass.dto';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

@Injectable()
export class FieldPassesService {
  private readonly logger = new Logger(FieldPassesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  // ── List ────────────────────────────────────────────────────────────────────

  async findAll(companyId: string) {
    return this.prisma.fieldPass.findMany({
      where: { companyId },
      include: {
        contract: { select: { contractNumber: true, title: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.fieldPass.findMany({
      include: {
        company: { select: { name: true } },
        contract: { select: { contractNumber: true, title: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Single ──────────────────────────────────────────────────────────────────

  async findOne(id: string, companyId?: string) {
    const pass = await this.prisma.fieldPass.findUnique({
      where: { id },
      include: {
        company: {
          select: { name: true, legalName: true, registrationNum: true },
        },
        contract: {
          select: {
            contractNumber: true,
            title: true,
            prepaidBalance: true,
            prepaidUsed: true,
          },
        },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!pass) throw new NotFoundException('Field pass not found');
    if (companyId && pass.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }
    return pass;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateFieldPassDto, userId: string, companyId: string) {
    // Validate contract
    const contract = await this.prisma.frameworkContract.findUnique({
      where: { id: dto.contractId },
      select: {
        id: true,
        contractNumber: true,
        title: true,
        status: true,
        isFieldContract: true,
        prepaidBalance: true,
        prepaidUsed: true,
        buyerId: true,
      },
    });

    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.isFieldContract) {
      throw new BadRequestException('Contract is not a field access contract');
    }
    if (contract.status !== FrameworkContractStatus.ACTIVE) {
      throw new BadRequestException(
        'Contract must be ACTIVE to create field passes',
      );
    }
    if (contract.buyerId !== companyId) {
      throw new ForbiddenException('Contract does not belong to your company');
    }

    const availableBalance = contract.prepaidBalance - contract.prepaidUsed;
    if (availableBalance <= 0) {
      throw new BadRequestException(
        'Insufficient prepaid balance. Please request an advance invoice to top up.',
      );
    }

    // Generate sequential pass number: FP-YYYY-NNNNN
    const passNumber = await this.generatePassNumber();

    // Create the DB record first (without fileUrl)
    const pass = await this.prisma.fieldPass.create({
      data: {
        passNumber,
        companyId,
        createdById: userId,
        contractId: dto.contractId,
        vehiclePlate: dto.vehiclePlate.toUpperCase().replace(/\s/g, ''),
        driverName: dto.driverName,
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        wasteClassCode: dto.wasteClassCode,
        wasteDescription: dto.wasteDescription,
        unloadingPoint: dto.unloadingPoint,
        estimatedTonnes: dto.estimatedTonnes,
        orderId: dto.orderId,
        status: FieldPassStatus.ACTIVE,
      },
      include: {
        company: {
          select: { name: true, legalName: true, registrationNum: true },
        },
        contract: { select: { contractNumber: true, title: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Generate PDF async — update record when done
    this.generateAndAttachPdf(pass.id, pass, contract.contractNumber).catch(
      (err) =>
        this.logger.error(
          `PDF generation failed for pass ${pass.id}: ${(err as Error).message}`,
        ),
    );

    // Decrement available balance (fire-and-forget — non-critical for immediate response)
    this.prisma.frameworkContract
      .update({
        where: { id: dto.contractId },
        data: { prepaidUsed: { increment: 1 } }, // 1 pass unit; can be weight-based later
      })
      .catch((err) =>
        this.logger.error(
          `Balance decrement failed for contract ${dto.contractId}: ${(err as Error).message}`,
        ),
      );

    return pass;
  }

  // ── Revoke (admin only) ─────────────────────────────────────────────────────

  async revoke(id: string, dto: RevokeFieldPassDto) {
    const pass = await this.prisma.fieldPass.findUnique({ where: { id } });
    if (!pass) throw new NotFoundException('Field pass not found');
    if (pass.status === FieldPassStatus.REVOKED) {
      throw new BadRequestException('Pass is already revoked');
    }

    return this.prisma.fieldPass.update({
      where: { id },
      data: {
        status: FieldPassStatus.REVOKED,
        revokedReason: dto.reason,
        revokedAt: new Date(),
      },
    });
  }

  // ── Gate validation (public — no auth required) ───────────────────────────

  async validateByPassNumber(passNumber: string) {
    const pass = await this.prisma.fieldPass.findUnique({
      where: { passNumber },
      select: {
        id: true,
        passNumber: true,
        vehiclePlate: true,
        driverName: true,
        validFrom: true,
        validTo: true,
        status: true,
        wasteClassCode: true,
        wasteDescription: true,
        unloadingPoint: true,
        estimatedTonnes: true,
        revokedReason: true,
        company: {
          select: { name: true, legalName: true, registrationNum: true },
        },
        contract: { select: { contractNumber: true, title: true } },
      },
    });

    if (!pass) throw new NotFoundException('Pass not found');

    const now = new Date();
    const isValid =
      pass.status === FieldPassStatus.ACTIVE &&
      pass.validFrom <= now &&
      pass.validTo >= now;

    return {
      ...pass,
      isValid,
      validationTimestamp: now.toISOString(),
    };
  }

  // ── Auto-expiry cron — runs daily at 02:00 ──────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireStale() {
    await withCronLock(
      this.prisma,
      'fieldPassExpireStale',
      async () => {
        const result = await this.prisma.fieldPass.updateMany({
          where: {
            status: FieldPassStatus.ACTIVE,
            validTo: { lt: new Date() },
          },
          data: { status: FieldPassStatus.EXPIRED },
        });
        if (result.count > 0) {
          this.logger.log(`Auto-expired ${result.count} field pass(es)`);
        }
      },
      this.logger,
    );
  }

  // ── PDF generation ──────────────────────────────────────────────────────────

  private async generateAndAttachPdf(
    passId: string,
    pass: {
      passNumber: string;
      vehiclePlate: string;
      driverName?: string | null;
      validFrom: Date;
      validTo: Date;
      wasteClassCode?: string | null;
      wasteDescription?: string | null;
      unloadingPoint?: string | null;
      estimatedTonnes?: number | null;
      company: {
        name: string;
        legalName: string;
        registrationNum?: string | null;
      };
      contract: { contractNumber: string; title: string };
    },
    contractNumber: string,
  ) {
    const pdfBuffer = await this.buildPassPdf(pass, contractNumber);
    const storagePath = `field-passes/${pass.passNumber}.pdf`;

    await this.supabase.uploadFile('documents', storagePath, pdfBuffer);
    const fileUrl = this.supabase.getPublicUrl('documents', storagePath);

    await this.prisma.fieldPass.update({
      where: { id: passId },
      data: { fileUrl },
    });
  }

  private buildPassPdf(
    pass: {
      passNumber: string;
      vehiclePlate: string;
      driverName?: string | null;
      validFrom: Date;
      validTo: Date;
      wasteClassCode?: string | null;
      wasteDescription?: string | null;
      unloadingPoint?: string | null;
      estimatedTonnes?: number | null;
      company: {
        name: string;
        legalName: string;
        registrationNum?: string | null;
      };
      contract: { contractNumber: string; title: string };
    },
    _contractNumber: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Generate QR code first, then build PDF
      const scanUrl = `https://b3hub.lv/gate/scan?p=${pass.passNumber}`;
      QRCode.toBuffer(scanUrl, { type: 'png', width: 150, margin: 1 })
        .then((qrBuffer) => {
          const doc = new PDFDocument({ size: 'A4', margin: 50 });
          const chunks: Buffer[] = [];
          doc.on('data', (chunk: Buffer) => chunks.push(chunk));
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);

          const fmt = (d: Date) =>
            d.toLocaleDateString('lv-LV', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });

          // ── Header ──
          doc.fontSize(20).font('Helvetica-Bold').text('B3 LAUKUMI', 50, 50);
          doc
            .fontSize(12)
            .font('Helvetica')
            .text('Caurlaides izziņa / Site Access Pass', 50, 75);
          doc.moveTo(50, 95).lineTo(545, 95).stroke();

          // ── Pass number + QR code ──
          doc
            .fontSize(28)
            .font('Helvetica-Bold')
            .fillColor('#0ea5e9')
            .text(pass.passNumber, 50, 110, { width: 390, align: 'left' });
          doc.fillColor('#000000');

          // QR code — top-right corner of the pass
          doc.image(qrBuffer, 430, 100, { width: 110 });
          doc.fontSize(8).font('Helvetica').fillColor('#666666').text('Skenēt pie vārtiem', 430, 213, { width: 110, align: 'center' });
          doc.fillColor('#000000');

          // ── Company block ──
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Uzņēmums / Company', 50, 160);
          doc
            .font('Helvetica')
            .fontSize(11)
            .text(pass.company.legalName, 50, 175)
            .text(
              pass.company.registrationNum
                ? `Reģ. Nr.: ${pass.company.registrationNum}`
                : '',
              50,
              190,
            );

          // ── Vehicle ──
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Automašīna / Vehicle', 320, 160);
          doc.font('Helvetica').fontSize(14).text(pass.vehiclePlate, 320, 175);
          if (pass.driverName) {
            doc.fontSize(11).text(`Šoferis: ${pass.driverName}`, 320, 193);
          }

          // ── Validity ──
          doc.moveTo(50, 230).lineTo(545, 230).stroke();
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Derīguma termiņš / Valid', 50, 242);
          doc
            .font('Helvetica')
            .fontSize(12)
            .text(`${fmt(pass.validFrom)}  –  ${fmt(pass.validTo)}`, 50, 258);

          // ── Waste / cargo details ──
          doc.moveTo(50, 285).lineTo(545, 285).stroke();
          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('Kravas informācija / Cargo Details', 50, 297);

          const rows: [string, string][] = [];
          if (pass.wasteClassCode)
            rows.push(['Atkritumu kods / Waste code', pass.wasteClassCode]);
          if (pass.wasteDescription)
            rows.push(['Atkritumu apraksts / Description', pass.wasteDescription]);
          if (pass.unloadingPoint)
            rows.push(['Izkraušanas vieta / Unloading point', pass.unloadingPoint]);
          if (pass.estimatedTonnes)
            rows.push([
              'Paredzamais svars / Est. weight',
              `${pass.estimatedTonnes} t`,
            ]);

          let y = 313;
          for (const [label, value] of rows) {
            doc.font('Helvetica-Bold').fontSize(10).text(label, 50, y);
            doc.font('Helvetica').fontSize(11).text(value, 200, y);
            y += 18;
          }

          // ── Contract ref ──
          doc
            .moveTo(50, y + 10)
            .lineTo(545, y + 10)
            .stroke();
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#666666')
            .text(
              `Līgums / Contract: ${pass.contract.contractNumber} — ${pass.contract.title}`,
              50,
              y + 22,
            );

          // ── Footer warning ──
          doc
            .fillColor('#cc0000')
            .fontSize(9)
            .text(
              'UZMANĪBU: Caurlaides derīguma termiņa pārkāpšana vai viltošana ir aizliegta.',
              50,
              y + 45,
            )
            .fillColor('#000000');

          doc.end();
        })
        .catch(reject);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async generatePassNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.fieldPass.count();
    const seq = String(count + 1).padStart(5, '0');
    return `FP-${year}-${seq}`;
  }
}
