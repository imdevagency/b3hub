/**
 * Toilet Cabin Rental service.
 * Handles booking creation, listing, and status lifecycle for toilet cabin hire orders.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateToiletCabinDto } from './dto/create-toilet-cabin.dto';
import { UpdateToiletCabinStatusDto } from './dto/update-toilet-cabin-status.dto';
import { ToiletCabinStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';

// Base day rate (EUR) per cabin — used as fallback when no carrier quote selected
const BASE_PRICE_PER_CABIN_PER_DAY = 12;

@Injectable()
export class ToiletCabinsService {
  private readonly logger = new Logger(ToiletCabinsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create (public — optional auth) ───────────────────────────
  async create(dto: CreateToiletCabinDto, userId?: string) {
    const orderNumber = this.generateOrderNumber();
    const price = dto.cabinCount * dto.hireDays * BASE_PRICE_PER_CABIN_PER_DAY;

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
        paymentMethod: dto.paymentMethod,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        userId: userId ?? null,
        notes: dto.notes,
        statusTimestamps: { PENDING: new Date().toISOString() },
      },
    });

    this.logger.log(`ToiletCabinOrder created: ${order.orderNumber}`);
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
    const order = await this.prisma.toiletCabinOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Toilet cabin order not found');
    if (user.userType !== 'ADMIN' && order.userId !== user.userId) {
      throw new ForbiddenException();
    }
    return order;
  }

  // ── Update status ──────────────────────────────────────────────
  async updateStatus(id: string, dto: UpdateToiletCabinStatusDto, user: RequestingUser) {
    const order = await this.prisma.toiletCabinOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Toilet cabin order not found');

    // Only admin or the assigned carrier can update status
    if (user.userType !== 'ADMIN' && order.carrierId !== user.companyId) {
      throw new ForbiddenException();
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

  // ── Helpers ────────────────────────────────────────────────────
  private generateOrderNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TC-${ts}-${rnd}`;
  }
}
