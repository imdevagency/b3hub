/**
 * GuestOrdersService
 *
 * Handles the full lifecycle of no-account (guest) orders:
 *   1. Buyer submits order with name + phone (email optional)
 *   2. Platform admin / auto-matching notified
 *   3. Guest receives SMS confirmation (future) + email if provided
 *   4. Public token URL lets guest track without logging in
 *   5. Admin sets a quoted price and sends a payment link
 *   6. Guest pays via Paysera hosted checkout (no account required)
 *   7. On registration: convertGuestToOrder() links guest → real Order
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { GuestOrderStatus } from '@prisma/client';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { randomBytes } from 'crypto';
import { PayseraService } from '../paysera/paysera.service';
import { AuthService } from '../auth/auth.service';

/** Generate a 24-char URL-safe token (no external dependency). */
function generateToken(): string {
  return randomBytes(18).toString('base64url');
}

@Injectable()
export class GuestOrdersService {
  private readonly logger = new Logger(GuestOrdersService.name);
  private readonly webUrl: string;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private config: ConfigService,
    private paysera: PayseraService,
    private auth: AuthService,
  ) {
    this.webUrl = this.config.get<string>('WEB_URL') ?? 'https://b3hub.lv';
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateGuestOrderDto) {
    const token = generateToken(); // URL-safe, collision-resistant tracking token
    const orderNumber = `G-${Date.now().toString(36).toUpperCase()}`;
    const category = dto.category ?? 'MATERIAL';

    const guestOrder = await this.prisma.guestOrder.create({
      data: {
        orderNumber,
        token,
        category,
        // MATERIAL specific
        materialCategory: dto.materialCategory,
        materialName: dto.materialName,
        quantity: dto.quantity,
        unit: dto.unit,
        // SKIP_HIRE specific
        skipSize: dto.skipSize,
        skipWasteCategory: dto.skipWasteCategory,
        hireDays: dto.hireDays,
        collectionDate: dto.collectionDate ? new Date(dto.collectionDate) : undefined,
        // TRANSPORT specific
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        vehicleType: dto.vehicleType,
        cargoDescription: dto.cargoDescription,
        estimatedWeight: dto.estimatedWeight,
        // DISPOSAL specific
        wasteTypes: dto.wasteTypes,
        disposalVolume: dto.disposalVolume,
        truckType: dto.truckType,
        // Shared location
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryPostal: dto.deliveryPostal,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
        deliveryWindow: dto.deliveryWindow,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        notes: dto.notes,
        status: GuestOrderStatus.PENDING,
      },
    });

    const trackingUrl = `${this.webUrl}/pasutijums/${token}`;

    // Send confirmation email if provided
    if (dto.contactEmail) {
      await this.email
        .sendGuestOrderConfirmation(
          dto.contactEmail,
          dto.contactName,
          guestOrder.orderNumber,
          trackingUrl,
          category,
          {
            materialName: dto.materialName,
            quantity: dto.quantity,
            unit: dto.unit,
            skipSize: dto.skipSize,
            skipWasteCategory: dto.skipWasteCategory,
            hireDays: dto.hireDays,
            pickupAddress: dto.pickupAddress,
            pickupCity: dto.pickupCity,
            vehicleType: dto.vehicleType,
            cargoDescription: dto.cargoDescription,
            wasteTypes: dto.wasteTypes,
            disposalVolume: dto.disposalVolume,
            deliveryAddress: dto.deliveryAddress,
            deliveryCity: dto.deliveryCity,
            deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : undefined,
            deliveryWindow: dto.deliveryWindow,
          },
        )
        .catch((err) => {
          // Non-fatal — order is created even if email fails
          this.logger.error('Failed to send guest confirmation email', err);
        });
    }

    this.logger.log(`Guest order created: ${orderNumber} category=${category} (token: ${token})`);

    return {
      orderNumber: guestOrder.orderNumber,
      token: guestOrder.token,
      trackingUrl,
      status: guestOrder.status,
    };
  }

  // ── Track by token (public) ───────────────────────────────────────────────

  async findByToken(token: string) {
    const order = await this.prisma.guestOrder.findUnique({
      where: { token },
      select: {
        orderNumber: true,
        token: true,
        status: true,
        materialCategory: true,
        materialName: true,
        quantity: true,
        unit: true,
        deliveryAddress: true,
        deliveryCity: true,
        deliveryDate: true,
        deliveryWindow: true,
        contactName: true,
        // Redact sensitive contact info from public response
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pasūtījums nav atrasts');
    }

    return order;
  }

  // ── Admin: list all guest orders ──────────────────────────────────────────

  async findAll(status?: GuestOrderStatus) {
    return this.prisma.guestOrder.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Admin: get single guest order ─────────────────────────────────────────

  async findOne(id: string) {
    const order = await this.prisma.guestOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Guest order not found');
    return order;
  }

  // ── Admin: update status ──────────────────────────────────────────────────

  async updateStatus(id: string, status: GuestOrderStatus) {
    const order = await this.prisma.guestOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Guest order not found');

    return this.prisma.guestOrder.update({
      where: { id },
      data: { status },
    });
  }

  // ── Convert guest order to a real Order when user registers ──────────────

  async convertToOrder(token: string, newOrderId: string) {
    const guestOrder = await this.prisma.guestOrder.findUnique({
      where: { token },
    });

    if (!guestOrder) {
      throw new NotFoundException('Guest order not found');
    }
    if (guestOrder.status === GuestOrderStatus.CONVERTED) {
      throw new BadRequestException('Guest order has already been converted');
    }
    if (guestOrder.convertedOrderId) {
      throw new BadRequestException(
        'Guest order is already linked to a real order',
      );
    }

    return this.prisma.guestOrder.update({
      where: { token },
      data: {
        status: GuestOrderStatus.CONVERTED,
        convertedOrderId: newOrderId,
      },
    });
  }

  // ── Public: claim guest order by registering an account ──────────────────
  /**
   * Lets a guest who has just placed an order create a real B3Hub account
   * pre-filled with the contact info already on the GuestOrder. The order
   * itself stays a GuestOrder until admin runs convertToOrder(); this only
   * promotes the buyer from anonymous → registered so they can log in,
   * track future orders, and have history.
   *
   * Returns the same shape as POST /auth/register: { user, token, refreshToken }.
   */
  async claimByToken(
    token: string,
    payload: { email: string; password: string; firstName?: string; lastName?: string },
  ) {
    const guestOrder = await this.prisma.guestOrder.findUnique({
      where: { token },
    });
    if (!guestOrder) {
      throw new NotFoundException('Pasūtījums nav atrasts');
    }

    // Split contactName into first/last as a fallback when the form omitted them.
    const nameParts = (guestOrder.contactName ?? '').trim().split(/\s+/);
    const firstName = payload.firstName?.trim() || nameParts[0] || 'Klients';
    const lastName =
      payload.lastName?.trim() || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    const result = await this.auth.register({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      firstName,
      lastName,
      phone: guestOrder.contactPhone || undefined,
      roles: ['BUYER'],
      isCompany: false,
      termsAccepted: true,
    });

    // Mark guest order CONTACTED so admin sees the buyer is now registered.
    // Don't set CONVERTED — that is reserved for "linked to a real Order".
    if (guestOrder.status === GuestOrderStatus.PENDING) {
      await this.prisma.guestOrder
        .update({
          where: { token },
          data: { status: GuestOrderStatus.CONTACTED },
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to mark guest order ${guestOrder.id} as CONTACTED after claim: ${(err as Error).message}`,
          ),
        );
    }

    this.logger.log(
      `Guest order ${guestOrder.orderNumber} claimed → user ${result.user.id} (${payload.email})`,
    );

    return result;
  }

  // ── Admin: set quoted price ───────────────────────────────────────────────
  /**
   * Admin quotes a price for a guest order before sending the payment link.
   * Must be called before createPaymentIntent().
   */
  async setQuote(id: string, quotedAmount: number, quotedCurrency = 'EUR') {
    if (quotedAmount <= 0) {
      throw new BadRequestException('Quoted amount must be greater than 0');
    }
    const order = await this.prisma.guestOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Guest order not found');

    return this.prisma.guestOrder.update({
      where: { id },
      data: { quotedAmount, quotedCurrency, status: GuestOrderStatus.CONTACTED },
    });
  }

  // ── Guest: initiate card checkout ─────────────────────────────────────────
  /**
   * Create a Paysera checkout for a guest order so the guest can pay by card
   * without creating an account.
   *
   * Requires admin to have set `quotedAmount` via setQuote() first.
   * Returns a Paysera payment URL the guest opens to complete payment.
   */
  async createPaymentIntent(id: string) {
    const guestOrder = await this.prisma.guestOrder.findUnique({ where: { id } });
    if (!guestOrder) throw new NotFoundException('Guest order not found');

    if (!guestOrder.quotedAmount || guestOrder.quotedAmount <= 0) {
      throw new BadRequestException(
        'A quoted price must be set before initiating payment',
      );
    }

    if (guestOrder.paymentStatus === 'PAID') {
      throw new BadRequestException('This order has already been paid');
    }

    // Idempotency: reuse existing checkout link if still active
    if (guestOrder.payseraOrderId && guestOrder.payseraPaymentUrl) {
      return {
        paymentUrl: guestOrder.payseraPaymentUrl,
        payseraOrderId: guestOrder.payseraOrderId,
      };
    }

    const amountCents = Math.round(guestOrder.quotedAmount * 100);
    const currency = guestOrder.quotedCurrency ?? 'EUR';
    const baseUrl = this.config.get<string>('APP_BASE_URL') ?? 'https://b3hub.app';
    const apiUrl = this.config.get<string>('API_URL') ?? 'https://api.b3hub.app';

    const checkout = await this.paysera.createCheckout({
      reference: guestOrder.orderNumber,
      amountCents,
      currency,
      successUrl: `${baseUrl}/guest/payment-success`,
      failureUrl: `${baseUrl}/guest/payment-failed`,
      callbackUrl: `${apiUrl}/api/v1/payments/webhook`,
      name: `Pasūtījums ${guestOrder.orderNumber}`,
    });

    await this.prisma.guestOrder.update({
      where: { id },
      data: {
        payseraOrderId: checkout.payseraOrderId,
        payseraPaymentUrl: checkout.paymentUrl,
        paymentStatus: 'PENDING',
      },
    });

    this.logger.log(
      `Guest Paysera checkout created for ${guestOrder.orderNumber}`,
    );

    return {
      paymentUrl: checkout.paymentUrl,
      payseraOrderId: checkout.payseraOrderId,
    };
  }

  // ── Webhook handler: mark guest order as paid ─────────────────────────────
  /**
   * Called from the Paysera webhook handler when a guest order is paid.
   * Updates the guest order status to CONTACTED (awaiting fulfillment).
   */
  async markGuestOrderPaid(payseraOrderId: string): Promise<void> {
    const guestOrder = await this.prisma.guestOrder.findFirst({
      where: { payseraOrderId },
    });
    if (!guestOrder) {
      this.logger.warn(
        `markGuestOrderPaid: no guest order found for Paysera order ${payseraOrderId}`,
      );
      return;
    }

    await this.prisma.guestOrder.update({
      where: { id: guestOrder.id },
      data: {
        paymentStatus: 'PAID',
        status: GuestOrderStatus.CONTACTED, // admin now arranges fulfillment
      },
    });

    // Send payment confirmation email
    if (guestOrder.contactEmail) {
      const trackingUrl = `${this.webUrl}/pasutijums/${guestOrder.token}`;
      this.email
        .sendGuestOrderConfirmation(
          guestOrder.contactEmail,
          guestOrder.contactName,
          guestOrder.orderNumber,
          trackingUrl,
          guestOrder.category,
          {
            materialName: guestOrder.materialName ?? undefined,
            quantity: guestOrder.quantity ?? undefined,
            unit: guestOrder.unit ?? undefined,
            skipSize: guestOrder.skipSize ?? undefined,
            skipWasteCategory: guestOrder.skipWasteCategory ?? undefined,
            hireDays: guestOrder.hireDays ?? undefined,
            pickupAddress: guestOrder.pickupAddress ?? undefined,
            pickupCity: guestOrder.pickupCity ?? undefined,
            vehicleType: guestOrder.vehicleType ?? undefined,
            cargoDescription: guestOrder.cargoDescription ?? undefined,
            wasteTypes: guestOrder.wasteTypes ?? undefined,
            disposalVolume: guestOrder.disposalVolume ?? undefined,
            deliveryAddress: guestOrder.deliveryAddress,
            deliveryCity: guestOrder.deliveryCity,
            deliveryDate: guestOrder.deliveryDate ?? undefined,
            deliveryWindow: guestOrder.deliveryWindow ?? undefined,
          },
        )
        .catch((err) =>
          this.logger.error(
            `Failed to send guest payment confirmation email: ${(err as Error).message}`,
          ),
        );
    }

    this.logger.log(
      `Guest order ${guestOrder.orderNumber} marked PAID via Paysera order ${payseraOrderId}`,
    );
  }
}

