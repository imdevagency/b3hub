import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentStatus } from '@prisma/client';
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
      paymentIntentId: paymentIntent.id,
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
      throw new BadRequestException(
        'User must belong to a company to receive payouts',
      );
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
      this.logger.error(
        `capturePayment called for order ${orderId} but Stripe is not configured`,
      );
      throw new BadRequestException(
        'Stripe is not configured — set STRIPE_SECRET_KEY',
      );
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
      const paymentIntent = await this.stripe.paymentIntents.capture(
        payment.stripePaymentId,
      );

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
      this.logger.error(
        `Failed to capture payment for order ${orderId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Void or refund payment when an order is cancelled.
   *
   * - If the PaymentIntent has not been captured yet → cancel it (no charge at all).
   * - If it has been captured → issue a full Stripe refund.
   * - If there is no payment record (e.g. buyer never initiated checkout) → no-op.
   *
   * Non-fatal by design — a failed Stripe call should NOT block order cancellation;
   * the record is logged and requires manual reconciliation.
   */
  async voidOrRefund(orderId: string): Promise<void> {
    if (!this.stripe) {
      this.logger.warn(
        `voidOrRefund called for order ${orderId} but Stripe is not configured — skipping`,
      );
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment?.stripePaymentId) {
      // Buyer never completed checkout — nothing to void
      return;
    }

    if (payment.status === 'RELEASED') {
      // Funds already transferred; needs manual admin intervention
      this.logger.warn(
        `voidOrRefund: order ${orderId} payment already RELEASED — manual refund required`,
      );
      return;
    }

    try {
      if (payment.status === 'CAPTURED') {
        // Full refund — charge has already left the buyer's card
        const chargeId = payment.stripeChargeId;
        if (chargeId) {
          await this.stripe.refunds.create({ charge: chargeId });
        } else {
          // Retrieve charge ID from the PaymentIntent first
          const pi = await this.stripe.paymentIntents.retrieve(
            payment.stripePaymentId,
          );
          const resolvedChargeId =
            typeof pi.latest_charge === 'string'
              ? pi.latest_charge
              : (pi.latest_charge?.id ?? null);
          if (resolvedChargeId) {
            await this.stripe.refunds.create({ charge: resolvedChargeId });
          } else {
            this.logger.warn(
              `voidOrRefund: no charge found on PaymentIntent for order ${orderId}`,
            );
          }
        }
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: 'REFUNDED' },
        });
        this.logger.log(`Order ${orderId} — payment refunded`);
      } else {
        // Not yet captured — cancel the authorization (no charge)
        await this.stripe.paymentIntents.cancel(payment.stripePaymentId);
        await this.prisma.payment.update({
          where: { orderId },
          data: { status: PaymentStatus.REFUNDED },
        });
        this.logger.log(`Order ${orderId} — PaymentIntent cancelled (no charge)`);
      }
    } catch (err) {
      this.logger.error(
        `voidOrRefund failed for order ${orderId}: ${(err as Error).message}`,
      );
      // Non-fatal — cancellation proceeds regardless; finance team reconciles manually
    }
  }

  /**
   * Release funds (Transfer) to seller and driver via Stripe Connect.
   * Called when order is COMPLETED.
   * Platform keeps a 5% fee; remainder split 80% seller / 20% driver (if job exists).
   */
  async releaseFunds(orderId: string) {
    if (!this.stripe) {
      this.logger.error(
        `releaseFunds called for order ${orderId} but Stripe is not configured`,
      );
      throw new BadRequestException(
        'Stripe is not configured — set STRIPE_SECRET_KEY',
      );
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
                supplier: { select: { id: true, stripeConnectId: true, commissionRate: true } },
              },
            },
          },
        },
        transportJobs: {
          where: { status: 'DELIVERED' },
          // Take the most recently delivered job so re-delivery scenarios pay the
          // correct driver (not the original driver whose job was cancelled / replaced).
          orderBy: { updatedAt: 'desc' },
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
    // Use the highest commissionRate among suppliers on this order, defaulting to 10%
    const supplierRates = order.items.map(
      (i) => i.material.supplier.commissionRate ?? 10,
    );
    const commissionPct = Math.max(...supplierRates) / 100;
    const platformFeeCents = Math.round(totalCents * commissionPct);
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

    for (const supplierId of supplierIds) {
      const supplierItem = order.items.find(
        (i) => i.material.supplier.id === supplierId,
      );
      const supplierConnectId = supplierItem?.material.supplier.stripeConnectId;
      if (!supplierConnectId) {
        this.logger.warn(
          `Supplier ${supplierId} has no Stripe Connect account — skipping transfer`,
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
          metadata: { orderId, supplierId },
        });
      } catch (err) {
        this.logger.error(
          `Supplier transfer failed for order ${orderId} supplier ${supplierId}: ${(err as Error).message}`,
        );
        throw err;
      }
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

    // Notify sellers that their payout has been triggered
    const sellerUserIds = await this.prisma.user.findMany({
      where: {
        companyId: { in: supplierIds },
        company: { isNot: null },
      },
      select: { id: true },
    });
    if (sellerUserIds.length > 0) {
      this.notifications
        .createForMany(
          sellerUserIds.map((u) => u.id),
          {
            type: NotificationType.PAYMENT_RECEIVED,
            title: 'Maksājums saņemts',
            message: `Līdzekļi par pasūtījumu #${orderId.slice(-6).toUpperCase()} ir izmaksāti uz jūsu Stripe kontu.`,
            data: { orderId },
          },
        )
        .catch(() => null);
    }

    // Notify driver that the job is fully closed and their payout is en route
    const driverUserId = deliveredJob?.driver?.id;
    if (driverUserId && driverCents > 0) {
      this.notifications
        .create({
          userId: driverUserId,
          type: NotificationType.TRANSPORT_COMPLETED,
          title: 'Darbs pabeigts — izmaksa ceļā',
          message: `Piegāde ir apstiprināta. Jūsu atalgojums tiek pārskaitīts uz jūsu Stripe kontu.`,
          data: { orderId },
        })
        .catch(() => null);
    }
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
      throw new BadRequestException(
        `Stripe webhook signature invalid: ${(err as Error).message}`,
      );
    }

    switch (event.type) {
      // Buyer authorized the payment (card held, not yet captured)
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'AUTHORIZED' },
            })
            .catch((err) => this.logger.error(`Webhook DB sync failed for payment on order ${orderId}`, err));
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'AUTHORIZED' },
            })
            .catch((err) => this.logger.error(`Webhook DB sync failed for order ${orderId} paymentStatus AUTHORIZED`, err));
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'CAPTURED' },
            })
            .catch((err) => this.logger.error(`Webhook DB sync failed for payment on order ${orderId}`, err));
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'CAPTURED' },
            })
            .catch((err) => this.logger.error(`Webhook DB sync failed for order ${orderId} paymentStatus CAPTURED`, err));
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'FAILED' },
            })
            .catch((err) => this.logger.error(`Webhook DB sync failed for payment on order ${orderId}`, err));
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'FAILED' },
            })
            .catch((err) => this.logger.error(`Webhook DB sync failed for order ${orderId} paymentStatus FAILED`, err));
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
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
              .catch((err) => this.logger.error(`Webhook DB sync failed for payment ${payment.id} REFUNDED`, err));
            await this.prisma.order
              .update({
                where: { id: payment.orderId },
                data: { paymentStatus: 'REFUNDED' },
              })
              .catch((err) => this.logger.error(`Webhook DB sync failed for order ${payment.orderId} paymentStatus REFUNDED`, err));
          }
        }
        break;
      }

      // Stripe externally cancelled the PaymentIntent (e.g. bank / 3DS / expired authorization)
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          // Only update if the order is still in a pre-capture state — don't clobber COMPLETED/CANCELLED by other paths
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true, paymentStatus: true },
          });
          if (order && !['COMPLETED', 'CANCELLED'].includes(order.status)) {
            await this.prisma.$transaction([
              this.prisma.payment.update({
                where: { orderId },
                data: { status: PaymentStatus.FAILED },
              }),
              this.prisma.order.update({
                where: { id: orderId },
                data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
              }),
            ]).catch((err) =>
              this.logger.error(`payment_intent.canceled: failed to cancel order ${orderId}`, err),
            );
            this.logger.warn(`payment_intent.canceled: order ${orderId} cancelled by Stripe`);
          }
        }
        break;
      }

      // Stripe Connect account status changed (e.g. seller restricted by Stripe compliance)
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;

        if (!chargesEnabled || !payoutsEnabled) {
          this.logger.warn(
            `Stripe Connect account ${account.id} restricted — charges_enabled: ${chargesEnabled}, payouts_enabled: ${payoutsEnabled}`,
          );
          // Find the company whose Connect account this is
          const company = await this.prisma.company.findFirst({
            where: { stripeConnectId: account.id },
            select: { id: true, name: true },
          });
          // Notify all admins
          const admins = await this.prisma.user.findMany({
            where: { userType: 'ADMIN' },
            select: { id: true },
          });
          if (admins.length > 0) {
            await this.notifications
              .createForMany(
                admins.map((a) => a.id),
                {
                  type: NotificationType.SYSTEM_ALERT,
                  title: 'Stripe account restricted',
                  message: `Stripe Connect account ${account.id}${company ? ` (${company.name})` : ''} has been restricted. charges_enabled=${chargesEnabled}, payouts_enabled=${payoutsEnabled}`,
                  data: { accountId: account.id, companyId: company?.id ?? null },
                },
              )
              .catch((err) =>
                this.logger.error(`account.updated: failed to notify admins`, err),
              );
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
      select: {
        id: true,
        orderNumber: true,
        buyerId: true,
        createdById: true,
        status: true,
        internalNotes: true,
      },
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

    // Mark order as IN_PROGRESS (dispute hold) so it cannot be auto-completed
    // and releaseFunds cannot be triggered while the dispute is open
    await this.prisma.order.update({
      where: { id: orderId },
      data: { internalNotes: updatedNotes, status: 'IN_PROGRESS' },
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

    this.logger.log(
      `Dispute filed for order ${order.orderNumber} by user ${user.userId}`,
    );

    return {
      ok: true,
      message:
        'Sūdzība saņemta. Mēs sazināsimies ar jums 1-2 darba dienu laikā.',
    };
  }

  /**
   * Admin resolves an open dispute.
   *
   * resolution === 'release' → dispute rejected — funds go to supplier/driver.
   *   Advances order to COMPLETED and fires releaseFunds().
   *
   * resolution === 'refund' → dispute upheld — buyer gets their money back.
   *   Issues a full Stripe refund and marks order CANCELLED.
   */
  async resolveDispute(
    orderId: string,
    resolution: 'release' | 'refund',
    adminNote: string | undefined,
    admin: RequestingUser,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdById: true,
        internalNotes: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    // Allow resolving disputes on DELIVERED or IN_PROGRESS (dispute hold) orders
    if (order.status !== 'DELIVERED' && order.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Dispute can only be resolved on DELIVERED or IN_PROGRESS (disputed) orders',
      );
    }

    const noteEntry =
      `[DISPUTE RESOLVED ${new Date().toISOString()}] Admin: ${admin.userId} ` +
      `Resolution: ${resolution.toUpperCase()}` +
      (adminNote ? ` — ${adminNote}` : '');

    const updatedNotes = order.internalNotes
      ? `${order.internalNotes}\n\n${noteEntry}`
      : noteEntry;

    if (resolution === 'release') {
      // Reject dispute — release funds to seller/driver
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', internalNotes: updatedNotes },
      });
      await this.releaseFunds(orderId);
      this.logger.log(
        `Dispute RELEASED for order ${order.orderNumber} by admin ${admin.userId}`,
      );
      // Notify buyer
      this.notifications
        .create({
          userId: order.createdById,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Sūdzība izskatīta',
          message: `Jūsu sūdzība par pasūtījumu #${order.orderNumber} ir izskatīta. Piegāde apstiprināta.`,
          data: { orderId },
        })
        .catch(() => null);
    } else {
      // Uphold dispute — refund buyer, cancel order
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', internalNotes: updatedNotes },
      });
      await this.voidOrRefund(orderId);
      this.logger.log(
        `Dispute REFUNDED for order ${order.orderNumber} by admin ${admin.userId}`,
      );
      // Notify buyer
      this.notifications
        .create({
          userId: order.createdById,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Atmaksa apstiprināta',
          message: `Jūsu sūdzība par pasūtījumu #${order.orderNumber} ir apstiprināta. Atmaksa tiks apstrādāta 5-10 darba dienu laikā.`,
          data: { orderId },
        })
        .catch(() => null);
    }

    return { ok: true, resolution };
  }
}
