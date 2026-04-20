import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  DisputeReason,
  DisputeStatus,
  PaymentStatus,
  SkipHireStatus,
} from '@prisma/client';
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
      throw new ForbiddenException('Not authorized to pay for this order');
    }

    // Prevent overwriting an already-captured or released payment (double-charge guard)
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { status: true },
    });
    if (
      existingPayment &&
      ['CAPTURED', 'RELEASED', 'REFUNDED'].includes(existingPayment.status)
    ) {
      throw new BadRequestException(
        `Payment is already ${existingPayment.status} for this order`,
      );
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
      publishableKey: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY'),
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

    const companyId = user.companyId;

    // ── Path A: company-linked seller / carrier ──────────────────────────────
    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
      });
      if (!company) throw new BadRequestException('Company not found');

      let accountId = company.stripeConnectId;
      if (!accountId) {
        const account = await this.stripe.accounts.create({
          type: 'express',
          country: company.country || 'LV',
          email: company.email,
          business_type: 'company',
          capabilities: { transfers: { requested: true } },
        });
        accountId = account.id;
        await this.prisma.company.update({
          where: { id: companyId },
          data: { stripeConnectId: accountId },
        });
      }

      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${this.configService.get('WEB_URL')}/dashboard/supplier/earnings?refresh=true`,
        return_url: `${this.configService.get('WEB_URL')}/dashboard/supplier/earnings?success=true`,
        type: 'account_onboarding',
      });
      return { url: accountLink.url };
    }

    // ── Path B: individual owner-operator driver (no company) ────────────────
    if (!user.canTransport) {
      throw new BadRequestException(
        'User must belong to a company or be an approved driver to receive payouts',
      );
    }

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!driverProfile) {
      throw new BadRequestException(
        'Driver profile not found. Complete driver onboarding first.',
      );
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    let accountId = driverProfile.stripeConnectId;
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'LV',
        email: dbUser?.email ?? undefined,
        business_type: 'individual',
        individual: dbUser
          ? { first_name: dbUser.firstName, last_name: dbUser.lastName }
          : undefined,
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await this.prisma.driverProfile.update({
        where: { userId: user.userId },
        data: { stripeConnectId: accountId },
      });
    }

    const mobileDeepLink = `${this.configService.get('APP_BASE_URL') ?? 'https://b3hub.app'}/driver/earnings`;
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${mobileDeepLink}?refresh=true`,
      return_url: `${mobileDeepLink}?success=true`,
      type: 'account_onboarding',
    });
    return { url: accountLink.url };
  }

  /**
   * Create a Stripe PaymentIntent for a skip-hire order.
   * Uses immediate capture (capture_method: 'automatic') since no seller
   * confirmation step is needed — the carrier is pre-selected at booking time.
   */
  async createSkipHirePaymentIntent(skipOrderId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id: skipOrderId },
    });
    if (!order) throw new BadRequestException('Skip-hire order not found');

    const amountCents = Math.round(order.price * 100);

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: order.currency.toLowerCase(),
      metadata: { skipHireOrderId: order.id, orderNumber: order.orderNumber },
      automatic_payment_methods: { enabled: true },
      capture_method: 'automatic',
    });

    await this.prisma.skipHireOrder.update({
      where: { id: skipOrderId },
      data: { stripePaymentId: paymentIntent.id, paymentStatus: 'PENDING' },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      publishableKey: this.configService.get<string>('STRIPE_PUBLISHABLE_KEY'),
      paymentIntentId: paymentIntent.id,
    };
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
      this.logger.error(
        `voidOrRefund: order ${orderId} payment already RELEASED — manual refund required. Supplier received funds but order is being cancelled.`,
      );
      const admins = await this.prisma.user.findMany({
        where: { userType: 'ADMIN' },
        select: { id: true },
        take: 50,
      });
      if (admins.length > 0) {
        await this.notifications
          .createForMany(
            admins.map((a) => a.id),
            {
              type: NotificationType.SYSTEM_ALERT,
              title: '🚨 Manuāla atmaksa nepieciešama',
              message: `Pasūtījums ${orderId} atcelts, taču maksājums jau ir RELEASED — piegādātājs naudu ir saņēmis. Nepieciešama manuāla atmaksa pircējam.`,
              data: { orderId },
            },
          )
          .catch((e) =>
            this.logger.error(
              `Failed to notify admins of RELEASED cancellation: ${(e as Error).message}`,
            ),
          );
      }
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
        this.logger.log(
          `Order ${orderId} — PaymentIntent cancelled (no charge)`,
        );
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
      // INVOICE / SEPA orders never create a Payment record — they pay via
      // Stripe Payment Link, which funds the platform balance directly.
      // Route to the dedicated invoice-payout path instead of silently returning.
      const orderMethod = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { paymentMethod: true, paymentStatus: true },
      });
      if (
        orderMethod?.paymentMethod === 'INVOICE' ||
        orderMethod?.paymentMethod === 'SEPA'
      ) {
        return this.releaseInvoiceOrderFunds(orderId);
      }
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
                supplier: {
                  select: {
                    id: true,
                    stripeConnectId: true,
                    commissionRate: true,
                  },
                },
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
                driverProfile: { select: { stripeConnectId: true } },
              },
            },
          },
          // Rate fields needed to calculate driver payout
          take: 1,
        },
        surcharges: {
          where: { billable: true },
          select: { amount: true },
        },
      },
    });

    if (!order) throw new BadRequestException('Order not found');

    // Total charged to buyer = base order total + all billable surcharges
    const surchargeTotal = order.surcharges.reduce(
      (s, c) => s + Number(c.amount),
      0,
    );
    const totalCents = Math.round((Number(order.total) + surchargeTotal) * 100);
    // Use the highest commissionRate among suppliers on this order, defaulting to 10%
    const supplierRates = order.items.map(
      (i) => i.material.supplier.commissionRate ?? 10,
    );
    const commissionPct = Math.max(...supplierRates) / 100;
    const platformFeeCents = Math.round(totalCents * commissionPct);
    const payoutCents = totalCents - platformFeeCents;

    // Determine if a driver is involved; prefer company Connect ID, fall back to
    // individual driver profile Connect ID (owner-operators without a company).
    const deliveredJob = order.transportJobs?.[0];
    const driverDriver = deliveredJob?.driver as
      | {
          company?: { stripeConnectId?: string | null } | null;
          driverProfile?: { stripeConnectId?: string | null } | null;
        }
      | null
      | undefined;
    const driverConnectId =
      driverDriver?.company?.stripeConnectId ??
      driverDriver?.driverProfile?.stripeConnectId ??
      null;

    // ── Driver payout — use agreed job rate, not a flat percentage ────────────
    // Priority: pricePerTonne × actualWeight > flat rate > fallback 20% of payoutCents
    let driverCents = 0;
    if (driverConnectId && deliveredJob) {
      const job = deliveredJob as typeof deliveredJob & {
        rate: number;
        pricePerTonne: number | null;
        actualWeightKg: number | null;
      };
      if (
        job.pricePerTonne != null &&
        job.actualWeightKg != null &&
        job.actualWeightKg > 0
      ) {
        // Per-tonne pricing: pricePerTonne × actual tonnes
        const actualTonnes = job.actualWeightKg / 1000;
        driverCents = Math.round(job.pricePerTonne * actualTonnes * 100);
      } else if (job.rate && job.rate > 0) {
        // Flat rate for the whole job
        driverCents = Math.round(job.rate * 100);
      } else {
        // No rate set — fall back to 20% of post-commission payout (legacy behaviour)
        driverCents = Math.round(payoutCents * 0.2);
        this.logger.warn(
          `releaseFunds: transport job ${deliveredJob.id} has no rate/pricePerTonne — falling back to 20% share for order ${orderId}`,
        );
      }
      // Cap driver payout so it never exceeds the post-commission pool
      driverCents = Math.min(driverCents, payoutCents);
    }
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
        this.logger.error(
          `Supplier ${supplierId} has no Stripe Connect account — skipping transfer for order ${orderId}. Manual payout required.`,
        );
        const admins = await this.prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true },
          take: 50,
        });
        if (admins.length > 0) {
          await this.notifications
            .createForMany(
              admins.map((a) => a.id),
              {
                type: NotificationType.SYSTEM_ALERT,
                title: '🚨 Piegādātāja izmaksa izlaista',
                message: `Pasūtījums ${orderId}: piegādātājam ${supplierId} nav Stripe Connect konta. Izmaksa netika veikta — nepieciešama manuāla iejaukšanās.`,
                data: { orderId, supplierId },
              },
            )
            .catch((e) =>
              this.logger.error(
                `Failed to notify admins of skipped payout: ${(e as Error).message}`,
              ),
            );
        }
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
        // Alert admins — driver was not paid, manual transfer needed
        const admins = await this.prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true },
          take: 50,
        });
        if (admins.length > 0) {
          await this.notifications
            .createForMany(
              admins.map((a) => a.id),
              {
                type: NotificationType.SYSTEM_ALERT,
                title: '🚨 Vadītāja izmaksa neizdevās',
                message: `Pasūtījums ${orderId}: vadītāja Stripe izmaksa neizdevās — ${(err as Error).message}. Nepieciešama manuāla izmaksa vadītājam ${deliveredJob?.driverId ?? 'nezināms'}.`,
                data: { orderId, driverId: deliveredJob?.driverId ?? null },
              },
            )
            .catch((notifErr) =>
              this.logger.error(
                `Failed to notify admins of driver transfer failure: ${(notifErr as Error).message}`,
              ),
            );
        }
      }
    } else if (!driverConnectId && driverCents > 0) {
      // Driver has no Stripe Connect account — payout would be silently skipped
      this.logger.error(
        `Driver ${deliveredJob?.driverId} has no Stripe Connect account — skipping driver transfer for order ${orderId}. Manual payout required.`,
      );
      const admins = await this.prisma.user.findMany({
        where: { userType: 'ADMIN' },
        select: { id: true },
        take: 50,
      });
      if (admins.length > 0) {
        await this.notifications
          .createForMany(
            admins.map((a) => a.id),
            {
              type: NotificationType.SYSTEM_ALERT,
              title: '🚨 Vadītāja izmaksa izlaista',
              message: `Pasūtījums ${orderId}: vadītājam ${deliveredJob?.driverId ?? 'nezināms'} nav Stripe Connect konta. Izmaksa netika veikta — nepieciešama manuāla iejaukšanās.`,
              data: { orderId, driverId: deliveredJob?.driverId ?? null },
            },
          )
          .catch((e) =>
            this.logger.error(
              `Failed to notify admins of skipped driver payout: ${(e as Error).message}`,
            ),
          );
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
        .catch((err: unknown) =>
          this.logger.warn(
            `Notification dispatch failed: ${(err as Error).message}`,
          ),
        );
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
        .catch((err: unknown) =>
          this.logger.warn(
            `Notification dispatch failed: ${(err as Error).message}`,
          ),
        );
    }
  }

  /**
   * Release seller and driver payouts for orders paid via INVOICE or SEPA.
   * These orders pay via Stripe Payment Link → funds land in platform balance.
   * We transfer out from that balance (no source_transaction needed).
   * Called from releaseFunds() when no Payment record is found.
   */
  private async releaseInvoiceOrderFunds(orderId: string): Promise<void> {
    if (!this.stripe) return;

    // Guard: already released
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { paymentStatus: true },
    });
    if (existingOrder?.paymentStatus === 'RELEASED') return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        invoices: {
          where: { paymentStatus: PaymentStatus.PAID },
          orderBy: { paidDate: 'desc' },
          take: 1,
        },
        items: {
          include: {
            material: {
              include: {
                supplier: {
                  select: {
                    id: true,
                    stripeConnectId: true,
                    commissionRate: true,
                  },
                },
              },
            },
          },
        },
        transportJobs: {
          where: { status: 'DELIVERED' },
          orderBy: { updatedAt: 'desc' },
          include: {
            driver: {
              select: {
                id: true,
                companyId: true,
                company: { select: { stripeConnectId: true } },
                driverProfile: { select: { stripeConnectId: true } },
              },
            },
          },
          take: 1,
        },
        surcharges: {
          where: { billable: true },
          select: { amount: true },
        },
      },
    });

    if (!order) {
      this.logger.warn(`releaseInvoiceOrderFunds: order ${orderId} not found`);
      return;
    }

    const invoice = order.invoices[0];
    if (!invoice) {
      this.logger.warn(
        `releaseInvoiceOrderFunds: no paid invoice for order ${orderId} — payout deferred until invoice is paid`,
      );
      return;
    }

    // Use invoice total as source of truth; fallback to order total + surcharges
    const surchargeTotal = order.surcharges.reduce(
      (s, c) => s + Number(c.amount),
      0,
    );
    const totalCents = Math.round(
      (invoice.total > 0
        ? invoice.total
        : Number(order.total) + surchargeTotal) * 100,
    );

    const supplierRates = order.items.map(
      (i) => i.material.supplier.commissionRate ?? 10,
    );
    const commissionPct =
      Math.max(...(supplierRates.length ? supplierRates : [10])) / 100;
    const platformFeeCents = Math.round(totalCents * commissionPct);
    const payoutCents = totalCents - platformFeeCents;

    const deliveredJob = order.transportJobs?.[0];
    const driverDriver2 = deliveredJob?.driver as
      | {
          company?: { stripeConnectId?: string | null } | null;
          driverProfile?: { stripeConnectId?: string | null } | null;
        }
      | null
      | undefined;
    const driverConnectId =
      driverDriver2?.company?.stripeConnectId ??
      driverDriver2?.driverProfile?.stripeConnectId ??
      null;

    let driverCents = 0;
    if (driverConnectId && deliveredJob) {
      const job = deliveredJob as typeof deliveredJob & {
        rate: number;
        pricePerTonne: number | null;
        actualWeightKg: number | null;
      };
      if (
        job.pricePerTonne != null &&
        job.actualWeightKg != null &&
        job.actualWeightKg > 0
      ) {
        driverCents = Math.round(
          ((job.pricePerTonne * job.actualWeightKg) / 1000) * 100,
        );
      } else if (job.rate && job.rate > 0) {
        driverCents = Math.round(job.rate * 100);
      } else {
        driverCents = Math.round(payoutCents * 0.2);
        this.logger.warn(
          `releaseInvoiceOrderFunds: job ${deliveredJob.id} has no rate — falling back to 20% for order ${orderId}`,
        );
      }
      driverCents = Math.min(driverCents, payoutCents);
    }
    const sellerCents = payoutCents - driverCents;

    const transferGroup = `order_${orderId}`;
    const currency = order.currency.toLowerCase();

    const supplierIds = [
      ...new Set(order.items.map((i) => i.material.supplier.id)),
    ];
    const perSupplierCents = Math.round(
      sellerCents / (supplierIds.length || 1),
    );

    for (const supplierId of supplierIds) {
      const supplierItem = order.items.find(
        (i) => i.material.supplier.id === supplierId,
      );
      const supplierConnectId = supplierItem?.material.supplier.stripeConnectId;
      if (!supplierConnectId) {
        this.logger.error(
          `releaseInvoiceOrderFunds: supplier ${supplierId} has no Connect account — manual payout required for order ${orderId}`,
        );
        const admins = await this.prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true },
          take: 50,
        });
        if (admins.length > 0) {
          await this.notifications
            .createForMany(
              admins.map((a) => a.id),
              {
                type: NotificationType.SYSTEM_ALERT,
                title: '🚨 Piegādātāja izmaksa izlaista',
                message: `Rēķins pasūtījumam ${orderId}: piegādātājam ${supplierId} nav Stripe Connect konta. Nepieciešama manuāla iejaukšanās.`,
                data: { orderId, supplierId },
              },
            )
            .catch((e) =>
              this.logger.error(
                `Failed to notify admins: ${(e as Error).message}`,
              ),
            );
        }
        continue;
      }
      try {
        await this.stripe.transfers.create({
          amount: perSupplierCents,
          currency,
          destination: supplierConnectId,
          transfer_group: transferGroup,
          metadata: { orderId, supplierId, source: 'invoice' },
        });
      } catch (err) {
        this.logger.error(
          `releaseInvoiceOrderFunds: seller transfer failed for order ${orderId}: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    if (driverConnectId && driverCents > 0) {
      try {
        await this.stripe.transfers.create({
          amount: driverCents,
          currency,
          destination: driverConnectId,
          transfer_group: transferGroup,
          metadata: {
            orderId,
            driverId: deliveredJob?.driverId ?? '',
            source: 'invoice',
          },
        });
      } catch (err) {
        this.logger.error(
          `releaseInvoiceOrderFunds: driver transfer failed for order ${orderId}: ${(err as Error).message}`,
        );
        const admins = await this.prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true },
          take: 50,
        });
        if (admins.length > 0) {
          await this.notifications
            .createForMany(
              admins.map((a) => a.id),
              {
                type: NotificationType.SYSTEM_ALERT,
                title: '🚨 Vadītāja izmaksa neizdevās',
                message: `Rēķins pasūtījumam ${orderId}: vadītāja Stripe izmaksa neizdevās — ${(err as Error).message}. Nepieciešama manuāla izmaksa vadītājam ${deliveredJob?.driverId ?? 'nezināms'}.`,
                data: { orderId, driverId: deliveredJob?.driverId ?? null },
              },
            )
            .catch((notifErr) =>
              this.logger.error(
                `Failed to notify admins: ${(notifErr as Error).message}`,
              ),
            );
        }
      }
    } else if (!driverConnectId && driverCents > 0) {
      this.logger.error(
        `releaseInvoiceOrderFunds: driver ${deliveredJob?.driverId} has no Connect account — skipping driver transfer for order ${orderId}`,
      );
    }

    // Mark the order paymentStatus as RELEASED
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'RELEASED' },
    });

    this.logger.log(
      `releaseInvoiceOrderFunds: payouts complete for order ${orderId} — seller €${(sellerCents / 100).toFixed(2)}, driver €${(driverCents / 100).toFixed(2)}, platform fee €${(platformFeeCents / 100).toFixed(2)}`,
    );

    // Notify seller
    const sellerUserIds = await this.prisma.user.findMany({
      where: { companyId: { in: supplierIds }, company: { isNot: null } },
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
        .catch((err: unknown) =>
          this.logger.warn(
            `Notification dispatch failed: ${(err as Error).message}`,
          ),
        );
    }

    // Notify driver
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
        .catch((err: unknown) =>
          this.logger.warn(
            `Notification dispatch failed: ${(err as Error).message}`,
          ),
        );
    }
  }

  /**
   * Pay the driver for a standalone disposal or freight transport job.
   * Called when the buyer pays the invoice via Stripe Payment Link
   * (checkout.session.completed webhook with transportJobId in metadata).
   *
   * Unlike releaseFunds() for material orders, this does NOT need a PaymentIntent
   * charge ID — the buyer's payment went straight into the platform Stripe balance
   * via a Payment Link, so the transfer draws from the balance directly.
   */
  async releaseFundsForJob(jobId: string): Promise<void> {
    if (!this.stripe) {
      this.logger.error(
        `releaseFundsForJob called for job ${jobId} but Stripe is not configured`,
      );
      return;
    }

    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      include: {
        driver: {
          select: {
            id: true,
            companyId: true,
            company: {
              select: { stripeConnectId: true, commissionRate: true },
            },
            driverProfile: { select: { stripeConnectId: true } },
          },
        },
        invoices: {
          where: { paymentStatus: PaymentStatus.PAID },
          orderBy: { paidDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!job) {
      this.logger.warn(`releaseFundsForJob: job ${jobId} not found`);
      return;
    }

    if (!job.driverId) {
      this.logger.warn(
        `releaseFundsForJob: job ${jobId} has no assigned driver — skipping payout`,
      );
      return;
    }

    const invoice = job.invoices[0];
    if (!invoice) {
      this.logger.warn(
        `releaseFundsForJob: no paid invoice found for job ${jobId} — skipping payout`,
      );
      return;
    }

    const totalCents = Math.round(invoice.total * 100);
    const commissionPct = (job.driver?.company?.commissionRate ?? 10) / 100;
    const platformFeeCents = Math.round(totalCents * commissionPct);
    const driverCents = totalCents - platformFeeCents;

    const driverDriver3 = job.driver as
      | {
          company?: { stripeConnectId?: string | null } | null;
          driverProfile?: { stripeConnectId?: string | null } | null;
        }
      | null
      | undefined;
    const driverConnectId =
      driverDriver3?.company?.stripeConnectId ??
      driverDriver3?.driverProfile?.stripeConnectId ??
      null;

    if (!driverConnectId) {
      this.logger.error(
        `releaseFundsForJob: driver ${job.driverId} has no Stripe Connect account — skipping payout for job ${jobId}. Manual payout required.`,
      );
      const admins = await this.prisma.user.findMany({
        where: { userType: 'ADMIN' },
        select: { id: true },
        take: 50,
      });
      if (admins.length > 0) {
        await this.notifications
          .createForMany(
            admins.map((a) => a.id),
            {
              type: NotificationType.SYSTEM_ALERT,
              title: '🚨 Vadītāja izmaksa izlaista',
              message: `Darbs ${jobId}: vadītājam ${job.driverId} nav Stripe Connect konta. Izmaksa netika veikta — nepieciešama manuāla iejaukšanās.`,
              data: { jobId, driverId: job.driverId },
            },
          )
          .catch((e) =>
            this.logger.error(
              `Failed to notify admins of skipped driver payout: ${(e as Error).message}`,
            ),
          );
      }
      return;
    }

    try {
      await this.stripe.transfers.create({
        amount: driverCents,
        currency: invoice.currency.toLowerCase(),
        destination: driverConnectId,
        metadata: { jobId, invoiceId: invoice.id, driverId: job.driverId },
      });
    } catch (err) {
      this.logger.error(
        `releaseFundsForJob: driver transfer failed for job ${jobId}: ${(err as Error).message}`,
      );
      const admins = await this.prisma.user.findMany({
        where: { userType: 'ADMIN' },
        select: { id: true },
        take: 50,
      });
      if (admins.length > 0) {
        await this.notifications
          .createForMany(
            admins.map((a) => a.id),
            {
              type: NotificationType.SYSTEM_ALERT,
              title: '🚨 Vadītāja izmaksa neizdevās',
              message: `Darbs ${jobId}: vadītāja Stripe izmaksa neizdevās — ${(err as Error).message}. Nepieciešama manuāla izmaksa vadītājam ${job.driverId}.`,
              data: { jobId, driverId: job.driverId },
            },
          )
          .catch((notifErr) =>
            this.logger.error(
              `Failed to notify admins of driver transfer failure: ${(notifErr as Error).message}`,
            ),
          );
      }
      return;
    }

    this.logger.log(
      `releaseFundsForJob: driver payout €${(driverCents / 100).toFixed(2)} sent to ${driverConnectId} for job ${jobId}`,
    );

    // Notify the driver
    this.notifications
      .create({
        userId: job.driverId,
        type: NotificationType.TRANSPORT_COMPLETED,
        title: 'Darbs pabeigts — izmaksa ceļā',
        message: `Pasūtītājs ir apmaksājis darbu ${job.jobNumber}. Jūsu atalgojums tiek pārskaitīts uz jūsu Stripe kontu.`,
        data: { jobId },
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Notification dispatch failed: ${(err as Error).message}`,
        ),
      );
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
      this.logger.error(
        'CRITICAL: Stripe webhook received but STRIPE_WEBHOOK_SECRET is not configured — rejecting so Stripe retries',
      );
      throw new BadRequestException(
        'Webhook processing unavailable — server misconfiguration',
      );
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
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for payment on order ${orderId}`,
                err,
              ),
            );
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'AUTHORIZED' },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for order ${orderId} paymentStatus AUTHORIZED`,
                err,
              ),
            );
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        const skipHireOrderId = pi.metadata?.skipHireOrderId;
        if (orderId) {
          await this.prisma.payment
            .update({
              where: { orderId },
              data: { status: 'CAPTURED' },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for payment on order ${orderId}`,
                err,
              ),
            );
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'CAPTURED' },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for order ${orderId} paymentStatus CAPTURED`,
                err,
              ),
            );
        }
        if (skipHireOrderId) {
          const confirmedSkip = await this.prisma.skipHireOrder
            .update({
              where: { id: skipHireOrderId },
              data: {
                paymentStatus: 'CAPTURED',
                status: SkipHireStatus.CONFIRMED,
              },
              select: {
                id: true,
                orderNumber: true,
                location: true,
                deliveryDate: true,
                skipSize: true,
                carrierId: true,
              },
            })
            .catch((err) => {
              this.logger.error(
                `Webhook: failed to confirm skip-hire order ${skipHireOrderId}`,
                err,
              );
              return null;
            });

          // Notify all users of the assigned carrier company
          if (confirmedSkip?.carrierId) {
            const carrierUsers = await this.prisma.user
              .findMany({
                where: { companyId: confirmedSkip.carrierId },
                select: { id: true },
              })
              .catch(() => [] as { id: string }[]);

            if (carrierUsers.length > 0) {
              const deliveryDay = confirmedSkip.deliveryDate
                .toISOString()
                .split('T')[0];
              this.notifications
                .createForMany(
                  carrierUsers.map((u) => u.id),
                  {
                    type: NotificationType.ORDER_CONFIRMED,
                    title: '📦 Jauns konteinera pasūtījums',
                    message: `Pasūtījums #${confirmedSkip.orderNumber} apmaksāts. Piegāde: ${confirmedSkip.location}, ${deliveryDay}.`,
                    data: { skipOrderId: confirmedSkip.id },
                  },
                )
                .catch((err) =>
                  this.logger.warn(
                    'Notification (skip order confirmed) failed',
                    (err as Error).message,
                  ),
                );
            }
          }
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
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for payment on order ${orderId}`,
                err,
              ),
            );
          await this.prisma.order
            .update({
              where: { id: orderId },
              data: { paymentStatus: 'FAILED' },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for order ${orderId} paymentStatus FAILED`,
                err,
              ),
            );
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
              .catch((err) =>
                this.logger.error(
                  `Webhook DB sync failed for payment ${payment.id} REFUNDED`,
                  err,
                ),
              );
            await this.prisma.order
              .update({
                where: { id: payment.orderId },
                data: { paymentStatus: 'REFUNDED' },
              })
              .catch((err) =>
                this.logger.error(
                  `Webhook DB sync failed for order ${payment.orderId} paymentStatus REFUNDED`,
                  err,
                ),
              );
          }
        }
        break;
      }

      // Stripe externally cancelled the PaymentIntent (e.g. bank / 3DS / expired authorization)
      case 'payment_intent.canceled': {
        const pi = event.data.object;
        const orderId = pi.metadata?.orderId;
        if (orderId) {
          // Only update if the order is still in a pre-capture state — don't clobber COMPLETED/CANCELLED by other paths
          const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: {
              status: true,
              paymentStatus: true,
              createdById: true,
              orderNumber: true,
            },
          });
          if (order && !['COMPLETED', 'CANCELLED'].includes(order.status)) {
            await this.prisma
              .$transaction([
                this.prisma.payment.update({
                  where: { orderId },
                  data: { status: PaymentStatus.FAILED },
                }),
                this.prisma.order.update({
                  where: { id: orderId },
                  data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
                }),
              ])
              .catch((err) =>
                this.logger.error(
                  `payment_intent.canceled: failed to cancel order ${orderId}`,
                  err,
                ),
              );
            this.logger.warn(
              `payment_intent.canceled: order ${orderId} cancelled by Stripe`,
            );

            // Notify the buyer so they know the order was not placed
            if (order.createdById) {
              this.notifications
                .create({
                  userId: order.createdById,
                  type: NotificationType.ORDER_CANCELLED,
                  title: 'Pasūtījums atcelts — maksājuma kļūda',
                  message: `Pasūtījums #${order.orderNumber} tika atcelts, jo banka vai Stripe atcēla maksājuma autorizāciju. Lūdzu, mēģiniet no jauna.`,
                  data: { orderId },
                })
                .catch((err: unknown) =>
                  this.logger.warn(
                    `Notification dispatch failed: ${(err as Error).message}`,
                  ),
                );
            }
          }
        }
        break;
      }

      // Stripe Connect account status changed (e.g. seller restricted by Stripe compliance)
      case 'account.updated': {
        const account = event.data.object;
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
            take: 50,
          });
          if (admins.length > 0) {
            await this.notifications
              .createForMany(
                admins.map((a) => a.id),
                {
                  type: NotificationType.SYSTEM_ALERT,
                  title: 'Stripe account restricted',
                  message: `Stripe Connect account ${account.id}${company ? ` (${company.name})` : ''} has been restricted. charges_enabled=${chargesEnabled}, payouts_enabled=${payoutsEnabled}`,
                  data: {
                    accountId: account.id,
                    companyId: company?.id ?? null,
                  },
                },
              )
              .catch((err) =>
                this.logger.error(
                  `account.updated: failed to notify admins`,
                  err,
                ),
              );
          }
        }
        break;
      }

      // Stripe Payment Link completed — buyer paid their NET-terms invoice online
      case 'checkout.session.completed': {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoiceId;
        const orderId = session.metadata?.orderId;
        const transportJobId = session.metadata?.transportJobId;
        if (invoiceId) {
          await this.prisma.invoice
            .update({
              where: { id: invoiceId },
              data: {
                paymentStatus: PaymentStatus.PAID,
                paidDate: new Date(),
              },
            })
            .catch((err) =>
              this.logger.error(
                `checkout.session.completed: failed to mark invoice ${invoiceId} PAID`,
                err,
              ),
            );
          if (orderId) {
            await this.prisma.order
              .update({
                where: { id: orderId },
                data: { paymentStatus: PaymentStatus.PAID },
              })
              .catch((err) =>
                this.logger.error(
                  `checkout.session.completed: failed to update order ${orderId} paymentStatus`,
                  err,
                ),
              );

            // If the order is already COMPLETED (auto-complete ran before buyer paid),
            // trigger the payout now — it was deferred because the invoice wasn't
            // PAID yet when releaseFunds() first ran.
            const completedOrder = await this.prisma.order.findUnique({
              where: { id: orderId },
              select: { status: true, paymentStatus: true },
            });
            if (completedOrder?.status === 'COMPLETED') {
              this.releaseInvoiceOrderFunds(orderId).catch((err) =>
                this.logger.error(
                  `checkout.session.completed: late releaseInvoiceOrderFunds failed for order ${orderId}: ${(err as Error).message}`,
                ),
              );
            }
          } else if (transportJobId) {
            // Standalone disposal / freight job paid — trigger driver payout
            this.releaseFundsForJob(transportJobId).catch((err) =>
              this.logger.error(
                `releaseFundsForJob failed for job ${transportJobId}: ${(err as Error).message}`,
              ),
            );
          }
          this.logger.log(
            `Payment Link completed: invoice ${invoiceId} marked PAID`,
          );
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
        dispute: { select: { id: true } },
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

    if (order.dispute) {
      throw new BadRequestException('A dispute is already open for this order');
    }

    // Map the incoming reason string to the DisputeReason enum (default OTHER for unknown values)
    const disputeReason: DisputeReason = Object.values(DisputeReason).includes(
      reason as DisputeReason,
    )
      ? (reason as DisputeReason)
      : DisputeReason.OTHER;

    const disputeEntry =
      `[DISPUTE ${new Date().toISOString()}] Reason: ${reason}` +
      (details ? `\nDetails: ${details}` : '');

    const updatedNotes = order.internalNotes
      ? `${order.internalNotes}\n\n${disputeEntry}`
      : disputeEntry;

    // Create a Dispute record + move order to IN_PROGRESS in a transaction
    await this.prisma.$transaction([
      this.prisma.dispute.create({
        data: {
          orderId,
          reason: disputeReason,
          description: details ?? reason,
          status: DisputeStatus.OPEN,
          raisedById: user.userId,
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { internalNotes: updatedNotes, status: 'IN_PROGRESS' },
      }),
    ]);

    // Notify all admin users
    const admins = await this.prisma.user.findMany({
      where: { userType: 'ADMIN' },
      select: { id: true },
      take: 50,
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
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED', internalNotes: updatedNotes },
        }),
        this.prisma.dispute.updateMany({
          where: {
            orderId,
            status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
          },
          data: {
            status: DisputeStatus.REJECTED,
            resolution: adminNote ?? 'Dispute rejected — delivery confirmed.',
            resolvedAt: new Date(),
          },
        }),
      ]);
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
        .catch((err: unknown) =>
          this.logger.warn(
            `Notification dispatch failed: ${(err as Error).message}`,
          ),
        );
    } else {
      // Uphold dispute — refund buyer, cancel order
      await this.prisma.$transaction([
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED', internalNotes: updatedNotes },
        }),
        this.prisma.dispute.updateMany({
          where: {
            orderId,
            status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
          },
          data: {
            status: DisputeStatus.RESOLVED,
            resolution: adminNote ?? 'Dispute upheld — refund issued.',
            resolvedAt: new Date(),
          },
        }),
      ]);
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
        .catch((err: unknown) =>
          this.logger.warn(
            `Notification dispatch failed: ${(err as Error).message}`,
          ),
        );
    }

    return { ok: true, resolution };
  }

  /**
   * Runs every 6 hours. Finds orders that are CONFIRMED with an AUTHORIZED payment
   * whose PaymentIntent is approaching the 7-day Stripe capture window (≥ 6 days old).
   * Notifies the seller to take action before the authorization expires.
   *
   * If an order is older than 7 days (authorization definitely expired) and still
   * in AUTHORIZED status, we log a warning so admins can investigate manually.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async warnExpiringAuthorizations(): Promise<void> {
    await withCronLock(
      this.prisma,
      'warnExpiringAuthorizations',
      async () => {
        if (!this.stripe) return;

        const now = new Date();
        const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Orders confirmed 6+ days ago with payment still only AUTHORIZED (not captured)
        const atRisk = await this.prisma.order.findMany({
          where: {
            status: 'CONFIRMED',
            paymentStatus: PaymentStatus.AUTHORIZED,
            updatedAt: { lte: sixDaysAgo },
          },
          select: {
            id: true,
            orderNumber: true,
            updatedAt: true,
            createdById: true,
            items: {
              select: { material: { select: { supplierId: true } } },
              take: 1,
            },
          },
        });

        for (const order of atRisk) {
          const isExpired = order.updatedAt <= sevenDaysAgo;
          const supplierId = order.items[0]?.material?.supplierId;

          if (isExpired) {
            // Authorization has almost certainly expired — log for admin review
            this.logger.warn(
              `warnExpiringAuthorizations: order ${order.orderNumber} (${order.id}) has an authorization older than 7 days — capture will likely fail`,
            );
          }

          // Notify seller to re-confirm / take action
          if (supplierId) {
            const sellerUsers = await this.prisma.user.findMany({
              where: { companyId: supplierId, canSell: true },
              select: { id: true },
            });
            if (sellerUsers.length > 0) {
              await this.notifications
                .createForMany(
                  sellerUsers.map((u) => u.id),
                  {
                    type: NotificationType.SYSTEM_ALERT,
                    title: isExpired
                      ? '🚨 Maksājuma autorizācija ir beigusies'
                      : '⚠️ Maksājuma autorizācija drīz beigsies',
                    message: isExpired
                      ? `Pasūtījums #${order.orderNumber}: maksājuma autorizācija jau ir beidzies. Sazinieties ar atbalstu.`
                      : `Pasūtījums #${order.orderNumber}: pircēja maksājuma autorizācija beigsies 24 stundu laikā. Apstipriniet pasūtījumu nekavējoties.`,
                    data: { orderId: order.id, isExpired },
                  },
                )
                .catch((err: unknown) =>
                  this.logger.warn(
                    `Notification dispatch failed: ${(err as Error).message}`,
                  ),
                );
            }
          }
        }

        if (atRisk.length > 0) {
          this.logger.warn(
            `warnExpiringAuthorizations: ${atRisk.length} order(s) at risk of expired Stripe authorization`,
          );
        }
      },
      this.logger,
    );
  }

  /**
   * Update the authorized Stripe PaymentIntent amount to match the new order
   * total (base + all billable surcharges). Only valid while the payment is
   * PENDING (intent created, not yet authorized) or AUTHORIZED (held but not
   * yet captured). Throws if the payment is already CAPTURED or RELEASED.
   *
   * @param orderId  the order whose payment should be updated
   * @param newTotal the new total in EUR (float); converted to cents internally
   */
  async updatePaymentIntentAmount(
    orderId: string,
    newTotal: number,
  ): Promise<void> {
    if (!this.stripe) {
      this.logger.warn(
        `updatePaymentIntentAmount: Stripe not configured — skipping for order ${orderId}`,
      );
      return;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment || !payment.stripePaymentId) {
      // No payment intent yet (e.g. buyer hasn't initiated checkout) — nothing to update
      return;
    }

    if (payment.status === 'CAPTURED' || payment.status === 'RELEASED') {
      throw new BadRequestException(
        `Cannot update payment amount: payment for order ${orderId} is already ${payment.status}. ` +
          'Apply surcharges as a separate charge or issue a supplementary invoice.',
      );
    }

    const amountCents = Math.round(newTotal * 100);

    try {
      await this.stripe.paymentIntents.update(payment.stripePaymentId, {
        amount: amountCents,
      });

      // Keep the Payment record in sync
      await this.prisma.payment.update({
        where: { orderId },
        data: { amount: newTotal },
      });
    } catch (error) {
      this.logger.error(
        `updatePaymentIntentAmount: failed to update PI ${payment.stripePaymentId} for order ${orderId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * GET /payments/earnings
   * Returns payout history for the requesting user's company (seller) or
   * individual driver profile. Used by the web earnings dashboard.
   *
   * Returns the last 90 days of RELEASED payments and a running total.
   */
  async getEarnings(user: RequestingUser) {
    const companyId = user.companyId;

    if (companyId) {
      // Seller / carrier company: find all payments for orders where their
      // materials were purchased and the payment is RELEASED.
      const payments = await this.prisma.payment.findMany({
        where: {
          status: { in: ['RELEASED', 'PAID'] },
          order: {
            items: {
              some: { material: { supplierId: companyId } },
            },
          },
          createdAt: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              total: true,
              createdAt: true,
              buyer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalEarned = payments.reduce(
        (sum, p) => sum + (p.sellerPayout ?? 0),
        0,
      );
      const pendingPayments = await this.prisma.payment.findMany({
        where: {
          status: { in: ['CAPTURED', 'AUTHORIZED'] },
          order: { items: { some: { material: { supplierId: companyId } } } },
        },
        select: { sellerPayout: true },
      });
      const pendingAmount = pendingPayments.reduce(
        (sum, p) => sum + (p.sellerPayout ?? 0),
        0,
      );

      // Get Stripe Connect account status
      let stripeStatus: 'NOT_CONNECTED' | 'PENDING' | 'ACTIVE' =
        'NOT_CONNECTED';
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { stripeConnectId: true },
      });
      if (company?.stripeConnectId && this.stripe) {
        try {
          const acct = await this.stripe.accounts.retrieve(
            company.stripeConnectId,
          );
          stripeStatus =
            acct.charges_enabled && acct.payouts_enabled ? 'ACTIVE' : 'PENDING';
        } catch {
          stripeStatus = 'PENDING';
        }
      }

      return {
        type: 'COMPANY',
        totalEarned,
        pendingAmount,
        stripeStatus,
        payments: payments.map((p) => ({
          id: p.id,
          orderNumber: p.order?.orderNumber,
          buyerName: p.order?.buyer?.name,
          grossAmount: p.amount,
          sellerPayout: p.sellerPayout,
          platformFee: p.platformFee,
          currency: p.currency,
          status: p.status,
          date: p.order?.createdAt ?? p.createdAt,
        })),
      };
    }

    // Individual driver (no company): find transport jobs they delivered
    if (user.canTransport) {
      const jobs = await this.prisma.transportJob.findMany({
        where: {
          driverId: user.userId,
          status: 'DELIVERED',
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
        include: {
          order: {
            include: {
              payment: {
                select: { driverPayout: true, status: true, currency: true },
              },
              buyer: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalEarned = jobs.reduce(
        (sum, j) => sum + (j.order?.payment?.driverPayout ?? 0),
        0,
      );

      let stripeStatus: 'NOT_CONNECTED' | 'PENDING' | 'ACTIVE' =
        'NOT_CONNECTED';
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { stripeConnectId: true, payoutEnabled: true },
      });
      if (driverProfile?.stripeConnectId && this.stripe) {
        try {
          const acct = await this.stripe.accounts.retrieve(
            driverProfile.stripeConnectId,
          );
          stripeStatus =
            acct.charges_enabled && acct.payouts_enabled ? 'ACTIVE' : 'PENDING';
        } catch {
          stripeStatus = 'PENDING';
        }
      }

      return {
        type: 'DRIVER',
        totalEarned,
        pendingAmount: 0, // driver payouts happen at order completion
        stripeStatus,
        payments: jobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          buyerName: j.order?.buyer?.name,
          grossAmount: j.rate,
          sellerPayout: null,
          driverPayout: j.order?.payment?.driverPayout ?? null,
          currency: j.order?.payment?.currency ?? j.currency,
          status: j.order?.payment?.status ?? 'PENDING',
          date: j.updatedAt,
        })),
      };
    }

    throw new BadRequestException(
      'You must be a seller (company) or approved driver to view earnings',
    );
  }

  /**
   * GET /payments/balance
   * Returns the Stripe Connect account's available and pending balance for the
   * current user (driver or company). Returns zeros if not yet onboarded.
   */
  async getConnectBalance(user: RequestingUser): Promise<{
    available: number;
    pending: number;
    currency: string;
    onboarded: boolean;
  }> {
    if (!this.stripe) {
      return { available: 0, pending: 0, currency: 'EUR', onboarded: false };
    }

    let accountId: string | null = null;

    if (user.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: user.companyId },
        select: { stripeConnectId: true },
      });
      accountId = company?.stripeConnectId ?? null;
    }

    if (!accountId && user.canTransport) {
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { stripeConnectId: true },
      });
      accountId = driverProfile?.stripeConnectId ?? null;
    }

    if (!accountId) {
      return { available: 0, pending: 0, currency: 'EUR', onboarded: false };
    }

    try {
      const balance = await this.stripe.balance.retrieve(
        {},
        { stripeAccount: accountId },
      );
      const eur = (list: Stripe.Balance.Available[]) =>
        (list.find((b) => b.currency === 'eur')?.amount ?? 0) / 100;
      return {
        available: eur(balance.available),
        pending: eur(balance.pending),
        currency: 'EUR',
        onboarded: true,
      };
    } catch {
      return { available: 0, pending: 0, currency: 'EUR', onboarded: false };
    }
  }

  /**
   * Release funds to the carrier once a skip hire order reaches COMPLETED.
   * Platform takes a flat 15% commission; remainder is transferred to the
   * carrier's Stripe Connect account.
   * Safe to call multiple times — idempotent on stripePayoutId.
   */
  async releaseSkipHireFunds(skipOrderId: string): Promise<void> {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id: skipOrderId },
      include: {
        carrier: { select: { stripeConnectId: true, name: true } },
      },
    });

    if (!order) {
      this.logger.warn(
        `releaseSkipHireFunds: skip order ${skipOrderId} not found`,
      );
      return;
    }
    if (!order.stripePaymentId) {
      this.logger.warn(
        `releaseSkipHireFunds: skip order ${skipOrderId} has no stripePaymentId — manual payout required`,
      );
      return;
    }
    if (!order.carrierId || !order.carrier?.stripeConnectId) {
      this.logger.warn(
        `releaseSkipHireFunds: carrier for skip order ${skipOrderId} has no Stripe Connect account — manual payout required`,
      );
      return;
    }
    if (!this.stripe) {
      this.logger.warn(
        `releaseSkipHireFunds: Stripe not configured — skipping for skip order ${skipOrderId}`,
      );
      return;
    }

    const PLATFORM_COMMISSION = 0.15; // 15%
    const totalCents = Math.round(order.price * 100);
    const platformFeeCents = Math.round(totalCents * PLATFORM_COMMISSION);
    const payoutCents = totalCents - platformFeeCents;

    try {
      await this.stripe.transfers.create({
        amount: payoutCents,
        currency: order.currency.toLowerCase(),
        destination: order.carrier.stripeConnectId,
        source_transaction: order.stripePaymentId,
        metadata: {
          skipHireOrderId: order.id,
          orderNumber: order.orderNumber,
          type: 'skip_hire_payout',
        },
      });
      this.logger.log(
        `releaseSkipHireFunds: transferred ${payoutCents / 100} ${order.currency} to carrier ${order.carrier.name} for skip order ${order.orderNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `releaseSkipHireFunds: Stripe transfer failed for skip order ${skipOrderId}: ${(err as Error).message}`,
      );
      // Non-fatal — log for manual reconciliation rather than crashing the status update
    }
  }

  /**
   * Void or refund payment for a skip-hire order that is being cancelled.
   *
   * Skip-hire orders store `stripePaymentId` directly on the `SkipHireOrder`
   * record (unlike regular orders which use the `Payment` table).
   *
   * - paymentStatus PENDING → buyer's card was never charged (PaymentIntent open
   *   but not completed) → cancel the PaymentIntent.
   * - paymentStatus CAPTURED → buyer was charged → issue a full Stripe refund.
   * - paymentStatus REFUNDED / no stripePaymentId → no-op.
   *
   * Non-fatal by design — a Stripe failure must not block the cancellation.
   */
  async refundSkipHireOrder(skipOrderId: string): Promise<void> {
    if (!this.stripe) {
      this.logger.warn(
        `refundSkipHireOrder: Stripe not configured — skipping for skip order ${skipOrderId}`,
      );
      return;
    }

    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id: skipOrderId },
      select: { stripePaymentId: true, paymentStatus: true, orderNumber: true },
    });

    if (!order) {
      this.logger.warn(
        `refundSkipHireOrder: skip order ${skipOrderId} not found`,
      );
      return;
    }

    if (!order.stripePaymentId) {
      // Buyer never completed checkout — nothing to void
      return;
    }

    if (
      order.paymentStatus === PaymentStatus.REFUNDED ||
      order.paymentStatus === PaymentStatus.RELEASED
    ) {
      return;
    }

    try {
      if (order.paymentStatus === PaymentStatus.CAPTURED) {
        // Funds already captured — issue a full refund
        const pi = await this.stripe.paymentIntents.retrieve(
          order.stripePaymentId,
        );
        const chargeId =
          typeof pi.latest_charge === 'string'
            ? pi.latest_charge
            : (pi.latest_charge?.id ?? null);

        if (chargeId) {
          await this.stripe.refunds.create({ charge: chargeId });
        } else {
          this.logger.warn(
            `refundSkipHireOrder: no charge found on PaymentIntent for skip order ${order.orderNumber}`,
          );
        }
      } else {
        // PENDING (not yet captured) — cancel the PaymentIntent to release the hold
        await this.stripe.paymentIntents.cancel(order.stripePaymentId);
      }

      await this.prisma.skipHireOrder.update({
        where: { id: skipOrderId },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });

      this.logger.log(
        `refundSkipHireOrder: payment voided/refunded for skip order ${order.orderNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `refundSkipHireOrder failed for skip order ${skipOrderId}: ${(err as Error).message}`,
      );
      // Non-fatal — cancellation proceeds; finance team reconciles manually
    }
  }
}
