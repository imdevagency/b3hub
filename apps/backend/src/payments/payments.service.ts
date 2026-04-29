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
import {
  DisputeReason,
  DisputeStatus,
  PaymentStatus,
  SkipHireStatus,
} from '@prisma/client';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { PayseraService, PayseraWebhookPayload } from '../paysera/paysera.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notifications: NotificationsService,
    private paysera: PayseraService,
  ) {}

  /**
   * Create a Paysera checkout for an Order.
   * Returns a redirect URL the buyer follows to complete payment.
   */
  async createPaymentIntent(orderId: string, user: RequestingUser) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.createdById !== user.userId && user.userType !== 'ADMIN') {
      throw new ForbiddenException('Not authorized to pay for this order');
    }

    // Prevent overwriting an already-captured or released payment (double-charge guard)
    const existingPayment = await this.prisma.payment.findUnique({
      where: { orderId },
      select: { status: true, payseraOrderId: true, payseraPaymentUrl: true },
    });
    if (
      existingPayment &&
      ['CAPTURED', 'RELEASED', 'REFUNDED'].includes(existingPayment.status)
    ) {
      throw new BadRequestException(
        `Payment is already ${existingPayment.status} for this order`,
      );
    }

    // Idempotency: return existing payment URL if already created
    if (existingPayment?.payseraOrderId && existingPayment.payseraPaymentUrl) {
      return {
        paymentUrl: existingPayment.payseraPaymentUrl,
        payseraOrderId: existingPayment.payseraOrderId,
      };
    }

    const amountCents = Math.round(order.total * 100);
    const baseUrl = this.configService.get<string>('APP_BASE_URL') ?? 'https://b3hub.app';

    const checkout = await this.paysera.createCheckout({
      reference: order.orderNumber,
      amountCents,
      currency: order.currency,
      successUrl: `${baseUrl}/order/${orderId}/payment-success`,
      failureUrl: `${baseUrl}/order/${orderId}/payment-failed`,
      callbackUrl: `${this.configService.get('API_URL') ?? 'https://api.b3hub.app'}/api/v1/payments/webhook`,
      name: `Pasūtījums ${order.orderNumber}`,
    });

    await this.prisma.payment.upsert({
      where: { orderId },
      create: {
        orderId,
        payseraOrderId: checkout.payseraOrderId,
        payseraPaymentUrl: checkout.paymentUrl,
        amount: order.total,
        currency: order.currency,
        status: 'PENDING',
      },
      update: {
        payseraOrderId: checkout.payseraOrderId,
        payseraPaymentUrl: checkout.paymentUrl,
        amount: order.total,
        currency: order.currency,
        status: 'PENDING',
      },
    });

    return {
      paymentUrl: checkout.paymentUrl,
      payseraOrderId: checkout.payseraOrderId,
    };
  }

  /**
   * Return payout setup information for a seller/carrier.
   * With Paysera, payouts are made via IBAN bank transfer — no Connect onboarding needed.
   * The supplier/driver simply provides their IBAN in their profile.
   */
  async getPayoutSetupInfo(user: RequestingUser) {
    const companyId = user.companyId;

    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { ibanNumber: true, payoutEnabled: true, name: true },
      });
      return {
        type: 'COMPANY',
        ibanNumber: company?.ibanNumber ?? null,
        payoutEnabled: company?.payoutEnabled ?? false,
        instructions:
          'Lai saņemtu maksājumus, lūdzu norādiet sava uzņēmuma IBAN kontu profila iestatījumos.',
      };
    }

    if (user.canTransport) {
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { ibanNumber: true, payoutEnabled: true },
      });
      return {
        type: 'DRIVER',
        ibanNumber: driverProfile?.ibanNumber ?? null,
        payoutEnabled: driverProfile?.payoutEnabled ?? false,
        instructions:
          'Lai saņemtu izmaksas, lūdzu norādiet savu IBAN kontu vadītāja profila iestatījumos.',
      };
    }

    throw new BadRequestException(
      'User must belong to a company or be an approved driver to receive payouts',
    );
  }

  // Keep alias for backward-compatible controller calls
  async createConnectAccountLink(user: RequestingUser) {
    return this.getPayoutSetupInfo(user);
  }

  /**
   * Create a Paysera checkout for a skip-hire order.
   * Returns a redirect URL the buyer follows to complete payment.
   */
  async createSkipHirePaymentIntent(skipOrderId: string) {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id: skipOrderId },
    });
    if (!order) throw new BadRequestException('Skip-hire order not found');

    // Idempotency
    if (order.payseraOrderId && order.payseraPaymentUrl) {
      return {
        paymentUrl: order.payseraPaymentUrl,
        payseraOrderId: order.payseraOrderId,
      };
    }

    const amountCents = Math.round(order.price * 100);
    const baseUrl = this.configService.get<string>('APP_BASE_URL') ?? 'https://b3hub.app';

    const checkout = await this.paysera.createCheckout({
      reference: order.orderNumber,
      amountCents,
      currency: order.currency,
      successUrl: `${baseUrl}/skip-hire/${skipOrderId}/payment-success`,
      failureUrl: `${baseUrl}/skip-hire/${skipOrderId}/payment-failed`,
      callbackUrl: `${this.configService.get('API_URL') ?? 'https://api.b3hub.app'}/api/v1/payments/webhook`,
      name: `Konteinera noma ${order.orderNumber}`,
    });

    await this.prisma.skipHireOrder.update({
      where: { id: skipOrderId },
      data: {
        payseraOrderId: checkout.payseraOrderId,
        payseraPaymentUrl: checkout.paymentUrl,
        paymentStatus: 'PENDING',
      },
    });

    return {
      paymentUrl: checkout.paymentUrl,
      payseraOrderId: checkout.payseraOrderId,
    };
  }

  /**
   * @deprecated Paysera payments are immediate — no capture step required.
   * This method is a no-op kept for backward compatibility with controller routes.
   */
  async capturePayment(_orderId: string): Promise<void> {
    this.logger.warn(
      'capturePayment() called — no-op with Paysera (payment confirmed via webhook)',
    );
  }

  /**
   * Void or refund payment when an order is cancelled.
   * With Paysera, all paid orders require a refund (no pre-capture void).
   * Non-fatal by design — a failed refund call should NOT block order cancellation.
   */
  async voidOrRefund(orderId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment?.payseraOrderId) {
      // Buyer never completed checkout — nothing to refund
      return;
    }

    if (payment.status === 'RELEASED') {
      // Funds already transferred; needs manual admin intervention
      this.logger.error(
        `voidOrRefund: order ${orderId} payment already RELEASED — manual refund required.`,
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

    if (payment.status === 'REFUNDED') return;

    try {
      await this.paysera.refundOrder({
        payseraOrderId: payment.payseraOrderId,
        amountCents: Math.round(payment.amount * 100),
        currency: payment.currency,
      });
      await this.prisma.payment.update({
        where: { orderId },
        data: { status: PaymentStatus.REFUNDED },
      });
      this.logger.log(`Order ${orderId} — payment refunded via Paysera`);
    } catch (err) {
      this.logger.error(
        `voidOrRefund failed for order ${orderId}: ${(err as Error).message}`,
      );
      // Non-fatal — cancellation proceeds regardless; finance team reconciles manually
    }
  }

  /**
   * Release funds (record SupplierPayout / CarrierPayout obligations) when order is COMPLETED.
   * Platform retains commission; remainder split to suppliers and driver.
   * Actual IBAN transfers are executed separately (batch settlement).
   */
  async releaseFunds(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });

    if (!payment) {
      // INVOICE / SEPA orders never create a Payment record
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
              },
            },
            carrier: {
              select: { carrierCommissionRate: true },
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

    if (!order) throw new BadRequestException('Order not found');

    const surchargeTotal = order.surcharges.reduce(
      (s, c) => s + Number(c.amount),
      0,
    );
    const totalCents = Math.round((Number(order.total) + surchargeTotal) * 100);

    // ── Per-supplier commission ──────────────────────────────────────────────
    const supplierIds = [
      ...new Set(order.items.map((i) => i.material.supplier.id)),
    ];
    const supplierPayoutMap = new Map<string, number>(); // supplierId → net payout cents
    let materialFeeCents = 0;
    for (const sid of supplierIds) {
      const supplierItems = order.items.filter(
        (i) => i.material.supplier.id === sid,
      );
      const supplierSubtotalCents = Math.round(
        supplierItems.reduce((s, i) => s + Number(i.total), 0) * 100,
      );
      const rate =
        (supplierItems[0].material.supplier.commissionRate ?? 6) / 100;
      const feeCents = Math.round(supplierSubtotalCents * rate);
      materialFeeCents += feeCents;
      supplierPayoutMap.set(sid, supplierSubtotalCents - feeCents);
    }

    // ── Transport commission ─────────────────────────────────────────────────
    const deliveredJob = order.transportJobs?.[0];
    const deliveryCents = Math.round(Number(order.deliveryFee) * 100);
    const carrierJobRecord = deliveredJob as
      | (typeof deliveredJob & { carrier?: { carrierCommissionRate?: number | null } | null })
      | null
      | undefined;
    const carrierRate =
      (carrierJobRecord?.carrier?.carrierCommissionRate ?? 8) / 100;
    const transportFeeCents =
      deliveredJob && deliveryCents > 0
        ? Math.round(deliveryCents * carrierRate)
        : 0;

    const platformFeeCents = materialFeeCents + transportFeeCents;
    const payoutCents = totalCents - platformFeeCents;

    // ── Driver payout ────────────────────────────────────────────────────────
    let driverCents = 0;
    if (deliveredJob) {
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
        const actualTonnes = job.actualWeightKg / 1000;
        driverCents = Math.round(job.pricePerTonne * actualTonnes * 100);
      } else if (job.rate && job.rate > 0) {
        driverCents = Math.round(job.rate * 100);
      } else {
        driverCents = Math.max(0, deliveryCents - transportFeeCents);
        this.logger.warn(
          `releaseFunds: transport job ${deliveredJob.id} has no rate/pricePerTonne — falling back to full delivery pool for order ${orderId}`,
        );
      }
      driverCents = Math.min(driverCents, Math.max(0, deliveryCents - transportFeeCents));
    }
    const sellerCents = payoutCents - driverCents;

    const dueDate = new Date(Date.now() + 30 * 86_400_000); // NET-30

    // ── Record SupplierPayout obligations ────────────────────────────────────
    for (const supplierId of supplierIds) {
      const amountCents = supplierPayoutMap.get(supplierId) ?? 0;
      if (amountCents <= 0) continue;
      await this.prisma.supplierPayout.create({
        data: {
          orderId,
          supplierId,
          amount: amountCents / 100,
          currency: order.currency ?? 'EUR',
          dueDate,
        },
      });
    }

    // ── Record CarrierPayout obligation ──────────────────────────────────────
    if (driverCents > 0 && deliveredJob) {
      await this.prisma.carrierPayout.create({
        data: {
          orderId,
          jobId: deliveredJob.id,
          driverId: deliveredJob.driverId ?? undefined,
          carrierId: deliveredJob.driver?.companyId ?? undefined,
          amount: driverCents / 100,
          currency: order.currency ?? 'EUR',
          dueDate,
        },
      });
    }

    // Mark payment as released
    await this.prisma.payment.update({
      where: { orderId },
      data: {
        status: 'RELEASED',
        platformFee: platformFeeCents / 100,
        sellerPayout: sellerCents / 100,
        driverPayout: driverCents / 100,
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'RELEASED' },
    });

    // ── Commission invoices ──────────────────────────────────────────────────
    this.generateCommissionInvoices(orderId, supplierIds, supplierPayoutMap).catch(
      (err) =>
        this.logger.warn(
          `Commission invoice generation failed for order ${orderId}: ${(err as Error).message}`,
        ),
    );

    // Notify sellers
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
            message: `Pasūtījums #${orderId.slice(-6).toUpperCase()} pabeigts. Jūsu maksājums ir apstrādāts.`,
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
          title: 'Darbs pabeigts',
          message: `Piegāde apstiprināta. Jūsu atalgojums ir apstrādāts.`,
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
   * Records SupplierPayout / CarrierPayout obligations; actual IBAN transfers
   * are executed in a separate settlement batch.
   * Called from releaseFunds() when no Payment record is found.
   */
  private async releaseInvoiceOrderFunds(orderId: string): Promise<void> {
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

    let driverCents = 0;
    if (deliveredJob) {
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

    const supplierIds = [
      ...new Set(order.items.map((i) => i.material.supplier.id)),
    ];
    const perSupplierCents = Math.round(
      sellerCents / (supplierIds.length || 1),
    );

    const dueDate = new Date(Date.now() + 30 * 86_400_000); // NET-30

    // ── Record SupplierPayout obligations ────────────────────────────────────
    for (const supplierId of supplierIds) {
      if (perSupplierCents <= 0) continue;
      await this.prisma.supplierPayout.create({
        data: {
          orderId,
          supplierId,
          amount: perSupplierCents / 100,
          currency: order.currency ?? 'EUR',
          dueDate,
        },
      });
    }

    // ── Record CarrierPayout obligation ──────────────────────────────────────
    if (driverCents > 0 && deliveredJob) {
      await this.prisma.carrierPayout.create({
        data: {
          orderId,
          jobId: deliveredJob.id,
          driverId: deliveredJob.driverId ?? undefined,
          carrierId: deliveredJob.driver?.companyId ?? undefined,
          amount: driverCents / 100,
          currency: order.currency ?? 'EUR',
          dueDate,
        },
      });
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'RELEASED' },
    });

    this.logger.log(
      `releaseInvoiceOrderFunds: payout obligations recorded for order ${orderId} — supplier €${(sellerCents / 100).toFixed(2)}, carrier €${(driverCents / 100).toFixed(2)}, B3Hub margin €${(platformFeeCents / 100).toFixed(2)}`,
    );

    // Notify supplier(s)
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
            message: `Pasūtījums #${orderId.slice(-6).toUpperCase()} apmaksāts. Jūsu maksājums ir apstrādāts.`,
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
          title: 'Darbs pabeigts',
          message: `Piegāde apstiprināta. Jūsu atalgojums ir apstrādāts.`,
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
   * Record a CarrierPayout for a standalone disposal or freight transport job.
   * Called when the buyer pays the invoice (webhook `order.paid` with transportJobId).
   */
  async releaseFundsForJob(jobId: string): Promise<void> {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      include: {
        driver: {
          select: {
            id: true,
            companyId: true,
            company: {
              select: { commissionRate: true },
            },
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

    const dueDate = new Date(Date.now() + 30 * 86_400_000); // NET-30

    await this.prisma.carrierPayout.create({
      data: {
        orderId: job.orderId ?? undefined,
        jobId: job.id,
        driverId: job.driverId,
        carrierId: job.driver?.companyId ?? undefined,
        amount: driverCents / 100,
        currency: invoice.currency,
        dueDate,
      },
    });

    this.logger.log(
      `releaseFundsForJob: CarrierPayout €${(driverCents / 100).toFixed(2)} recorded for driver ${job.driverId}, job ${jobId}`,
    );

    // Notify the driver
    this.notifications
      .create({
        userId: job.driverId,
        type: NotificationType.TRANSPORT_COMPLETED,
        title: 'Darbs pabeigts — izmaksa ceļā',
        message: `Pasūtītājs ir apmaksājis darbu ${job.jobNumber}. Jūsu atalgojums tiks pārskaitīts uz jūsu bankas kontu.`,
        data: { jobId },
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Notification dispatch failed: ${(err as Error).message}`,
        ),
      );
  }

  /**
   * Handle Paysera webhook events.
   * Verifies HMAC-SHA256 signature and processes `order.paid` events.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    let payload: PayseraWebhookPayload;
    try {
      payload = this.paysera.parseWebhook(rawBody, signature);
    } catch (err) {
      throw new BadRequestException(
        `Paysera webhook signature invalid: ${(err as Error).message}`,
      );
    }

    const { event, order: payseraOrder } = payload;

    this.logger.log(
      `Paysera webhook: event=${event.name}, reference=${payseraOrder.reference}, status=${payseraOrder.status}`,
    );

    switch (event.name) {
      case 'order.paid': {
        // Find our order by reference (= orderNumber)
        const order = await this.prisma.order.findFirst({
          where: { orderNumber: payseraOrder.reference },
          select: { id: true, orderNumber: true, status: true, createdById: true },
        });

        if (order) {
          await this.prisma.payment
            .update({
              where: { orderId: order.id },
              data: { status: PaymentStatus.CAPTURED },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for payment on order ${order.id}`,
                err,
              ),
            );
          await this.prisma.order
            .update({
              where: { id: order.id },
              data: { paymentStatus: PaymentStatus.CAPTURED },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook DB sync failed for order ${order.id} paymentStatus CAPTURED`,
                err,
              ),
            );
          break;
        }

        // Check if it's a skip-hire order reference
        const skipOrder = await this.prisma.skipHireOrder.findFirst({
          where: { orderNumber: payseraOrder.reference },
          select: { id: true, orderNumber: true, carrierId: true, location: true, deliveryDate: true, skipSize: true },
        });

        if (skipOrder) {
          const confirmedSkip = await this.prisma.skipHireOrder
            .update({
              where: { id: skipOrder.id },
              data: {
                paymentStatus: PaymentStatus.CAPTURED,
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
                `Webhook: failed to confirm skip-hire order ${skipOrder.id}`,
                err,
              );
              return null;
            });

          if (confirmedSkip?.carrierId) {
            const carrierUsers = await this.prisma.user
              .findMany({
                where: { companyId: confirmedSkip.carrierId },
                select: { id: true },
              })
              .catch((err: unknown) => {
                this.logger.warn(
                  `Webhook: failed to fetch carrier users for skip order ${confirmedSkip.id}: ${(err as Error).message}`,
                );
                return [] as { id: string }[];
              });

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
          break;
        }

        // Check if it's a guest order reference
        const guestOrder = await this.prisma.guestOrder.findFirst({
          where: { orderNumber: payseraOrder.reference },
          select: { id: true, orderNumber: true },
        });

        if (guestOrder) {
          await this.prisma.guestOrder
            .update({
              where: { id: guestOrder.id },
              data: {
                paymentStatus: 'PAID',
                status: 'CONTACTED',
              },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook: failed to mark guest order ${guestOrder.id} as paid`,
                (err as Error).message,
              ),
            );
          this.logger.log(
            `Guest order ${guestOrder.id} marked PAID via Paysera webhook`,
          );
          break;
        }

        // Check if reference is an invoice number
        const paidInvoice = await this.prisma.invoice.findFirst({
          where: { invoiceNumber: payseraOrder.reference },
          select: { id: true, orderId: true, transportJobId: true },
        });

        if (paidInvoice) {
          await this.prisma.invoice
            .update({
              where: { id: paidInvoice.id },
              data: { paymentStatus: PaymentStatus.PAID, paidDate: new Date() },
            })
            .catch((err) =>
              this.logger.error(
                `Webhook: failed to mark invoice ${paidInvoice.id} PAID`,
                err,
              ),
            );

          if (paidInvoice.orderId) {
            await this.prisma.order
              .update({
                where: { id: paidInvoice.orderId },
                data: { paymentStatus: PaymentStatus.PAID },
              })
              .catch((err) =>
                this.logger.error(
                  `Webhook: failed to update order ${paidInvoice.orderId} paymentStatus`,
                  err,
                ),
              );

            const completedOrder = await this.prisma.order.findUnique({
              where: { id: paidInvoice.orderId },
              select: { status: true },
            });
            if (completedOrder?.status === 'COMPLETED') {
              this.releaseInvoiceOrderFunds(paidInvoice.orderId).catch((err) =>
                this.logger.error(
                  `Late releaseInvoiceOrderFunds failed for order ${paidInvoice.orderId}: ${(err as Error).message}`,
                ),
              );
            }
          } else if (paidInvoice.transportJobId) {
            this.releaseFundsForJob(paidInvoice.transportJobId).catch((err) =>
              this.logger.error(
                `releaseFundsForJob failed for job ${paidInvoice.transportJobId}: ${(err as Error).message}`,
              ),
            );
          }
          break;
        }

        this.logger.warn(
          `Paysera webhook order.paid: no matching order for reference "${payseraOrder.reference}"`,
        );
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
   * @deprecated Paysera has no pre-authorization expiry. No-op cron kept for
   * scheduler registration compatibility.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async warnExpiringAuthorizations(): Promise<void> {
    // No-op: Paysera payments are immediate — no authorization expiry to warn about.
  }

  /**
   * @deprecated No-op with Paysera — payment amounts cannot be updated after
   * checkout creation. Apply surcharges as a separate invoice.
   */
  async updatePaymentIntentAmount(
    _orderId: string,
    _newTotal: number,
  ): Promise<void> {
    this.logger.warn(
      'updatePaymentIntentAmount() called — no-op with Paysera. Issue a supplementary invoice for surcharges.',
    );
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

      // Check IBAN payout status
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { ibanNumber: true, payoutEnabled: true },
      });
      const payoutStatus: 'NOT_CONFIGURED' | 'ACTIVE' = company?.ibanNumber
        ? 'ACTIVE'
        : 'NOT_CONFIGURED';

      return {
        type: 'COMPANY',
        totalEarned,
        pendingAmount,
        payoutStatus,
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

      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId: user.userId },
        select: { ibanNumber: true, payoutEnabled: true },
      });
      const payoutStatus: 'NOT_CONFIGURED' | 'ACTIVE' = driverProfile?.ibanNumber
        ? 'ACTIVE'
        : 'NOT_CONFIGURED';

      return {
        type: 'DRIVER',
        totalEarned,
        pendingAmount: 0, // driver payouts happen at order completion
        payoutStatus,
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
   * @deprecated Stripe Connect balance endpoint removed — Paysera does not support
   * per-account balance retrieval. Returns zeros for backward compatibility.
   */
  async getConnectBalance(_user: RequestingUser): Promise<{
    available: number;
    pending: number;
    currency: string;
    onboarded: boolean;
  }> {
    return { available: 0, pending: 0, currency: 'EUR', onboarded: false };
  }

  /**
   * Record a CarrierPayout once a skip hire order reaches COMPLETED.
   * Platform takes a flat 15% commission; remainder is queued for IBAN settlement.
   */
  async releaseSkipHireFunds(skipOrderId: string): Promise<void> {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id: skipOrderId },
      include: { carrier: { select: { name: true } } },
    });

    if (!order) {
      this.logger.warn(`releaseSkipHireFunds: skip order ${skipOrderId} not found`);
      return;
    }
    if (!order.payseraOrderId) {
      this.logger.warn(
        `releaseSkipHireFunds: skip order ${skipOrderId} has no payseraOrderId — skipping payout`,
      );
      return;
    }
    if (!order.carrierId) {
      this.logger.warn(
        `releaseSkipHireFunds: skip order ${skipOrderId} has no assigned carrier — skipping payout`,
      );
      return;
    }

    const PLATFORM_COMMISSION = 0.15;
    const totalCents = Math.round(order.price * 100);
    const platformFeeCents = Math.round(totalCents * PLATFORM_COMMISSION);
    const payoutCents = totalCents - platformFeeCents;
    const dueDate = new Date(Date.now() + 30 * 86_400_000);

    try {
      await this.prisma.carrierPayout.create({
        data: {
          carrierId: order.carrierId,
          amount: payoutCents / 100,
          currency: order.currency,
          dueDate,
        },
      });
      this.logger.log(
        `releaseSkipHireFunds: CarrierPayout €${(payoutCents / 100).toFixed(2)} recorded for carrier ${order.carrier?.name ?? order.carrierId}, skip order ${order.orderNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `releaseSkipHireFunds: CarrierPayout creation failed for skip order ${skipOrderId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Refund a skip-hire order payment via Paysera.
   * Non-fatal by design — cancellation must not be blocked by a refund failure.
   */
  async refundSkipHireOrder(skipOrderId: string): Promise<void> {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { id: skipOrderId },
      select: { payseraOrderId: true, paymentStatus: true, orderNumber: true, price: true, currency: true },
    });

    if (!order) {
      this.logger.warn(`refundSkipHireOrder: skip order ${skipOrderId} not found`);
      return;
    }

    if (!order.payseraOrderId) {
      // Buyer never completed checkout — nothing to refund
      return;
    }

    if (
      order.paymentStatus === PaymentStatus.REFUNDED ||
      order.paymentStatus === PaymentStatus.RELEASED
    ) {
      return;
    }

    try {
      await this.paysera.refundOrder({
        payseraOrderId: order.payseraOrderId,
        amountCents: Math.round(order.price * 100),
        currency: order.currency,
      });
      await this.prisma.skipHireOrder.update({
        where: { id: skipOrderId },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });
      this.logger.log(
        `refundSkipHireOrder: Paysera refund issued for skip order ${order.orderNumber}`,
      );
    } catch (err) {
      this.logger.error(
        `refundSkipHireOrder failed for skip order ${skipOrderId}: ${(err as Error).message}`,
      );
    }
  }

  // ── Guest checkout (B2C / no-account) ────────────────────────────────────
  /**
   * Create a Paysera checkout for a guest order.
   * Called by admin after quoting a price (quotedAmount must be set on the
   * GuestOrder before calling this). Returns a Paysera payment URL so the
   * guest can complete card payment via the hosted Paysera checkout page.
   */
  async createGuestPaymentIntent(guestOrderId: string) {
    const guestOrder = await this.prisma.guestOrder.findUnique({
      where: { id: guestOrderId },
    });
    if (!guestOrder) throw new BadRequestException('Guest order not found');

    if (!guestOrder.quotedAmount || guestOrder.quotedAmount <= 0) {
      throw new BadRequestException(
        'A quoted price must be set on the guest order before creating a payment link',
      );
    }

    // Idempotency: return existing link if not yet paid
    if (
      guestOrder.payseraOrderId &&
      guestOrder.payseraPaymentUrl &&
      guestOrder.paymentStatus !== 'PAID'
    ) {
      return {
        paymentUrl: guestOrder.payseraPaymentUrl,
        payseraOrderId: guestOrder.payseraOrderId,
      };
    }

    const amountCents = Math.round(guestOrder.quotedAmount * 100);
    const currency = guestOrder.quotedCurrency ?? 'EUR';
    const baseUrl =
      this.configService.get<string>('APP_BASE_URL') ?? 'https://b3hub.app';
    const apiUrl =
      this.configService.get<string>('API_URL') ?? 'https://api.b3hub.app';

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
      where: { id: guestOrderId },
      data: {
        payseraOrderId: checkout.payseraOrderId,
        payseraPaymentUrl: checkout.paymentUrl,
        paymentStatus: 'PENDING',
      },
    });

    this.logger.log(
      `Guest Paysera checkout created for guest order ${guestOrder.orderNumber}`,
    );

    return {
      paymentUrl: checkout.paymentUrl,
      payseraOrderId: checkout.payseraOrderId,
    };
  }

  // ── Path 1: commission invoice generation ─────────────────────────────────

  /**
   * Generate a commission invoice (B3Hub → supplier) for each supplier in an
   * order after funds have been released.
   *
   * The commission invoice documents the platform fee that B3Hub retains,
   * giving the supplier a proper expense record for their bookkeeping.
   *
   * Idempotent: skips suppliers that already have a commission invoice for
   * this order (identified by `commissionForInvoiceId` linkage and
   * `isCommissionInvoice` flag).
   */
  private async generateCommissionInvoices(
    orderId: string,
    supplierIds: string[],
    supplierPayoutMap: Map<string, number>, // supplierId → net payout cents
  ): Promise<void> {
    const VAT_RATE = 0.21;

    // Fetch the supplier-issued invoices already created for this order
    const supplierInvoices = await this.prisma.invoice.findMany({
      where: { orderId, isCommissionInvoice: false, sellerCompanyId: { in: supplierIds } },
      select: { id: true, sellerCompanyId: true, total: true, subtotal: true, currency: true },
    });

    // Fetch order currency as fallback
    const orderCurrency = (
      await this.prisma.order.findUnique({ where: { id: orderId }, select: { currency: true } })
    )?.currency ?? 'EUR';

    // Batch idempotency check — one query instead of N individual findFirst calls.
    const existingCommissions = await this.prisma.invoice.findMany({
      where: { isCommissionInvoice: true, orderId, buyerCompanyId: { in: supplierIds } },
      select: { buyerCompanyId: true },
    });
    const alreadyProcessed = new Set(
      existingCommissions.map((e) => e.buyerCompanyId).filter(Boolean) as string[],
    );

    for (const supplierId of supplierIds) {
      // Idempotency: skip if commission invoice already created for this supplier+order.
      if (alreadyProcessed.has(supplierId)) continue;

      // Find the matching supplier-issued invoice to link against
      const supplierInvoice = supplierInvoices.find(
        (inv) => inv.sellerCompanyId === supplierId,
      );

      // Gross payout = subtotal of supplier invoice (before our commission)
      const grossCents =
        supplierInvoice?.subtotal != null
          ? Math.round(Number(supplierInvoice.subtotal) * 100)
          : (supplierPayoutMap.get(supplierId) ?? 0) +
            Math.round(((supplierPayoutMap.get(supplierId) ?? 0) / (1 - 0.06)) * 0.06);
      const payoutCents = supplierPayoutMap.get(supplierId) ?? 0;
      const feeCentsNet = Math.max(0, grossCents - payoutCents);

      if (feeCentsNet <= 0) continue;

      const subtotal = feeCentsNet / 100;
      const tax = Math.round(subtotal * VAT_RATE * 100) / 100;
      const total = Math.round((subtotal + tax) * 100) / 100;

      const year = new Date().getFullYear().toString().slice(-2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const invoiceNumber = `COM${year}${month}${rand}`;

      const dueDate = new Date(Date.now() + 30 * 86_400_000); // NET-30 to supplier

      await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          orderId,
          isCommissionInvoice: true,
          commissionForInvoiceId: supplierInvoice?.id ?? null,
          buyerCompanyId: supplierId, // supplier is the "buyer" of this commission fee
          // sellerCompanyId = null → B3Hub is issuer
          subtotal,
          tax,
          total,
          currency: supplierInvoice?.currency ?? orderCurrency,
          dueDate,
          paymentStatus: 'PENDING',
        },
      });

      this.logger.log(
        `Commission invoice ${invoiceNumber} (€${total.toFixed(2)}) generated for supplier ${supplierId}, order ${orderId}`,
      );
    }
  }
}
