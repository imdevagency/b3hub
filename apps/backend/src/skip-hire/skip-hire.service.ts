/**
 * Skip-hire service.
 * Manages skip (dumpster) hire bookings: browsing available skips by postcode,
 * placing hire orders, carrier acceptance, delivery/collection scheduling,
 * and status tracking.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { PaymentsService } from '../payments/payments.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSkipHireDto } from './dto/create-skip-hire.dto';
import { UpdateSkipHireStatusDto } from './dto/update-skip-hire-status.dto';
import { CompanyType, SkipHireStatus, SkipSize, Prisma } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';

const SKIP_STATUS_LABEL: Partial<Record<SkipHireStatus, string>> = {
  [SkipHireStatus.CONFIRMED]: 'Konteiners apstiprināts',
  [SkipHireStatus.DELIVERED]: 'Konteiners piegādāts',
  [SkipHireStatus.COLLECTED]: 'Konteiners savākts',
  [SkipHireStatus.CANCELLED]: 'Pasūtījums atcelts',
  [SkipHireStatus.COMPLETED]: 'Pasūtījums pabeigts',
};

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
  private readonly logger = new Logger(SkipHireService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    @Optional() private readonly supabase: SupabaseService,
  ) {}

  /**
   * Upload an unloading-point photo to Supabase Storage and return the public URL.
   * Called before order creation so the create DTO receives a URL, not raw base64.
   */
  async uploadPhoto(
    base64: string,
    mimeType: string,
  ): Promise<{ url: string }> {
    if (!this.supabase) {
      throw new BadRequestException('File storage is not configured');
    }
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = Buffer.from(raw, 'base64');
    await this.supabase.uploadFile('skip-hire-photos', path, buffer);
    const url = this.supabase.getPublicUrl('skip-hire-photos', path);
    this.logger.log(`Skip hire photo uploaded: ${url}`);
    return { url };
  }

  // ── Create (public — no auth needed) ──────────────────────────
  async create(dto: CreateSkipHireDto, userId?: string) {
    const orderNumber = this.generateOrderNumber();
    let price: number;
    const carrierId: string | null = dto.carrierId ?? null;

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

    if (new Date(dto.deliveryDate) < new Date(new Date().toDateString())) {
      throw new BadRequestException(
        'Delivery date must be today or in the future',
      );
    }

    const order = await this.prisma.skipHireOrder.create({
      data: {
        orderNumber,
        location: dto.location,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        wasteCategory: dto.wasteCategory,
        skipSize: dto.skipSize,
        deliveryDate: new Date(dto.deliveryDate),
        deliveryWindow: dto.deliveryWindow ?? null,
        hireDays: dto.hireDays ?? null,
        price,
        currency: 'EUR',
        status: SkipHireStatus.PENDING,
        statusTimestamps: { PENDING: new Date().toISOString() },
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        unloadingPointPhotoUrl: dto.unloadingPointPhotoUrl,
        notes: dto.notes ?? null,
        userId: userId ?? null,
        carrierId,
      },
    });
    this.logger.log(
      `Skip hire order ${order.orderNumber} created (${dto.skipSize}, ${dto.location})`,
    );

    // Create a Stripe PaymentIntent so the buyer can pay immediately.
    // Uses automatic capture — funds are taken once the buyer confirms.
    let clientSecret: string | null = null;
    try {
      const pi = await this.payments.createSkipHirePaymentIntent(order.id);
      clientSecret = pi.clientSecret ?? null;
    } catch (err) {
      this.logger.error(
        `Failed to create PaymentIntent for skip-hire order ${order.id}: ${(err as Error).message}`,
      );
    }

    if (userId) {
      this.notifications
        .create({
          userId,
          type: NotificationType.ORDER_CREATED,
          title: 'Konteinera pasūtījums saņemts',
          message: `Pasūtījums #${orderNumber} reģistrēts. Lūdzu, apmaksājiet pasūtījumu, lai apstiprinātu rezervāciju.`,
          data: { orderId: order.id },
        })
        .catch((err) =>
          this.logger.warn(
            'Notification create failed (ORDER_CREATED)',
            (err as Error).message,
          ),
        );
    }
    return { ...order, clientSecret };
  }

  // ── Market prices (public) ───────────────────────────────────────────
  /**
   * Returns the minimum price per skip size across all verified carriers.
   * Falls back to the platform default prices when no carrier pricing exists.
   */
  async getMarketPrices(): Promise<Record<SkipSize, number>> {
    const pricings = await this.prisma.carrierPricing.findMany({
      where: {
        carrier: {
          verified: true,
          companyType: { in: CARRIER_TYPES },
        },
      },
      select: { skipSize: true, price: true },
    });

    const mins: Partial<Record<SkipSize, number>> = {};
    for (const p of pricings) {
      if (mins[p.skipSize] === undefined || p.price < mins[p.skipSize]!) {
        mins[p.skipSize] = p.price;
      }
    }

    return {
      MINI: mins.MINI ?? SKIP_PRICES.MINI,
      MIDI: mins.MIDI ?? SKIP_PRICES.MIDI,
      BUILDERS: mins.BUILDERS ?? SKIP_PRICES.BUILDERS,
      LARGE: mins.LARGE ?? SKIP_PRICES.LARGE,
    };
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
    const where: Prisma.SkipHireOrderWhereInput = {};
    if (!isAdmin) where.userId = userId;
    if (status) where.status = status;
    return this.prisma.skipHireOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        carrier: { select: { id: true, name: true, phone: true, rating: true } },
      },
    });
  }

  // ── Single order ───────────────────────────────────────────────
  async findOne(id: string, userId?: string, isAdmin = false) {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id },
      include: {
        carrier: { select: { id: true, name: true, phone: true, rating: true } },
      },
    });
    if (!order) throw new NotFoundException(`Skip hire order ${id} not found`);
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return order;
  }

  // ── Orders by order number ─────────────────────────────────────
  async findByOrderNumber(orderNumber: string, user: RequestingUser) {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { orderNumber },
    });
    if (!order) throw new NotFoundException(`Order ${orderNumber} not found`);
    // Only the order owner, their company members, or admins may view details.
    if (
      user.userType !== 'ADMIN' &&
      order.userId !== user.userId &&
      (!user.companyId || order.userId !== user.companyId)
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }
    return order;
  }

  // ── Orders for a specific registered user ─────────────────────
  async findByUser(userId: string) {
    return this.prisma.skipHireOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        carrier: { select: { id: true, name: true, phone: true, rating: true } },
      },
    });
  }

  // ── Update status (admin only) ──────────────────────────────
  async updateStatus(id: string, dto: UpdateSkipHireStatusDto) {
    const existing = await this.findOne(id, undefined, true);

    if (existing.status === dto.status) {
      return existing; // No-op — already in the requested state
    }

    // Admins have broader (but not unrestricted) transitions. Terminal states
    // (COMPLETED, CANCELLED) are one-way — admins cannot re-open them.
    // This prevents accidental status resets that would confuse the carrier.
    const ADMIN_ALLOWED: Partial<Record<SkipHireStatus, SkipHireStatus[]>> = {
      [SkipHireStatus.PENDING]: [
        SkipHireStatus.CONFIRMED,
        SkipHireStatus.CANCELLED,
      ],
      [SkipHireStatus.CONFIRMED]: [
        SkipHireStatus.DELIVERED,
        SkipHireStatus.CANCELLED,
      ],
      // Admin can revert DELIVERED → CONFIRMED if the skip was placed incorrectly
      [SkipHireStatus.DELIVERED]: [
        SkipHireStatus.COLLECTED,
        SkipHireStatus.CONFIRMED,
        SkipHireStatus.CANCELLED,
      ],
      [SkipHireStatus.COLLECTED]: [
        SkipHireStatus.COMPLETED,
        SkipHireStatus.CANCELLED,
      ],
      // Terminal — no admin override once order is closed
      [SkipHireStatus.COMPLETED]: [],
      [SkipHireStatus.CANCELLED]: [],
    };

    const allowed = ADMIN_ALLOWED[existing.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid skip hire status transition: ${existing.status} → ${dto.status}`,
      );
    }

    const existingTimestamps =
      existing.statusTimestamps && typeof existing.statusTimestamps === 'object'
        ? (existing.statusTimestamps as Record<string, string>)
        : {};
    const updated = await this.prisma.skipHireOrder.update({
      where: { id },
      data: {
        status: dto.status,
        statusTimestamps: { ...existingTimestamps, [dto.status]: new Date().toISOString() },
      },
    });
    // Release funds to carrier when order reaches terminal COMPLETED state
    if (dto.status === SkipHireStatus.COMPLETED) {
      this.payments
        .releaseSkipHireFunds(id)
        .catch((err: Error) =>
          this.logger.error(
            `Failed to release skip hire funds for order ${id}: ${err.message}`,
          ),
        );
    }
    if (existing.userId) {
      const label = SKIP_STATUS_LABEL[dto.status];
      if (label) {
        this.notifications
          .create({
            userId: existing.userId,
            type: NotificationType.ORDER_CONFIRMED,
            title: label,
            message: `Konteinera pasūtījums #${existing.orderNumber}: ${label.toLowerCase()}.`,
            data: { orderId: id },
          })
          .catch((err) =>
            this.logger.warn(
              'Notification create failed (ORDER_CONFIRMED)',
              (err as Error).message,
            ),
          );
      }
    }
    return updated;
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
    const existingTs =
      order.statusTimestamps && typeof order.statusTimestamps === 'object'
        ? (order.statusTimestamps as Record<string, string>)
        : {};
    const updated = await this.prisma.skipHireOrder.update({
      where: { id },
      data: {
        status: SkipHireStatus.CANCELLED,
        statusTimestamps: { ...existingTs, CANCELLED: new Date().toISOString() },
      },
    });

    // Void the PaymentIntent (PENDING) or issue a full refund (CAPTURED)
    this.payments
      .refundSkipHireOrder(id)
      .catch((err) =>
        this.logger.error(
          `refundSkipHireOrder failed on cancel for skip order ${order.orderNumber}: ${(err as Error).message}`,
        ),
      );

    if (order.userId) {
      this.notifications
        .create({
          userId: order.userId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Pasūtījums atcelts',
          message: `Konteinera pasūtījums #${order.orderNumber} ir atcelts.`,
          data: { orderId: id },
        })
        .catch((err) =>
          this.logger.warn(
            'Notification create failed (SYSTEM_ALERT cancel)',
            (err as Error).message,
          ),
        );
    }
    return updated;
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

    const existingTs2 =
      order.statusTimestamps && typeof order.statusTimestamps === 'object'
        ? (order.statusTimestamps as Record<string, string>)
        : {};
    const updated = await this.prisma.skipHireOrder.update({
      where: { id },
      data: {
        status: newStatus,
        statusTimestamps: { ...existingTs2, [newStatus]: new Date().toISOString() },
      },
    });
    if (order.userId) {
      const label = SKIP_STATUS_LABEL[newStatus];
      if (label) {
        this.notifications
          .create({
            userId: order.userId,
            type: NotificationType.ORDER_DELIVERED,
            title: label,
            message: `Konteinera pasūtījums #${order.orderNumber}: ${label.toLowerCase()}.`,
            data: { orderId: id },
          })
          .catch((err) =>
            this.logger.warn(
              'Notification create failed (ORDER_DELIVERED)',
              (err as Error).message,
            ),
          );
      }
    }
    return updated;
  }

  // ── Helpers ───────────────────────────────────────────────────
  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `SKP${year}${month}${ms}${rand}`;
  }

  /**
   * Auto-cancel PENDING skip hire orders whose deliveryDate has passed
   * without a carrier confirming the booking.
   *
   * A skip hire order starts PENDING when placed. A carrier must confirm it
   * (→ CONFIRMED) before the delivery date. If nobody acts, the skip never
   * arrives and the buyer is left waiting indefinitely. This cron runs daily
   * and cancels any PENDING orders whose deliveryDate is in the past.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async autoCancelStalePendingSkipOrders(): Promise<void> {
    await withCronLock(
      this.prisma,
      'autoCancelStalePendingSkipOrders',
      async () => {
        const now = new Date();

        const stale = await this.prisma.skipHireOrder.findMany({
          where: {
            status: SkipHireStatus.PENDING,
            deliveryDate: { lt: now },
          },
          select: { id: true, orderNumber: true, userId: true },
        });

        if (stale.length === 0) return;

        for (const order of stale) {
          try {
            const { count } = await this.prisma.skipHireOrder.updateMany({
              where: { id: order.id, status: SkipHireStatus.PENDING },
              data: { status: SkipHireStatus.CANCELLED },
            });

            if (count === 0) continue; // Already updated concurrently

            this.logger.warn(
              `Skip hire order ${order.orderNumber} auto-cancelled — deliveryDate passed with no carrier confirmation`,
            );

            // Void/refund the buyer's payment (PaymentIntent may still be open)
            this.payments
              .refundSkipHireOrder(order.id)
              .catch((err) =>
                this.logger.error(
                  `refundSkipHireOrder failed in auto-cancel for skip order ${order.orderNumber}: ${(err as Error).message}`,
                ),
              );

            if (order.userId) {
              this.notifications
                .create({
                  userId: order.userId,
                  type: NotificationType.ORDER_CANCELLED,
                  title: 'Konteinera pasūtījums atcelts',
                  message: `Pasūtījums #${order.orderNumber} tika automātiski atcelts, jo neviens pārvadātājs neapstiprināja rezervāciju līdz piegādes datumam.`,
                  data: { orderId: order.id },
                })
                .catch((err) =>
                  this.logger.warn(
                    'Notification create failed (ORDER_CANCELLED auto)',
                    (err as Error).message,
                  ),
                );
            }
          } catch (err) {
            this.logger.error(
              `autoCancelStalePendingSkipOrders: failed for order ${order.id}: ${(err as Error).message}`,
            );
          }
        }

        this.logger.log(
          `autoCancelStalePendingSkipOrders: cancelled ${stale.length} stale PENDING skip hire order(s)`,
        );
      },
      this.logger,
    );
  }
}
