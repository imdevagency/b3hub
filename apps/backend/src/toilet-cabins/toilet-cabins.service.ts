/**
 * Toilet Cabin Rental service.
 * Handles booking creation, listing, status lifecycle, and carrier marketplace
 * features (quote engine, carrier settings, order management).
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateToiletCabinDto } from './dto/create-toilet-cabin.dto';
import { UpdateToiletCabinStatusDto } from './dto/update-toilet-cabin-status.dto';
import { ToiletCabinStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';

// Platform base rate (EUR/cabin/day) used when no carrier is selected.
const BASE_PRICE_PER_CABIN_PER_DAY = 12;

export interface ToiletCabinQuoteResult {
  carrierId: string;
  carrierName: string;
  carrierLogo: string | null;
  pricePerCabinPerDay: number;
  totalPrice: number; // pricePerCabinPerDay * cabinCount * hireDays
  currency: string;
  maxCabins: number;
}

export class SetToiletCabinSettingsDto {
  pricePerCabinPerDay: number;
  maxCabins: number;
  serviceCities: string[];
  isActive: boolean;
}

@Injectable()
export class ToiletCabinsService {
  private readonly logger = new Logger(ToiletCabinsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create (public — optional auth) ───────────────────────────
  async create(dto: CreateToiletCabinDto, userId?: string) {
    const orderNumber = this.generateOrderNumber();

    let price: number;
    const carrierId: string | null = dto.carrierId ?? null;

    if (carrierId) {
      // Re-derive price server-side from carrier's own settings
      const settings = await this.prisma.carrierToiletCabinSettings.findUnique({
        where: { carrierId },
        select: { pricePerCabinPerDay: true, isActive: true },
      });
      if (!settings || !settings.isActive) {
        throw new BadRequestException('Selected carrier is not available');
      }
      price = settings.pricePerCabinPerDay * dto.cabinCount * dto.hireDays;
    } else {
      price = BASE_PRICE_PER_CABIN_PER_DAY * dto.cabinCount * dto.hireDays;
    }

    const order = await this.prisma.toiletCabinOrder.create({
      data: {
        orderNumber,
        address: dto.address,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        cabinCount: dto.cabinCount,
        hireDays: dto.hireDays,
        deliveryDate: new Date(dto.deliveryDate),
        deliveryWindow: dto.deliveryWindow ?? 'ANY',
        price,
        paymentMethod: dto.paymentMethod ?? 'CARD',
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        userId: userId ?? null,
        carrierId,
        notes: dto.notes,
        statusTimestamps: { PENDING: new Date().toISOString() },
      },
    });

    this.logger.log(`ToiletCabinOrder created: ${order.orderNumber}`);

    // If no carrier pre-selected, broadcast to eligible carriers in the city
    if (!carrierId) {
      this.broadcastToEligibleCarriers(
        order.id,
        order.orderNumber,
        dto.city,
      ).catch((err) =>
        this.logger.warn(
          `Toilet cabin broadcast failed for ${order.orderNumber}: ${(err as Error).message}`,
        ),
      );
    }

    return order;
  }

  // ── List ───────────────────────────────────────────────────────
  async findAll(user: RequestingUser, status?: ToiletCabinStatus) {
    const where: Record<string, unknown> = {};
    if (user.userType !== 'ADMIN') {
      where.userId = user.userId;
    }
    if (status) where.status = status;

    return this.prisma.toiletCabinOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Single ─────────────────────────────────────────────────────
  async findOne(id: string, user: RequestingUser) {
    const order = await this.prisma.toiletCabinOrder.findUnique({
      where: { id },
    });
    if (!order) throw new NotFoundException('Toilet cabin order not found');
    if (
      user.userType !== 'ADMIN' &&
      order.userId !== user.userId &&
      order.carrierId !== user.companyId
    ) {
      throw new ForbiddenException();
    }
    return order;
  }

  // ── Update status (admin only) ─────────────────────────────────
  async updateStatus(
    id: string,
    dto: UpdateToiletCabinStatusDto,
    user: RequestingUser,
  ) {
    const order = await this.prisma.toiletCabinOrder.findUnique({
      where: { id },
    });
    if (!order) throw new NotFoundException('Toilet cabin order not found');

    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only admins can use this endpoint');
    }

    const timestamps = (order.statusTimestamps as Record<string, string>) ?? {};
    timestamps[dto.status] = new Date().toISOString();

    const updated = await this.prisma.toiletCabinOrder.update({
      where: { id },
      data: { status: dto.status, statusTimestamps: timestamps },
    });

    this.logger.log(`ToiletCabinOrder ${id} → ${dto.status}`);
    return updated;
  }

  // ── CARRIER: Update status ──────────────────────────────────────
  /**
   * Carriers advance their own assigned orders through the delivery lifecycle.
   * Allowed transitions: CONFIRMED → DELIVERED, DELIVERED → IN_USE, IN_USE → COLLECTED.
   */
  async updateCarrierStatus(
    id: string,
    status: ToiletCabinStatus,
    userId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });
    if (!user?.companyId || !user.canSkipHire) {
      throw new ForbiddenException(
        'Only approved carriers can update toilet cabin orders',
      );
    }

    const order = await this.prisma.toiletCabinOrder.findUnique({
      where: { id },
    });
    if (!order) throw new NotFoundException('Toilet cabin order not found');
    if (order.carrierId !== user.companyId) {
      throw new ForbiddenException(
        'This order is not assigned to your company',
      );
    }

    const ALLOWED: Partial<Record<ToiletCabinStatus, ToiletCabinStatus[]>> = {
      CONFIRMED: ['DELIVERED'],
      DELIVERED: ['IN_USE'],
      IN_USE: ['COLLECTED'],
    };

    if (!ALLOWED[order.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    const timestamps = (order.statusTimestamps as Record<string, string>) ?? {};
    timestamps[status] = new Date().toISOString();

    const updated = await this.prisma.toiletCabinOrder.update({
      where: { id },
      data: { status, statusTimestamps: timestamps },
    });

    this.logger.log(`ToiletCabinOrder ${id} carrier-update → ${status}`);
    return updated;
  }

  // ── CARRIER: List my assigned orders ───────────────────────────
  async findCarrierOrders(userId: string, status?: ToiletCabinStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });
    if (!user?.companyId || !user.canSkipHire) {
      throw new ForbiddenException(
        'Only approved carriers can view toilet cabin orders',
      );
    }

    const where: Record<string, unknown> = { carrierId: user.companyId };
    if (status) where.status = status;

    return this.prisma.toiletCabinOrder.findMany({
      where,
      orderBy: { deliveryDate: 'asc' },
    });
  }

  // ── CARRIER: Get/set own toilet cabin settings ─────────────────
  async getCarrierSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });
    if (!user?.companyId || !user.canSkipHire) {
      throw new ForbiddenException(
        'Only approved carriers can access these settings',
      );
    }

    const settings = await this.prisma.carrierToiletCabinSettings.findUnique({
      where: { carrierId: user.companyId },
    });
    return settings ?? null;
  }

  async upsertCarrierSettings(userId: string, dto: SetToiletCabinSettingsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });
    if (!user?.companyId || !user.canSkipHire) {
      throw new ForbiddenException(
        'Only approved carriers can update these settings',
      );
    }
    if (dto.pricePerCabinPerDay <= 0) {
      throw new BadRequestException('Price must be greater than zero');
    }

    const normCities = dto.serviceCities
      .map((c) => c.toLowerCase().trim())
      .filter(Boolean);

    return this.prisma.carrierToiletCabinSettings.upsert({
      where: { carrierId: user.companyId },
      create: {
        carrierId: user.companyId,
        pricePerCabinPerDay: dto.pricePerCabinPerDay,
        maxCabins: dto.maxCabins,
        serviceCities: normCities,
        isActive: dto.isActive ?? true,
      },
      update: {
        pricePerCabinPerDay: dto.pricePerCabinPerDay,
        maxCabins: dto.maxCabins,
        serviceCities: normCities,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ── PUBLIC: Get quotes for city + cabin count + hire period ────
  /**
   * Returns all active carriers serving the requested city,
   * sorted cheapest total price first.
   */
  async getQuotes(
    city: string,
    cabinCount: number,
    hireDays: number,
  ): Promise<ToiletCabinQuoteResult[]> {
    const cityNorm = city.toLowerCase().trim();

    const allSettings = await this.prisma.carrierToiletCabinSettings.findMany({
      where: {
        isActive: true,
        maxCabins: { gte: cabinCount },
        serviceCities: { has: cityNorm },
      },
      include: {
        carrier: {
          select: { id: true, name: true, logo: true, verified: true },
        },
      },
    });

    const quotes: ToiletCabinQuoteResult[] = allSettings
      .filter((s) => s.carrier.verified)
      .map((s) => ({
        carrierId: s.carrier.id,
        carrierName: s.carrier.name,
        carrierLogo: s.carrier.logo,
        pricePerCabinPerDay: s.pricePerCabinPerDay,
        totalPrice: s.pricePerCabinPerDay * cabinCount * hireDays,
        currency: 'EUR',
        maxCabins: s.maxCabins,
      }));

    return quotes.sort((a, b) => a.totalPrice - b.totalPrice);
  }

  // ── Broadcast new (unassigned) order to eligible carriers ──────
  private async broadcastToEligibleCarriers(
    orderId: string,
    orderNumber: string,
    city: string,
  ) {
    const cityNorm = city.toLowerCase().trim();

    const eligible = await this.prisma.carrierToiletCabinSettings.findMany({
      where: {
        isActive: true,
        serviceCities: { has: cityNorm },
      },
      include: {
        carrier: {
          select: { id: true, users: { select: { id: true }, take: 1 } },
        },
      },
    });

    this.logger.log(
      `Toilet cabin broadcast: ${eligible.length} eligible carriers for order ${orderNumber} in ${city}`,
    );
    // Notification hook placeholder — notifications service can be injected later
    // when push tokens are wired up for carrier staff.
  }

  // ── Helpers ────────────────────────────────────────────────────
  private generateOrderNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TC-${ts}-${rnd}`;
  }
}
