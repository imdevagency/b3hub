import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';

@Injectable()
export class PaymentsService {
  private stripe!: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notifications: NotificationsService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2026-02-25.clover',
      });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not found in env');
    }
  }

  /**
   * Create a PaymentIntent for an Order.
   * This authorizes the amount on the buyer's card.
   */
  async createPaymentIntent(orderId: string, user: RequestingUser) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true }, // To get customer details if needed
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.createdById !== user.userId && user.userType !== 'ADMIN') {
        // Basic check, might need more robust permission logic
        throw new BadRequestException('Not authorized to pay for this order');
    }

    // Amount in cents
    const amount = Math.round(order.total * 100);

    // Create PaymentIntent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: order.currency.toLowerCase(),
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      capture_method: 'manual', // Authorize only, capture later
    });

    // Create or update Payment record
    await this.prisma.payment.upsert({
      where: { orderId: orderId },
      create: {
        orderId: orderId,
        stripePaymentId: paymentIntent.id,
        amount: order.total,
        currency: order.currency,
        status: 'PENDING',
      },
      update: {
        stripePaymentId: paymentIntent.id,
        amount: order.total,
        currency: order.currency,
        status: 'PENDING',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      publishableKey: this.configService.get('STRIPE_PUBLISHABLE_KEY'),
    };
  }

  /**
   * Generate a Stripe Connect Express onboarding link for a seller/carrier.
   */
  async createConnectAccountLink(user: RequestingUser) {
    if (!this.stripe) {
        throw new BadRequestException('Stripe is not configured');
    }
    
    // Ensure user has a company
    const companyId = user.companyId;
    if (!companyId) {
        throw new BadRequestException('User must belong to a company to receive payouts');
    }

    const company = await this.prisma.company.findUnique({
        where: { id: companyId },
    });

    if (!company) throw new BadRequestException('Company not found');

    let accountId = company.stripeConnectId;

    if (!accountId) {
        // Create a new Express account
        const account = await this.stripe.accounts.create({
            type: 'express',
            country: company.country || 'LV', // Default to Latvia or use company country
            email: company.email,
            business_type: 'company',
            capabilities: {
                transfers: { requested: true },
            },
        });
        accountId = account.id;

        // Save to DB
        await this.prisma.company.update({
            where: { id: companyId },
            data: { stripeConnectId: accountId },
        });
    }

    // Create an account link for onboarding
    const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${this.configService.get('WEB_BASE_URL')}/dashboard/supplier/earnings?refresh=true`,
        return_url: `${this.configService.get('WEB_BASE_URL')}/dashboard/supplier/earnings?success=true`,
        type: 'account_onboarding',
    });

    return { url: accountLink.url };
  }

  /**
   * Capture funds when order is confirmed/in-progress.
   */
  async capturePayment(orderId: string) {
       if (!this.stripe) {
         this.logger.error(`capturePayment called for order ${orderId} but Stripe is not configured`);
         throw new BadRequestException('Stripe is not configured — set STRIPE_SECRET_KEY');
       }

       const payment = await this.prisma.payment.findUnique({
           where: { orderId },
       });

       if (!payment || !payment.stripePaymentId) {
           throw new BadRequestException('No payment found for this order');
       }

       if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
           return; // Already captured
       }

       try {
           const paymentIntent = await this.stripe.paymentIntents.capture(payment.stripePaymentId);
           
           if (paymentIntent.status === 'succeeded') {
                await this.prisma.$transaction([
                  this.prisma.payment.update({
                      where: { orderId },
                      data: { status: 'CAPTURED' },
                  }),
                  this.prisma.order.update({
                      where: { id: orderId },
                      data: { paymentStatus: 'CAPTURED' },
                  }),
                ]);
           }
       } catch (error) {
           this.logger.error(`Failed to capture payment for order ${orderId}: ${(error as Error).message}`);
           throw error;
       }
  }

    /**
   * Release funds (Transfer) to seller and driver via Stripe Connect.
   * Called when order is COMPLETED.
   * Platform keeps a 5% fee; remainder split 80% seller / 20% driver (if job exists).
   */
  async releaseFunds(orderId: string) {
    if (!this.stripe) {
      this.logger.error(`releaseFunds called for order ${orderId} but Stripe is not configured`);
      throw new BadRequestException('Stripe is not configured — set STRIPE_SECRET_KEY');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment || !payment.stripePaymentId) {
      this.logger.warn(`releaseFunds: no payment record for order ${orderId}`);
      return;
    }

    if (payment.status === 'RELEASED') {
      return; // Already released
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            material: {
              include: {
                supplier: { select: { id: true, stripeConnectId: true } },
              },
            },
          },
        },
        transportJobs: {
          where: { status: 'DELIVERED' },
          include: {
            driver: {
              select: {
                id: true,
                companyId: true,
                company: { select: { stripeConnectId: true } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new BadRequestException('Order not found');

    const totalCents = Math.round(Number(order.total) * 100);
    const PLATFORM_FEE_PERCENT = 0.05;
    const platformFeeCents = Math.round(totalCents * PLATFORM_FEE_PERCENT);
    const payoutCents = totalCents - platformFeeCents;

    // Determine if a driver is involved
    const deliveredJob = order.transportJobs?.[0];
    const driverConnectId =
      deliveredJob?.driver?.company?.stripeConnectId ?? null;

    const DRIVER_SHARE_PERCENT = driverConnectId ? 0.2 : 0;
    const driverCents = Math.round(payoutCents * DRIVER_SHARE_PERCENT);
    const sellerCents = payoutCents - driverCents;

    // Stripe requires a transfer group to link transfers to a PaymentIntent
    const transferGroup = `order_${orderId}`;

    // Retrieve the charge ID from the PaymentIntent
    let chargeId = payment.stripeChargeId;
    if (!chargeId) {
      const pi = await this.stripe.paymentIntents.retrieve(
        payment.stripePaymentId,
      );
      chargeId =
        typeof pi.latest_charge === 'string'
          ? pi.latest_charge
          : (pi.latest_charge?.id ?? null);
      if (chargeId) {
        await this.prisma.payment.update({
          where: { orderId },
          data: { stripeChargeId: chargeId },
        });
      }
    }

    const supplierIds = [
      ...new Set(order.items.map((i) => i.material.supplier.id)),
    ];
    // For simplicity split seller payout equally among suppliers when multiple (rare after cart-split)
    const perSupplierCents = Math.round(sellerCents / supplierIds.length);

    for (const item of order.items) {
      const supplierConnectId = item.material.supplier.stripeConnectId;
      if (!supplierConnectId) {
        this.logger.warn(
          `Supplier ${item.material.supplier.id} has no Stripe Connect account — skipping transfer`,
        );
        continue;
      }

      try {
        await this.stripe.transfers.create({
          amount: perSupplierCents,
          currency: order.currency.toLowerCase(),
          destination: supplierConnectId,
          transfer_group: transferGroup,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: { orderId, supplierId: item.material.supplier.id },
        });
      } catch (err) {
        this.logger.error(
          `Supplier transfer failed for order ${orderId}: ${(err as Error).message}`,
        );
        throw err;
      }
      break; // one transfer per supplier (items may repeat the same supplier)
    }

    // Driver transfer
    if (driverConnectId && driverCents > 0) {
      try {
        await this.stripe.transfers.create({
          amount: driverCents,
          currency: order.currency.toLowerCase(),
          destination: driverConnectId,
          transfer_group: transferGroup,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: { orderId, driverId: deliveredJob?.driverId ?? '' },
        });
      } catch (err) {
        this.logger.error(
          `Driver transfer failed for order ${orderId}: ${(err as Error).message}`,
        );
        // Non-fatal — seller already paid; log and continue
      }
    }

    // Mark payment as released and record the split
    await this.prisma.payment.update({
      where: { orderId },
      data: {
        status: 'RELEASED',
        transferGroup,
        platformFee: platformFeeCents / 100,
        sellerPayout: sellerCents / 100,
        driverPayout: driverCents / 100,
      },
    });

    // Update the order's paymentStatus
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'RELEASED' },
    });
  }

  /**
   * Handle Stripe webhook events.
   * Verifies signature and processes relevant event types.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret || !this.stripe) {
      this.logger.warn('Stripe webhook secret not configured — skipping');
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Stripe webhook signature invalid: ${(err as Error).message}`);

    }

    switch (event.type) {
      // Buyer authorized the payment (card held, not yet captured)
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'AUTHORIZED' },
            })
            .catch(() => null);
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'AUTHORIZED' },
            })
            .catch(() => null);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'CAPTURED' },
            })
            .catch(() => null);
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'CAPTURED' },
            })
            .catch(() => null);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'FAILED' },
            })
            .catch(() => null);
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'FAILED' },
            })
            .catch(() => null);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi = charge.payment_intent as string | null;
        if (pi) {
          const payment = await this.prisma.payment.findFirst({
            where: { stripePaymentId: pi },
          });
          if (payment) {
            await this.prisma.payment
              .update({
                where: { id: payment.id },
                data: { status: 'REFUNDED' },
              })
              .catch(() => null);
            await this.prisma.order
              .update({
                where: { id: payment.orderId },
                data: { paymentStatus: 'REFUNDED' },
              })
              .catch(() => null);
          }
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  }

  /**
   * POST /payments/dispute/:orderId
   * Buyer reports an issue with a DELIVERED order (wrong quantity, damage, etc.).
   * Flags the order for admin review and alerts all admins via in-app notification.
   */
  async reportDispute(
    orderId: string,
    reason: string,
    details: string | undefined,
    user: RequestingUser,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, buyerId: true, createdById: true, status: true, internalNotes: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Only the buyer who created the order (or any member of their company) may dispute
    if (order.buyerId !== user.companyId && order.createdById !== user.userId) {
      throw new ForbiddenException('Not authorized to dispute this order');
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('Only delivered orders can be disputed');
    }

    const disputeEntry =
      `[DISPUTE ${new Date().toISOString()}] Reason: ${reason}` +
      (details ? `\nDetails: ${details}` : '');

    const updatedNotes = order.internalNotes
      ? `${order.internalNotes}\n\n${disputeEntry}`
      : disputeEntry;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { internalNotes: updatedNotes },
    });

    // Notify all admin users
    const admins = await this.prisma.user.findMany({
      where: { userType: 'ADMIN' },
      select: { id: true },
    });

    await this.notifications.createForMany(
      admins.map((a) => a.id),
      {
        type: NotificationType.SYSTEM_ALERT,
        title: `Strīds: pasūtījums ${order.orderNumber}`,
        message: `${reason}${details ? ` — ${details.slice(0, 80)}` : ''}`,
        data: { orderId, orderNumber: order.orderNumber, reason },
      },
    );

    this.logger.log(`Dispute filed for order ${order.orderNumber} by user ${user.userId}`);

    return { ok: true, message: 'Sūdzība saņemta. Mēs sazināsimies ar jums 1-2 darba dienu laikā.' };
  }
}
