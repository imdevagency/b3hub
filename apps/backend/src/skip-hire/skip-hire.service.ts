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
import { CompanyType, SkipHireStatus, Prisma, TransportJobStatus, TransportJobType } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';

const SKIP_STATUS_LABEL: Partial<Record<SkipHireStatus, string>> = {
  [SkipHireStatus.CONFIRMED]: 'Konteiners apstiprināts',
  [SkipHireStatus.DELIVERED]: 'Konteiners piegādāts',
  [SkipHireStatus.COLLECTED]: 'Konteiners savākts',
  [SkipHireStatus.CANCELLED]: 'Pasūtījums atcelts',
  [SkipHireStatus.COMPLETED]: 'Pasūtījums pabeigts',
};

// Fallback prices used when no carrier is selected (direct/admin orders)
const SKIP_PRICES: Record<string, number> = {
  MINI: 89,
  MIDI: 129,
  BUILDERS: 169,
  LARGE: 199,
};

const CARRIER_TYPES: CompanyType[] = ['CARRIER'];

/** Platform-standard daily rate charged for overdue skip hire (EUR/day). */
const OVERDUE_DAILY_RATE_EUR = 20;
/** Default hire period in days when the order has no explicit hireDays set. */
const DEFAULT_HIRE_DAYS = 7;

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
      // Re-derive price server-side (never trust client-submitted price).
      // Use carrier's custom rate if set; fall back to CMS basePrice.
      const [carrierData, customPricing, sizeDef] = await Promise.all([
        this.prisma.company.findUnique({
          where: { id: carrierId },
          include: { serviceZones: true },
        }),
        this.prisma.carrierPricing.findUnique({
          where: { carrierId_skipSize: { carrierId, skipSize: dto.skipSize } },
          select: { price: true },
        }),
        this.prisma.skipSizeDefinition.findUnique({
          where: { code: dto.skipSize },
          select: { basePrice: true },
        }),
      ]);
      if (!carrierData) {
        throw new BadRequestException('Selected carrier not found');
      }
      const platformBasePrice = sizeDef?.basePrice ?? SKIP_PRICES[dto.skipSize] ?? 0;
      const coverage = this.carrierCoverage(
        carrierData,
        dto.location.toLowerCase().trim(),
        dto.lat,
        dto.lng,
      );
      price = (customPricing?.price ?? platformBasePrice) + coverage.surcharge;
    } else {
      // No carrier selected — use CMS basePrice as the platform rate
      const sizeDef = await this.prisma.skipSizeDefinition.findUnique({
        where: { code: dto.skipSize },
        select: { basePrice: true },
      });
      price = sizeDef?.basePrice ?? SKIP_PRICES[dto.skipSize] ?? 0;
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
        paymentMethod: dto.paymentMethod ?? 'CARD',
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        unloadingPointPhotoUrl: dto.unloadingPointPhotoUrl,
        notes: dto.notes ?? null,
        bisNumber: dto.bisNumber ?? null,
        userId: userId ?? null,
        carrierId,
      },
    });
    this.logger.log(
      `Skip hire order ${order.orderNumber} created (${dto.skipSize}, ${dto.location})`,
    );

    // Create a Paysera payment link only for card payments.
    // INVOICE orders are paid by bank transfer — no redirect needed.
    let paymentUrl: string | null = null;
    if ((dto.paymentMethod ?? 'CARD') === 'CARD') {
      try {
        const pi = await this.payments.createSkipHirePaymentIntent(order.id);
        paymentUrl = pi.paymentUrl ?? null;
      } catch (err) {
        this.logger.error(
          `Failed to create payment link for skip-hire order ${order.id}: ${(err as Error).message}`,
        );
      }
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

    // When no carrier was pre-selected, broadcast the job to all eligible carriers
    if (!carrierId) {
      this.broadcastToEligibleCarriers(
        order.id,
        order.orderNumber,
        dto.skipSize,
        dto.location,
        dto.lat,
        dto.lng,
      ).catch((err) =>
        this.logger.warn(
          `Skip hire broadcast failed for order ${order.orderNumber}: ${(err as Error).message}`,
        ),
      );
    }

    return { ...order, paymentUrl };
  }

  // ── List active sizes (public) ──────────────────────────────────────
  async listSizes() {
    return this.prisma.skipSizeDefinition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Market prices (public) ───────────────────────────────────────────
  /**
   * Returns the minimum price per skip size across all verified carriers.
   * Falls back to the platform default (SkipSizeDefinition.basePrice) when no carrier pricing exists.
   */
  async getMarketPrices(): Promise<Record<string, number>> {
    const [pricings, sizeDefs] = await Promise.all([
      this.prisma.carrierPricing.findMany({
        where: {
          carrier: {
            verified: true,
            companyType: { in: CARRIER_TYPES },
          },
        },
        select: { skipSize: true, price: true },
      }),
      this.prisma.skipSizeDefinition.findMany({
        where: { isActive: true },
        select: { code: true, basePrice: true },
      }),
    ]);

    const mins: Record<string, number> = {};
    for (const p of pricings) {
      if (mins[p.skipSize] === undefined || p.price < mins[p.skipSize]) {
        mins[p.skipSize] = p.price;
      }
    }

    // Fill in any size that has no carrier price using the definition basePrice or legacy fallback
    for (const def of sizeDefs) {
      if (mins[def.code] === undefined) {
        mins[def.code] = def.basePrice ?? SKIP_PRICES[def.code] ?? 0;
      }
    }

    return mins;
  }

  // ── Get quotes (public) ──────────────────────────────────────────────
  /**
   * Returns all verified carriers that cover the requested location for the
   * given skip size and delivery date, sorted cheapest first.
   *
   * Price priority: CarrierPricing (carrier's own rate) → SkipSizeDefinition.basePrice (CMS) → SKIP_PRICES (hardcoded fallback)
   * Coverage priority: serviceZones match → Haversine radius → national fallback (no config = covers all of Latvia)
   */
  async getQuotes(
    size: string,
    location: string,
    date: string,
    buyerLat?: number | null,
    buyerLng?: number | null,
  ): Promise<SkipHireQuoteResult[]> {
    const locationLower = location.toLowerCase().trim();
    const requestedDay = new Date(date);
    requestedDay.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(requestedDay);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    // Fetch all three data sources in parallel
    const [carriers, pricings, sizeDef] = await Promise.all([
      this.prisma.company.findMany({
        where: { verified: true, companyType: { in: CARRIER_TYPES } },
        include: {
          serviceZones: true,
          availabilityBlocks: {
            where: { blockedDate: { gte: requestedDay, lt: nextDay } },
          },
        },
      }),
      this.prisma.carrierPricing.findMany({
        where: { skipSize: size },
        select: { carrierId: true, price: true, currency: true },
      }),
      this.prisma.skipSizeDefinition.findUnique({
        where: { code: size },
        select: { basePrice: true },
      }),
    ]);

    // CMS base price is still used for min-price display (getMinPrices), not for quoting
    const pricingMap = new Map(pricings.map((p) => [p.carrierId, p]));

    const quotes: SkipHireQuoteResult[] = [];

    for (const carrier of carriers) {
      // Must not be blocked on this date
      if (carrier.availabilityBlocks.length > 0) continue;

      // Carrier must have explicitly configured a price for this skip size
      const pricing = pricingMap.get(carrier.id);
      if (!pricing) continue;

      // Coverage check: zones → radius → national fallback
      const coverage = this.carrierCoverage(carrier, locationLower, buyerLat, buyerLng);
      if (!coverage.covered) continue;

      const price = pricing.price + coverage.surcharge;
      const currency = pricing.currency;

      quotes.push({
        carrierId: carrier.id,
        carrierName: carrier.name,
        carrierLogo: carrier.logo ?? null,
        carrierRating: carrier.rating ?? null,
        price,
        currency,
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

    // Auto-create a CONTAINER_DELIVERY transport job when a skip hire is confirmed.
    // Only create if a carrier is assigned and no delivery job already exists.
    if (dto.status === SkipHireStatus.CONFIRMED && existing.carrierId) {
      this.createSkipDeliveryJob(id, existing).catch((err) =>
        this.logger.error(
          `Failed to auto-create delivery transport job for skip hire ${id}: ${(err as Error).message}`,
        ),
      );
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

    const orders = await this.prisma.skipHireOrder.findMany({
      where: {
        carrierId: user.companyId,
        status: { in: [SkipHireStatus.CONFIRMED, SkipHireStatus.DELIVERED] },
      },
      orderBy: { deliveryDate: 'asc' },
    });

    const now = Date.now();
    return orders.map((order) => {
      let overdueDays = 0;
      let overdueFeeEur = 0;
      if (order.status === SkipHireStatus.DELIVERED) {
        const hireDays = order.hireDays ?? DEFAULT_HIRE_DAYS;
        const ts = order.statusTimestamps as Record<string, string> | null;
        const deliveredAt = ts?.DELIVERED
          ? new Date(ts.DELIVERED)
          : order.deliveryDate;
        const hireEndMs =
          deliveredAt.getTime() + hireDays * 24 * 60 * 60 * 1000;
        overdueDays = Math.max(
          0,
          Math.floor((now - hireEndMs) / (24 * 60 * 60 * 1000)),
        );
        overdueFeeEur = overdueDays * OVERDUE_DAILY_RATE_EUR;
      }
      return { ...order, overdueDays, overdueFeeEur };
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

  // ── Auto-create CONTAINER_DELIVERY transport job ──────────────
  /**
   * Called when a skip hire transitions to CONFIRMED and a carrier is assigned.
   * Creates a TransportJob so the carrier's drivers can see and execute the delivery
   * via the standard driver app flow.
   */
  private async createSkipDeliveryJob(
    skipOrderId: string,
    skipOrder: Awaited<ReturnType<typeof this.findOne>>,
  ): Promise<void> {
    // Guard: don't create a second job if one already exists for this skip hire order
    const skipRef = `skipHireOrder:${skipOrderId}`;
    const existing = await this.prisma.transportJob.findFirst({
      where: { specialRequirements: skipRef },
      select: { id: true },
    });
    if (existing) return;

    // Resolve carrier address to use as pickup point
    const carrier = skipOrder.carrierId
      ? await this.prisma.company.findUnique({
          where: { id: skipOrder.carrierId },
          select: { street: true, city: true, state: true, postalCode: true, lat: true, lng: true },
        })
      : null;

    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const jobNumber = `SKP${year}${month}${ms}${rand}`;

    await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType: TransportJobType.CONTAINER_DELIVERY,
        carrierId: skipOrder.carrierId,
        requestedById: skipOrder.userId ?? undefined,
        pickupAddress: carrier?.street ?? 'Noliktava',
        pickupCity: carrier?.city ?? '',
        pickupState: carrier?.state ?? '',
        pickupPostal: carrier?.postalCode ?? '',
        pickupDate: skipOrder.deliveryDate,
        pickupLat: carrier?.lat ?? undefined,
        pickupLng: carrier?.lng ?? undefined,
        deliveryAddress: skipOrder.location,
        deliveryCity: skipOrder.location,
        deliveryState: '',
        deliveryPostal: '',
        deliveryDate: skipOrder.deliveryDate,
        deliveryWindow: skipOrder.deliveryWindow,
        deliveryLat: skipOrder.lat ?? undefined,
        deliveryLng: skipOrder.lng ?? undefined,
        cargoType: `SKIP_${skipOrder.skipSize}`,
        specialRequirements: skipRef,
        rate: skipOrder.price,
        currency: skipOrder.currency,
        status: skipOrder.carrierId ? TransportJobStatus.ASSIGNED : TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(
      `Auto-created delivery transport job ${jobNumber} for skip hire order ${skipOrder.orderNumber}`,
    );
  }

  // ── Create overdue invoice for a DELIVERED skip ───────────────
  /**
   * Calculates overdue days for a DELIVERED skip order and creates an Invoice
   * that the carrier can use to bill the customer for the extra rental period.
   *
   * Overdue = days elapsed since (deliveredAt + hireDays).
   * Fee = overdueDays × OVERDUE_DAILY_RATE_EUR (platform standard, €20/day).
   * LV VAT 21 % is added on top.
   */
  async createOverdueInvoice(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, canSkipHire: true },
    });
    if (!user?.canSkipHire)
      throw new ForbiddenException('Skip hire access not enabled for this account');
    if (!user.companyId)
      throw new ForbiddenException('User is not associated with a company');

    const order = await this.prisma.skipHireOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Skip hire order ${id} not found`);
    if (order.carrierId !== user.companyId)
      throw new ForbiddenException('This order does not belong to your company');
    if (order.status !== SkipHireStatus.DELIVERED)
      throw new BadRequestException(
        'Overdue invoice can only be issued for DELIVERED (active) skip orders',
      );

    const hireDays = order.hireDays ?? DEFAULT_HIRE_DAYS;
    const ts = order.statusTimestamps as Record<string, string> | null;
    const deliveredAt = ts?.DELIVERED
      ? new Date(ts.DELIVERED)
      : order.deliveryDate;
    const hireEndMs = deliveredAt.getTime() + hireDays * 24 * 60 * 60 * 1000;
    const overdueDays = Math.max(
      0,
      Math.floor((Date.now() - hireEndMs) / (24 * 60 * 60 * 1000)),
    );

    if (overdueDays === 0)
      throw new BadRequestException(
        'No overdue days — hire period has not expired yet',
      );

    const overdueFeeEur = overdueDays * OVERDUE_DAILY_RATE_EUR;
    const VAT_RATE = 0.21;
    const subtotal = Math.round(overdueFeeEur * 100) / 100;
    const tax = Math.round(subtotal * VAT_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    // Generate invoice number that encodes the skip order reference
    const suffix = Date.now().toString().slice(-4);
    const invoiceNumber = `OVD-${order.orderNumber}-${suffix}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 14-day payment term

    // Resolve buyer's company if they have one
    let buyerCompanyId: string | null = null;
    if (order.userId) {
      const buyer = await this.prisma.user.findUnique({
        where: { id: order.userId },
        select: { companyId: true },
      });
      buyerCompanyId = buyer?.companyId ?? null;
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        subtotal,
        tax,
        total,
        currency: 'EUR',
        dueDate,
        paymentStatus: 'PENDING',
        ...(buyerCompanyId ? { buyerCompanyId } : {}),
      },
    });

    this.logger.log(
      `Overdue invoice ${invoiceNumber} created for skip order ${order.orderNumber}: ${overdueDays} days × €${OVERDUE_DAILY_RATE_EUR} = €${total} incl. VAT`,
    );

    return { invoice, overdueDays, overdueFeeEur, total };
  }

  /**
   * Daily cron: raise overdue invoices for all DELIVERED skip hire orders
   * whose hire period has expired. Skips orders that already have an OVD
   * invoice raised today (idempotent — safe to re-run on restart).
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async billingOverdueSkipOrders(): Promise<void> {
    await withCronLock(this.prisma, 'billingOverdueSkipOrders', async () => {      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find all DELIVERED skip hire orders
      const delivered = await this.prisma.skipHireOrder.findMany({
        where: { status: SkipHireStatus.DELIVERED },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          carrierId: true,
          hireDays: true,
          deliveryDate: true,
          statusTimestamps: true,
        },
      });

      for (const order of delivered) {
        const hireDays = order.hireDays ?? DEFAULT_HIRE_DAYS;
        const ts = order.statusTimestamps as Record<string, string> | null;
        const deliveredAt = ts?.DELIVERED ? new Date(ts.DELIVERED) : order.deliveryDate;
        const hireEndMs = deliveredAt.getTime() + hireDays * 24 * 60 * 60 * 1000;
        const overdueDays = Math.max(
          0,
          Math.floor((Date.now() - hireEndMs) / (24 * 60 * 60 * 1000)),
        );
        if (overdueDays === 0) continue;

        // Idempotency: skip if an overdue invoice was already created today for this order
        const existingToday = await this.prisma.invoice.findFirst({
          where: {
            invoiceNumber: { startsWith: `OVD-${order.orderNumber}-` },
            createdAt: { gte: todayStart },
          },
          select: { id: true },
        });
        if (existingToday) continue;

        const overdueFeeEur = overdueDays * OVERDUE_DAILY_RATE_EUR;
        const VAT_RATE = 0.21;
        const subtotal = Math.round(overdueFeeEur * 100) / 100;
        const tax = Math.round(subtotal * VAT_RATE * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        const suffix = Date.now().toString().slice(-4);
        const invoiceNumber = `OVD-${order.orderNumber}-${suffix}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        let buyerCompanyId: string | null = null;
        if (order.userId) {
          const buyer = await this.prisma.user.findUnique({
            where: { id: order.userId },
            select: { companyId: true },
          });
          buyerCompanyId = buyer?.companyId ?? null;
        }

        try {
          await this.prisma.invoice.create({
            data: {
              invoiceNumber,
              subtotal,
              tax,
              total,
              currency: 'EUR',
              dueDate,
              paymentStatus: 'PENDING',
              ...(buyerCompanyId ? { buyerCompanyId } : {}),
            },
          });
          this.logger.log(
            `[billingOverdue] Invoice ${invoiceNumber} for skip order ${order.orderNumber}: ${overdueDays}d × €${OVERDUE_DAILY_RATE_EUR} = €${total} incl. VAT`,
          );

          // Notify buyer
          if (order.userId) {
            this.notifications
              .create({
                userId: order.userId,
                type: NotificationType.SYSTEM_ALERT,
                title: '📋 Kavēšanās maksa — konteiners jāatdod',
                message: `Jūsu konteinera nomas termiņš ir beidzies (${overdueDays} diena${overdueDays !== 1 ? 's' : ''}). Papildu maksa €${total} tika iekļauta rēķinā ${invoiceNumber}.`,
                data: { skipOrderId: order.id, invoiceNumber },
              })
              .catch((err: unknown) =>
                this.logger.warn(
                  `billingOverdue notif failed for order ${order.id}: ${err instanceof Error ? err.message : String(err)}`,
                ),
              );
          }
        } catch (err: unknown) {
          this.logger.error(
            `[billingOverdue] Failed to create invoice for skip order ${order.orderNumber}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }, this.logger);
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Determines whether a carrier covers the given location and at what surcharge.
   * Priority: serviceZones city/postcode match → Haversine radius check → national fallback.
   */
  private carrierCoverage(
    carrier: {
      serviceZones: { city: string; postcode: string | null; surcharge: number }[];
      lat: number | null;
      lng: number | null;
      serviceRadiusKm: number | null;
    },
    locationLower: string,
    buyerLat?: number | null,
    buyerLng?: number | null,
  ): { covered: boolean; surcharge: number } {
    // 1. Explicit service zone match (city or postcode string)
    const zone = carrier.serviceZones.find(
      (z) =>
        locationLower.includes(z.city.toLowerCase()) ||
        z.city.toLowerCase().includes(locationLower) ||
        (z.postcode && locationLower.includes(z.postcode.toLowerCase())),
    );
    if (zone) return { covered: true, surcharge: zone.surcharge };

    // 2. Radius check using Haversine — requires both carrier and buyer coordinates
    if (
      carrier.serviceRadiusKm !== null &&
      carrier.lat !== null &&
      carrier.lng !== null &&
      buyerLat != null &&
      buyerLng != null
    ) {
      const distKm = this.haversineKm(carrier.lat, carrier.lng, buyerLat, buyerLng);
      return { covered: distKm <= carrier.serviceRadiusKm, surcharge: 0 };
    }

    // 3. Radius set but no buyer coords → assume covered (carrier can decline)
    if (carrier.serviceRadiusKm !== null && (buyerLat == null || buyerLng == null)) {
      return { covered: true, surcharge: 0 };
    }

    // 4. No zones and no radius configured → national coverage (Latvia is small)
    if (carrier.serviceZones.length === 0 && carrier.serviceRadiusKm === null) {
      return { covered: true, surcharge: 0 };
    }

    return { covered: false, surcharge: 0 };
  }

  /** Haversine great-circle distance in kilometres. */
  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Broadcast a SKIP_JOB_AVAILABLE notification to all canSkipHire users
   * in verified CARRIER/HYBRID companies that cover the given location.
   * Called fire-and-forget after creating an order without a pre-selected carrier.
   */
  private async broadcastToEligibleCarriers(
    orderId: string,
    orderNumber: string,
    size: string,
    location: string,
    buyerLat?: number | null,
    buyerLng?: number | null,
  ): Promise<void> {
    const locationLower = location.toLowerCase().trim();

    const carriers = await this.prisma.company.findMany({
      where: { verified: true, companyType: { in: CARRIER_TYPES } },
      select: {
        serviceZones: { select: { city: true, postcode: true, surcharge: true } },
        lat: true,
        lng: true,
        serviceRadiusKm: true,
        users: {
          where: { canSkipHire: true },
          select: { id: true },
        },
      },
    });

    const recipientIds: string[] = [];
    for (const carrier of carriers) {
      const coverage = this.carrierCoverage(carrier, locationLower, buyerLat, buyerLng);
      if (!coverage.covered) continue;
      for (const u of carrier.users) recipientIds.push(u.id);
    }

    await Promise.all(
      recipientIds.map((userId) =>
        this.notifications
          .create({
            userId,
            type: NotificationType.ORDER_CREATED,
            title: 'Jauns konteinera pasūtījums',
            message: `Konteiners ${size} — ${location}. Apstiprini, lai pieņemtu darbu.`,
            data: { skipOrderId: orderId, orderNumber },
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `Broadcast notif failed for userId ${userId}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          ),
      ),
    );

    this.logger.log(
      `Skip hire order ${orderNumber} broadcast to ${recipientIds.length} eligible carrier user(s)`,
    );
  }

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

  // ── Buyer self-service actions ────────────────────────────────────────────

  /**
   * PATCH /skip-hire/:id/amend
   * Buyer can amend delivery date, delivery window, and notes on a PENDING or
   * CONFIRMED order (i.e. before the skip has been delivered).
   */
  async amend(
    id: string,
    userId: string,
    data: { deliveryDate?: string; deliveryWindow?: string; notes?: string; contactName?: string; contactPhone?: string },
  ) {
    const order = await this.findOne(id, userId);
    if (
      order.status !== SkipHireStatus.PENDING &&
      order.status !== SkipHireStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Pasūtījumu var labot tikai pirms piegādes (statuss: PENDING vai CONFIRMED)',
      );
    }
    const updated = await this.prisma.skipHireOrder.update({
      where: { id },
      data: {
        ...(data.deliveryDate ? { deliveryDate: new Date(data.deliveryDate) } : {}),
        ...(data.deliveryWindow !== undefined ? { deliveryWindow: data.deliveryWindow } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
      },
      include: {
        carrier: { select: { id: true, name: true, phone: true, rating: true } },
      },
    });

    if (order.userId) {
      this.notifications
        .create({
          userId: order.userId,
          type: NotificationType.ORDER_CONFIRMED,
          title: 'Pasūtījums labots',
          message: `Konteinera pasūtījums #${order.orderNumber} ir veiksmīgi atjaunināts.`,
          data: { orderId: id },
        })
        .catch(() => null);
    }

    this.logger.log(`Skip order ${order.orderNumber} amended by user ${userId}`);
    return updated;
  }

  /**
   * POST /skip-hire/:id/request-pickup
   * Buyer requests early collection for a DELIVERED skip.
   * Creates a notification to the carrier and marks a timestamp.
   */
  async requestPickup(id: string, userId: string) {
    const order = await this.findOne(id, userId);
    if (order.status !== SkipHireStatus.DELIVERED) {
      throw new BadRequestException(
        'Savākšanu var pieprasīt tikai tad, kad konteiners ir piegādāts (statuss: DELIVERED)',
      );
    }

    const existingTs =
      order.statusTimestamps && typeof order.statusTimestamps === 'object'
        ? (order.statusTimestamps as Record<string, string>)
        : {};

    // Don't allow duplicate requests
    if (existingTs['PICKUP_REQUESTED']) {
      throw new BadRequestException('Savākšana jau ir pieprasīta');
    }

    await this.prisma.skipHireOrder.update({
      where: { id },
      data: {
        statusTimestamps: { ...existingTs, PICKUP_REQUESTED: new Date().toISOString() },
      },
    });

    // Notify the carrier if one is assigned
    if (order.carrierId) {
      // Find any user belonging to the carrier company (owner/manager)
      const carrierUsers = await this.prisma.user.findMany({
        where: { companyId: order.carrierId, companyRole: { in: ['OWNER', 'MANAGER'] } },
        select: { id: true },
        take: 5,
      });
      await Promise.all(
        carrierUsers.map((u) =>
          this.notifications
            .create({
              userId: u.id,
              type: NotificationType.SYSTEM_ALERT,
              title: 'Savākšanas pieprasījums',
              message: `Pircējs pieprasa konteinera savākšanu pasūtījumam #${order.orderNumber}.`,
              data: { skipOrderId: id },
            })
            .catch(() => null),
        ),
      );
    }

    this.logger.log(`Pickup requested for skip order ${order.orderNumber} by user ${userId}`);
    return { ok: true, message: 'Savākšanas pieprasījums nosūtīts pārvadātājam' };
  }

  /**
   * PATCH /skip-hire/:id/extend
   * Buyer extends the hire period by adding more days to hireDays.
   * Only allowed on DELIVERED orders. Additional charge is not yet auto-invoiced;
   * the carrier will issue a supplementary invoice manually.
   */
  async extendHire(id: string, userId: string, additionalDays: number) {
    if (!Number.isInteger(additionalDays) || additionalDays < 1 || additionalDays > 90) {
      throw new BadRequestException('additionalDays must be an integer between 1 and 90');
    }

    const order = await this.findOne(id, userId);
    if (order.status !== SkipHireStatus.DELIVERED) {
      throw new BadRequestException(
        'Nomas periodu var pagarināt tikai tad, kad konteiners ir piegādāts (statuss: DELIVERED)',
      );
    }

    const existingDays = order.hireDays ?? DEFAULT_HIRE_DAYS;
    const newHireDays = existingDays + additionalDays;

    const updated = await this.prisma.skipHireOrder.update({
      where: { id },
      data: { hireDays: newHireDays },
      include: {
        carrier: { select: { id: true, name: true, phone: true, rating: true } },
      },
    });

    if (order.userId) {
      this.notifications
        .create({
          userId: order.userId,
          type: NotificationType.ORDER_CONFIRMED,
          title: 'Nomas periods pagarināts',
          message: `Konteinera nomas periods pasūtījumam #${order.orderNumber} pagarināts par ${additionalDays} d. (kopā ${newHireDays} d.).`,
          data: { orderId: id },
        })
        .catch(() => null);
    }

    this.logger.log(
      `Skip order ${order.orderNumber} extended by ${additionalDays} days (total ${newHireDays}) by user ${userId}`,
    );
    return updated;
  }
}
