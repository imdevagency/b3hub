import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RentalOrderStatus, RentalServiceType, Prisma } from '@prisma/client';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto';
import { SERVICES_WITHOUT_IN_USE, RENTAL_STATUS_FLOW } from './rental.types';
import { randomBytes } from 'crypto';

@Injectable()
export class RentalsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateRentalOrderDto, userId?: string) {
    const orderNumber = await this.generateOrderNumber(dto.serviceType);
    const trackingToken = randomBytes(16).toString('hex');

    return this.prisma.rentalOrder.create({
      data: {
        orderNumber,
        serviceType: dto.serviceType,
        address: dto.address,
        city: dto.city,
        lat: dto.lat,
        lng: dto.lng,
        hireDays: dto.hireDays,
        deliveryDate: new Date(dto.deliveryDate),
        deliveryWindow: dto.deliveryWindow ?? 'ANY',
        quantity: dto.quantity,
        price: dto.price,
        paymentMethod: dto.paymentMethod ?? 'CARD',
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        notes: dto.notes,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        userId: userId ?? null,
        trackingToken,
        statusTimestamps: { PENDING: new Date().toISOString() },
      },
    });
  }

  // ── Find all (for carrier) ──────────────────────────────────────────────────

  async findCarrierOrders(carrierId: string, serviceType?: RentalServiceType) {
    return this.prisma.rentalOrder.findMany({
      where: {
        carrierId,
        ...(serviceType ? { serviceType } : {}),
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: { deliveryDate: 'asc' },
    });
  }

  // ── Find all (for buyer) ────────────────────────────────────────────────────

  async findBuyerOrders(userId: string, serviceType?: RentalServiceType) {
    return this.prisma.rentalOrder.findMany({
      where: {
        userId,
        ...(serviceType ? { serviceType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find one ────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const order = await this.prisma.rentalOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Rental order not found');
    return order;
  }

  async findByTrackingToken(token: string) {
    const order = await this.prisma.rentalOrder.findUnique({
      where: { trackingToken: token },
    });
    if (!order) throw new NotFoundException('Tracking link not found');
    return order;
  }

  // ── Status update ───────────────────────────────────────────────────────────

  async updateStatus(id: string, carrierId: string, newStatus: RentalOrderStatus) {
    const order = await this.findOne(id);

    if (order.carrierId !== carrierId) {
      throw new ForbiddenException('Not assigned to this order');
    }

    // Skip IN_USE step for services that don't need it
    const isSkippingInUse =
      newStatus === 'IN_USE' && SERVICES_WITHOUT_IN_USE.includes(order.serviceType);
    if (isSkippingInUse) {
      throw new BadRequestException(
        `Service type ${order.serviceType} does not use the IN_USE status`,
      );
    }

    const timestamps = (order.statusTimestamps as Record<string, string>) ?? {};
    timestamps[newStatus] = new Date().toISOString();

    return this.prisma.rentalOrder.update({
      where: { id },
      data: { status: newStatus, statusTimestamps: timestamps },
    });
  }

  // ── Assign carrier ──────────────────────────────────────────────────────────

  async assignCarrier(id: string, carrierId: string) {
    const order = await this.findOne(id);
    if (order.status !== 'PENDING') {
      throw new BadRequestException('Can only assign carrier to PENDING orders');
    }
    const timestamps = (order.statusTimestamps as Record<string, string>) ?? {};
    timestamps['CONFIRMED'] = new Date().toISOString();

    return this.prisma.rentalOrder.update({
      where: { id },
      data: { carrierId, status: 'CONFIRMED', statusTimestamps: timestamps },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async generateOrderNumber(serviceType: RentalServiceType): Promise<string> {
    const prefixes: Partial<Record<RentalServiceType, string>> = {
      SCAFFOLDING:    'SC',
      TEMP_FENCING:   'TF',
      SITE_OFFICE:    'SO',
      GENERATOR:      'GN',
      LIGHTING_TOWER: 'LT',
      WATER_BOWSER:   'WB',
    };
    const prefix = prefixes[serviceType] ?? 'RN';
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    return `${prefix}-${suffix}`;
  }
}
