/**
 * Weighing Slips service — records actual gate-weighed vehicle weights.
 *
 * Flow:
 *   truck arrives → gate operator opens field pass → submits gross & tare →
 *   net = gross − tare is stored → FieldPass.actualNetTonnes is updated
 *   (accumulative for multi-visit passes).
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FieldPassStatus } from '@prisma/client';
import { CreateWeighingSlipDto } from './dto/create-weighing-slip.dto';
import { VoidWeighingSlipDto } from './dto/void-weighing-slip.dto';

@Injectable()
export class WeighingSlipsService {
  private readonly logger = new Logger(WeighingSlipsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List slips for a field pass ─────────────────────────────────────────────

  async findByPass(fieldPassId: string, requestingCompanyId?: string) {
    const pass = await this.prisma.fieldPass.findUnique({
      where: { id: fieldPassId },
      select: { companyId: true },
    });
    if (!pass) throw new NotFoundException('Field pass not found');

    if (requestingCompanyId && pass.companyId !== requestingCompanyId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.weighingSlip.findMany({
      where: { fieldPassId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  // ── Record a new weighing slip ──────────────────────────────────────────────

  async create(dto: CreateWeighingSlipDto) {
    if (dto.tareTonnes >= dto.grossTonnes) {
      throw new BadRequestException(
        'Tare weight must be less than gross weight',
      );
    }

    const pass = await this.prisma.fieldPass.findUnique({
      where: { id: dto.fieldPassId },
      select: {
        id: true,
        status: true,
        validFrom: true,
        validTo: true,
        actualNetTonnes: true,
      },
    });
    if (!pass) throw new NotFoundException('Field pass not found');

    if (pass.status === FieldPassStatus.REVOKED) {
      throw new BadRequestException(
        'Cannot record weighing for a revoked pass',
      );
    }

    const now = new Date();
    if (pass.validTo < now) {
      throw new BadRequestException('Field pass has expired');
    }

    const netTonnes =
      Math.round((dto.grossTonnes - dto.tareTonnes) * 1000) / 1000;
    const slipNumber = await this.generateSlipNumber();

    const slip = await this.prisma.weighingSlip.create({
      data: {
        slipNumber,
        fieldPassId: dto.fieldPassId,
        grossTonnes: dto.grossTonnes,
        tareTonnes: dto.tareTonnes,
        netTonnes,
        vehiclePlate: dto.vehiclePlate.toUpperCase().replace(/\s/g, ''),
        operatorName: dto.operatorName,
        notes: dto.notes,
      },
    });

    // Accumulate actualNetTonnes on the FieldPass
    await this.prisma.fieldPass.update({
      where: { id: dto.fieldPassId },
      data: {
        actualNetTonnes: (pass.actualNetTonnes ?? 0) + netTonnes,
      },
    });

    this.logger.log(
      `Weighing slip ${slipNumber} recorded: ${netTonnes} t net for pass ${dto.fieldPassId}`,
    );

    return slip;
  }

  // ── Void a slip (admin / operator error correction) ─────────────────────────

  async void(id: string, dto: VoidWeighingSlipDto, isAdmin: boolean) {
    if (!isAdmin)
      throw new ForbiddenException('Only admins can void weighing slips');

    const slip = await this.prisma.weighingSlip.findUnique({ where: { id } });
    if (!slip) throw new NotFoundException('Weighing slip not found');
    if (slip.voidedAt) throw new BadRequestException('Slip is already voided');

    // Roll back net tonnes from the field pass
    await this.prisma.fieldPass.update({
      where: { id: slip.fieldPassId },
      data: { actualNetTonnes: { decrement: slip.netTonnes } },
    });

    return this.prisma.weighingSlip.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedReason: dto.reason,
      },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async generateSlipNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.weighingSlip.count({
      where: { slipNumber: { startsWith: `WS-${year}-` } },
    });
    const seq = String(count + 1).padStart(5, '0');
    return `WS-${year}-${seq}`;
  }
}
