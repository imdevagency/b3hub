import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkipHireDto } from './dto/create-skip-hire.dto';
import { UpdateSkipHireStatusDto } from './dto/update-skip-hire-status.dto';
import { CompanyType, SkipHireStatus, SkipSize } from '@prisma/client';

// Fallback prices used when no carrier is selected (direct/admin orders)
const SKIP_PRICES: Record<SkipSize, number> = {
  MINI: 89,
  MIDI: 129,
  BUILDERS: 169,
  LARGE: 199,
};

const CARRIER_TYPES: CompanyType[] = ['CARRIER', 'HYBRID'];

export interface SkipHireQuoteResult {
  carrierId: string;
  carrierName: string;
  carrierLogo: string | null;
  carrierRating: number | null;
  price: number;
  currency: string;
}

@Injectable()
export class SkipHireService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create (public — no auth needed) ──────────────────────────
  async create(dto: CreateSkipHireDto, userId?: string) {
    const orderNumber = await this.generateOrderNumber();
    let price: number;
    let carrierId: string | null = dto.carrierId ?? null;

    if (carrierId) {
      // Re-derive price server-side from carrier’s own pricing (never trust client price)
      const carrierPricing = await this.prisma.carrierPricing.findUnique({
        where: { carrierId_skipSize: { carrierId, skipSize: dto.skipSize } },
        include: { carrier: { include: { serviceZones: true } } },
      });
      if (!carrierPricing) {
        throw new BadRequestException(
          'Selected carrier has no pricing for this skip size',
        );
      }
      const locationLower = dto.location.toLowerCase().trim();
      const zone = carrierPricing.carrier.serviceZones.find(
        (z) =>
          locationLower.includes(z.city.toLowerCase()) ||
          z.city.toLowerCase().includes(locationLower) ||
          (z.postcode && locationLower.includes(z.postcode.toLowerCase())),
      );
      price = carrierPricing.price + (zone?.surcharge ?? 0);
    } else {
      price = SKIP_PRICES[dto.skipSize];
    }

    return this.prisma.skipHireOrder.create({
      data: {
        orderNumber,
        location: dto.location,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        wasteCategory: dto.wasteCategory,
        skipSize: dto.skipSize,
        deliveryDate: new Date(dto.deliveryDate),
        price,
        currency: 'EUR',
        status: SkipHireStatus.PENDING,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        notes: dto.notes,
        userId: userId ?? null,
        carrierId,
      },
    });
  }

  // ── Get quotes (public) ──────────────────────────────────────────────
  async getQuotes(
    size: SkipSize,
    location: string,
    date: string,
  ): Promise<SkipHireQuoteResult[]> {
    const locationLower = location.toLowerCase().trim();
    const requestedDay = new Date(date);
    requestedDay.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(requestedDay);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const pricings = await this.prisma.carrierPricing.findMany({
      where: { skipSize: size },
      include: {
        carrier: {
          include: {
            serviceZones: true,
            availabilityBlocks: {
              where: { blockedDate: { gte: requestedDay, lt: nextDay } },
            },
          },
        },
      },
    });

    const quotes: SkipHireQuoteResult[] = [];

    for (const pricing of pricings) {
      const { carrier } = pricing;

      // Only verified CARRIER or HYBRID companies
      if (!carrier.verified) continue;
      if (!CARRIER_TYPES.includes(carrier.companyType)) continue;

      // Must cover this location
      const zone = carrier.serviceZones.find(
        (z) =>
          locationLower.includes(z.city.toLowerCase()) ||
          z.city.toLowerCase().includes(locationLower) ||
          (z.postcode && locationLower.includes(z.postcode.toLowerCase())),
      );
      if (!zone) continue;

      // Must not be blocked on this date
      if (carrier.availabilityBlocks.length > 0) continue;

      quotes.push({
        carrierId: carrier.id,
        carrierName: carrier.name,
        carrierLogo: carrier.logo ?? null,
        carrierRating: carrier.rating ?? null,
        price: pricing.price + (zone.surcharge ?? 0),
        currency: pricing.currency,
      });
    }

    return quotes.sort((a, b) => a.price - b.price);
  }

  // ── List all (admin) or own orders (user) ─────────────────────
  async findAll(userId: string, isAdmin: boolean, status?: SkipHireStatus) {
    const where: any = {};
    if (!isAdmin) where.userId = userId;
    if (status) where.status = status;
    return this.prisma.skipHireOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Single order ───────────────────────────────────────────────
  async findOne(id: string, userId?: string, isAdmin = false) {
    const order = await this.prisma.skipHireOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Skip hire order ${id} not found`);
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return order;
  }

  // ── Orders by order number ─────────────────────────────────────
  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { orderNumber },
    });
    if (!order) throw new NotFoundException(`Order ${orderNumber} not found`);
    return order;
  }

  // ── Orders for a specific registered user ─────────────────────
  async findByUser(userId: string) {
    return this.prisma.skipHireOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Update status (admin only) ──────────────────────────────
  async updateStatus(id: string, dto: UpdateSkipHireStatusDto) {
    await this.findOne(id, undefined, true); // admin-only, skip ownership check
    return this.prisma.skipHireOrder.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ── Cancel ────────────────────────────────────────────────────
  async cancel(id: string, userId: string, isAdmin = false) {
    const order = await this.findOne(id, userId, isAdmin);
    if (
      order.status === SkipHireStatus.COMPLETED ||
      order.status === SkipHireStatus.COLLECTED
    ) {
      throw new BadRequestException(
        'Cannot cancel an order that is already completed or collected',
      );
    }
    return this.prisma.skipHireOrder.update({
      where: { id },
      data: { status: SkipHireStatus.CANCELLED },
    });
  }

  // ── Carrier fleet map (skip driver view) ─────────────────────
  /**
   * Returns all active (CONFIRMED + DELIVERED) skip hire orders assigned to
   * the carrier company that the requesting user belongs to.
   * Used by the skip-driver fleet map in the web/mobile app.
   */
  async getCarrierMapSkips(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });

    if (!user?.canSkipHire) {
      throw new ForbiddenException(
        'Skip hire map access not enabled for this account',
      );
    }
    if (!user.companyId) {
      throw new ForbiddenException('User is not associated with a company');
    }

    return this.prisma.skipHireOrder.findMany({
      where: {
        carrierId: user.companyId,
        status: { in: [SkipHireStatus.CONFIRMED, SkipHireStatus.DELIVERED] },
      },
      orderBy: { deliveryDate: 'asc' },
    });
  }

  // ── Carrier: update own skip status ───────────────────────────
  /**
   * Allowed carrier transitions:
   *   CONFIRMED  → DELIVERED  (skip has been placed at site)
   *   DELIVERED  → COLLECTED  (skip has been collected back)
   */
  async updateCarrierStatus(
    id: string,
    newStatus: SkipHireStatus,
    userId: string,
  ) {
    const ALLOWED: Partial<Record<SkipHireStatus, SkipHireStatus>> = {
      [SkipHireStatus.CONFIRMED]: SkipHireStatus.DELIVERED,
      [SkipHireStatus.DELIVERED]: SkipHireStatus.COLLECTED,
    };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });
    if (!user?.canSkipHire)
      throw new ForbiddenException(
        'Skip hire access not enabled for this account',
      );
    if (!user.companyId)
      throw new ForbiddenException('User is not associated with a company');

    const order = await this.prisma.skipHireOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Skip hire order ${id} not found`);
    if (order.carrierId !== user.companyId)
      throw new ForbiddenException(
        'This order does not belong to your company',
      );

    const expectedNext = ALLOWED[order.status];
    if (!expectedNext)
      throw new BadRequestException(
        `No carrier transition allowed from status ${order.status}`,
      );
    if (newStatus !== expectedNext)
      throw new BadRequestException(
        `Expected next status to be ${expectedNext}`,
      );

    return this.prisma.skipHireOrder.update({
      where: { id },
      data: { status: newStatus },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.skipHireOrder.count();
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const seq = (count + 1).toString().padStart(5, '0');
    return `SKP${yy}${mm}${seq}`;
  }
}
