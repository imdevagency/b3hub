/**
 * Carrier settings service.
 * Manages transport pricing configurations: per-km rates, minimum charges,
 * zone-based pricing, and vehicle-type-specific overrides.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CompanyType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlockDateDto } from './dto/block-date.dto';
import { CreateZoneDto } from './dto/create-zone.dto';

const ALLOWED_TYPES: CompanyType[] = ['CARRIER', 'HYBRID'];

@Injectable()
export class CarrierSettingsService {
  private readonly logger = new Logger(CarrierSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Guard helper ────────────────────────────────────────────────────────────
  private async requireCarrierCompany(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user?.company) {
      throw new ForbiddenException(
        'No company is associated with your account',
      );
    }
    if (!ALLOWED_TYPES.includes(user.company.companyType)) {
      throw new ForbiddenException(
        'Your company must be type CARRIER or HYBRID to manage carrier settings',
      );
    }
    return user.company;
  }

  // ── Pricing ────────────────────────────────────────────────────────────────

  async getPricing(userId: string) {
    const company = await this.requireCarrierCompany(userId);
    return this.prisma.carrierPricing.findMany({
      where: { carrierId: company.id },
      orderBy: { skipSize: 'asc' },
    });
  }

  async setPrice(userId: string, size: string, price: number) {
    const company = await this.requireCarrierCompany(userId);
    return this.prisma.carrierPricing.upsert({
      where: { carrierId_skipSize: { carrierId: company.id, skipSize: size } },
      create: { carrierId: company.id, skipSize: size, price },
      update: { price },
    });
  }

  async deletePrice(userId: string, size: string) {
    const company = await this.requireCarrierCompany(userId);
    await this.prisma.carrierPricing.deleteMany({
      where: { carrierId: company.id, skipSize: size },
    });
  }

  // ── Service zones ──────────────────────────────────────────────────────────

  async getZones(userId: string) {
    const company = await this.requireCarrierCompany(userId);
    return this.prisma.carrierServiceZone.findMany({
      where: { carrierId: company.id },
      orderBy: { city: 'asc' },
    });
  }

  async addZone(userId: string, dto: CreateZoneDto) {
    const company = await this.requireCarrierCompany(userId);
    return this.prisma.carrierServiceZone.create({
      data: {
        carrierId: company.id,
        city: dto.city,
        postcode: dto.postcode,
        surcharge: dto.surcharge ?? 0,
      },
    });
  }

  async removeZone(userId: string, zoneId: string) {
    const company = await this.requireCarrierCompany(userId);
    const zone = await this.prisma.carrierServiceZone.findUnique({
      where: { id: zoneId },
    });
    if (!zone || zone.carrierId !== company.id) {
      throw new NotFoundException('Service zone not found');
    }
    await this.prisma.carrierServiceZone.delete({ where: { id: zoneId } });
  }

  // ── Availability blocks ────────────────────────────────────────────────────

  async getBlocked(userId: string) {
    const company = await this.requireCarrierCompany(userId);
    return this.prisma.carrierAvailability.findMany({
      where: { carrierId: company.id },
      orderBy: { blockedDate: 'asc' },
    });
  }

  async blockDate(userId: string, dto: BlockDateDto) {
    const company = await this.requireCarrierCompany(userId);
    const blockedDate = new Date(dto.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (blockedDate < today) {
      throw new BadRequestException('Cannot block a date in the past');
    }
    return this.prisma.carrierAvailability.upsert({
      where: {
        carrierId_blockedDate: { carrierId: company.id, blockedDate },
      },
      create: { carrierId: company.id, blockedDate, reason: dto.reason },
      update: { reason: dto.reason },
    });
  }

  async unblockDate(userId: string, blockId: string) {
    const company = await this.requireCarrierCompany(userId);
    const block = await this.prisma.carrierAvailability.findUnique({
      where: { id: blockId },
    });
    if (!block || block.carrierId !== company.id) {
      throw new NotFoundException('Availability block not found');
    }
    await this.prisma.carrierAvailability.delete({ where: { id: blockId } });
  }

  // ── Radius ───────────────────────────────────────────────────────────────

  async getRadius(userId: string) {
    const company = await this.requireCarrierCompany(userId);
    return { serviceRadiusKm: company.serviceRadiusKm };
  }

  async setRadius(userId: string, radiusKm: number | null | undefined) {
    const company = await this.requireCarrierCompany(userId);
    return this.prisma.company.update({
      where: { id: company.id },
      data: { serviceRadiusKm: radiusKm ?? null },
      select: { serviceRadiusKm: true },
    });
  }
}
