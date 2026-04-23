/**
 * Invoices service.
 * Generates and tracks invoices for material orders and transport jobs.
 * Supports payment-status updates (pending → paid), PDF generation,
 * invoice email delivery, and filtered queries by buyer/supplier/carrier.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import { PaymentsService } from '../payments/payments.service';

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    order: {
      select: {
        id: true;
        orderNumber: true;
        orderType: true;
        status: true;
        deliveryAddress: true;
        deliveryCity: true;
      };
    };
  };
}>;

type InvoiceWithRelationsExtended = Prisma.InvoiceGetPayload<{
  include: {
    order: {
      select: {
        id: true;
        orderNumber: true;
        orderType: true;
        status: true;
        deliveryAddress: true;
        deliveryCity: true;
      };
    };
    advanceForContract: {
      select: { id: true; contractNumber: true; title: true };
    };
  };
}>;

function computePaymentStatus(
  ps: PaymentStatus,
  dueDate: Date,
): 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' {
  if (ps === PaymentStatus.PAID) return 'PAID';
  if (ps === PaymentStatus.REFUNDED) return 'CANCELLED';
  // Any unpaid invoice past its due date is OVERDUE
  if (
    (ps === PaymentStatus.PENDING ||
      ps === PaymentStatus.FAILED ||
      ps === PaymentStatus.PARTIALLY_PAID) &&
    dueDate < new Date()
  )
    return 'OVERDUE';
  return 'PENDING';
}

function mapPaymentStatus(ps: PaymentStatus): InvoiceStatus {
  switch (ps) {
    case PaymentStatus.PAID:
      return 'PAID';
    case PaymentStatus.REFUNDED:
      return 'CANCELLED';
    default:
      return 'ISSUED';
  }
}

function mapInvoice(inv: InvoiceWithRelations) {
  const status = mapPaymentStatus(inv.paymentStatus);
  const paymentStatus = computePaymentStatus(inv.paymentStatus, inv.dueDate);
  return {
    ...inv,
    paymentStatus,
    status,
    vatAmount: inv.tax,
    issuedAt: inv.createdAt.toISOString(),
    paidAt: inv.paidDate?.toISOString() ?? null,
  };
}

function mapInvoiceExtended(inv: InvoiceWithRelationsExtended) {
  const status = mapPaymentStatus(inv.paymentStatus);
  const paymentStatus = computePaymentStatus(inv.paymentStatus, inv.dueDate);
  return {
    ...inv,
    paymentStatus,
    status,
    vatAmount: inv.tax,
    issuedAt: inv.createdAt.toISOString(),
    paidAt: inv.paidDate?.toISOString() ?? null,
    // B3 Fields: non-null when this is an advance invoice
    advanceForContract: inv.advanceForContract ?? null,
  };
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private stripe?: Stripe;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private notifications: NotificationsService,
    private configService: ConfigService,
    private payments: PaymentsService,
  ) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
    }
  }

  private buyerAccess(
    userId: string,
    companyId?: string,
  ): Prisma.OrderWhereInput {
    return {
      OR: [
        ...(companyId ? [{ buyerId: companyId }] : []),
        { createdById: userId },
      ],
    };
  }

  /**
   * Get invoices visible to the requesting user.
   * Includes both order-based invoices and B3 Fields advance invoices.
   */
  async getMyInvoices(
    userId: string,
    companyId?: string,
    page = 1,
    limit = 20,
    updatedSince?: string,
    status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED',
    projectId?: string,
  ) {
    const skip = (page - 1) * limit;
    const sinceFilter = updatedSince
      ? { updatedAt: { gte: new Date(updatedSince) } }
      : {};
    const now = new Date();

    // Translate the UI status filter into a Prisma where clause
    let statusFilter: Prisma.InvoiceWhereInput = {};
    if (status === 'PAID') {
      statusFilter = { paymentStatus: PaymentStatus.PAID };
    } else if (status === 'CANCELLED') {
      statusFilter = { paymentStatus: PaymentStatus.REFUNDED };
    } else if (status === 'OVERDUE') {
      statusFilter = {
        paymentStatus: {
          in: [
            PaymentStatus.PENDING,
            PaymentStatus.FAILED,
            PaymentStatus.PARTIALLY_PAID,
          ],
        },
        dueDate: { lt: now },
      };
    } else if (status === 'PENDING') {
      statusFilter = {
        paymentStatus: {
          in: [
            PaymentStatus.PENDING,
            PaymentStatus.AUTHORIZED,
            PaymentStatus.CAPTURED,
          ],
        },
        dueDate: { gte: now },
      };
    }

    // Order-based invoices (existing)
    const orderWhere = {
      order: {
        ...this.buyerAccess(userId, companyId),
        ...(projectId ? { projectId } : {}),
      },
      ...sinceFilter,
      ...statusFilter,
    };

    // Advance invoices for B3 Fields (new — buyer company scoped)
    // Not project-scoped, so excluded when projectId filter is active
    const advanceWhere: Prisma.InvoiceWhereInput | null =
      !projectId && companyId
        ? {
            buyerCompanyId: companyId,
            advanceForContractId: { not: null },
            ...sinceFilter,
            ...statusFilter,
          }
        : null;

    const combinedWhere: Prisma.InvoiceWhereInput = advanceWhere
      ? { OR: [orderWhere, advanceWhere] }
      : orderWhere;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: combinedWhere,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              status: true,
            },
          },
          advanceForContract: {
            select: {
              id: true,
              contractNumber: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where: combinedWhere }),
    ]);
    return {
      data: invoices.map(mapInvoiceExtended),
      meta: { page, limit, total },
    };
  }

  async getById(invoiceId: string, userId: string, companyId?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        order: this.buyerAccess(userId, companyId),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            deliveryAddress: true,
            deliveryCity: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return mapInvoice(invoice);
  }

  async getByOrder(orderId: string, userId: string, companyId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        orderId,
        order: this.buyerAccess(userId, companyId),
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(mapInvoice);
  }

  /** Export all user invoices as a UTF-8 CSV string (for accounts payable / accounting). */
  async exportCsv(userId: string, companyId?: string): Promise<string> {
    const invoices = await this.prisma.invoice.findMany({
      where: { order: this.buyerAccess(userId, companyId) },
      include: {
        order: {
          select: {
            orderNumber: true,
            deliveryAddress: true,
            deliveryCity: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const escape = (v: string | null | undefined) => {
      if (v == null) return '';
      const str = String(v);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const headers = [
      'Rēķina numurs',
      'Pasūtījuma numurs',
      'Datums',
      'Apmaksas termiņš',
      'Apmaksas datums',
      'Statuss',
      'Starpsumma (EUR)',
      'PVN (EUR)',
      'Kopā (EUR)',
      'Piegādes adrese',
      'Pilsēta',
    ];

    const rows = invoices.map((inv) => [
      escape(inv.invoiceNumber),
      escape(inv.order?.orderNumber),
      escape(inv.createdAt.toISOString().slice(0, 10)),
      escape(inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null),
      escape(inv.paidDate ? inv.paidDate.toISOString().slice(0, 10) : null),
      escape(inv.paymentStatus),
      escape(inv.subtotal != null ? Number(inv.subtotal).toFixed(2) : null),
      escape(inv.tax != null ? Number(inv.tax).toFixed(2) : null),
      escape(inv.total != null ? Number(inv.total).toFixed(2) : null),
      escape(inv.order?.deliveryAddress),
      escape(inv.order?.deliveryCity),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  async markAsPaid(
    invoiceId: string,
    userId: string,
    companyId?: string,
    isAdmin = false,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: isAdmin
        ? { id: invoiceId }
        : { id: invoiceId, order: this.buyerAccess(userId, companyId) },
      select: {
        id: true,
        orderId: true,
        paymentStatus: true,
        total: true,
        order: { select: { createdById: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // Guard: reject payment on a cancelled order to prevent double credit release.
    // cancel() already decremented creditUsed; marking the invoice PAID would
    // decrement it again, building a permanent negative balance.
    if (invoice.orderId) await this.assertOrderNotCancelled(invoice.orderId);
    // Idempotency — already paid, return without side-effects
    if (invoice.paymentStatus === PaymentStatus.PAID) {
      return this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    }
    this.logger.log(`Invoice ${invoiceId} marked as paid by user ${userId}`);
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidDate: new Date(),
      },
    });
    if (invoice.orderId) {
      await this.prisma.order.update({
        where: { id: invoice.orderId },
        data: { paymentStatus: PaymentStatus.PAID },
      });

      // If the order is already COMPLETED (auto-complete ran before buyer paid),
      // trigger the payout now — funds were deferred because the invoice wasn't
      // PAID yet when releaseFunds() first fired.
      const order = await this.prisma.order.findUnique({
        where: { id: invoice.orderId },
        select: { status: true },
      });
      if (order?.status === OrderStatus.COMPLETED) {
        this.payments
          .releaseFunds(invoice.orderId)
          .catch((err) =>
            this.logger.error(
              `markAsPaid: releaseFunds failed after late payment on order ${invoice.orderId}: ${(err as Error).message}`,
            ),
          );
      }
    }

    // Release the credit that was reserved when the order was placed.
    // Symmetric to the increment in orders.service.ts create() — without this
    // a buyer who pays all their invoices will permanently exhaust their credit line.
    // Use GREATEST(0, ...) to guard against going negative on concurrent calls
    // (matches the same pattern used in orders.service.ts cancel/complete paths).
    const buyerUserId = invoice.order?.createdById;
    if (invoice.total && buyerUserId) {
      this.prisma.$executeRaw`
          UPDATE buyer_profiles
          SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(invoice.total)})
          WHERE "userId" = ${buyerUserId}
        `.catch((err) =>
        this.logger.error(
          `Failed to release credit for buyer ${buyerUserId} on invoice payment ${invoiceId}`,
          err,
        ),
      );
    }

    return updatedInvoice;
  }

  /** Admin/internal: get all unpaid invoices */
  async getUnpaid() {
    return this.prisma.invoice.findMany({
      where: { paymentStatus: PaymentStatus.PENDING },
      include: {
        order: {
          select: { orderNumber: true, buyerId: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Generate a PDF buffer for the given invoice.
   * Fetches full invoice + order details from DB, then renders a simple branded PDF.
   */
  async generatePdf(
    invoiceId: string,
    userId: string,
    companyId?: string,
  ): Promise<Buffer> {
    const raw = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        order: this.buyerAccess(userId, companyId),
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            deliveryAddress: true,
            deliveryCity: true,
            project: { select: { name: true } },
          },
        },
      },
    });
    if (!raw) throw new NotFoundException('Invoice not found');

    return this.buildPdf(raw);
  }

  /** Build a PDF buffer from an invoice record (no auth check — caller must verify). */
  private buildPdf(
    inv: Prisma.InvoiceGetPayload<{
      include: {
        order: {
          select: {
            orderNumber: true;
            deliveryAddress: true;
            deliveryCity: true;
            project: { select: { name: true } };
          };
        };
      };
    }>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = inv.currency ?? 'EUR';
      const invoiceNumber =
        inv.invoiceNumber ?? inv.id.slice(0, 8).toUpperCase();
      const issuedAt = inv.createdAt.toLocaleDateString('lv-LV');
      const dueDate = inv.dueDate
        ? inv.dueDate.toLocaleDateString('lv-LV')
        : '—';
      const total = Number(inv.total ?? 0);
      const subtotal = Number(inv.subtotal ?? total);
      const tax = Number(inv.tax ?? 0);
      const address = [inv.order?.deliveryAddress, inv.order?.deliveryCity]
        .filter(Boolean)
        .join(', ');
      const projectName: string | null =
        (inv.order as { project?: { name?: string } | null } | null | undefined)
          ?.project?.name ?? null;

      // ── Header ────────────────────────────────────────────────────────────
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('B3Hub', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text('b3hub.lv  |  support@b3hub.lv', 50, 76);

      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor('#111827')
        .text('RĒĶINS', 0, 50, { align: 'right' });

      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#6b7280')
        .text(`#${invoiceNumber}`, 0, 84, { align: 'right' });

      // ── Divider ───────────────────────────────────────────────────────────
      doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e5e7eb').stroke();

      // ── Dates & order ref ─────────────────────────────────────────────────
      doc.fillColor('#111827').fontSize(10).font('Helvetica');
      const metaY = 125;
      doc.text('Izrakstīts:', 50, metaY).text(issuedAt, 180, metaY);
      doc
        .text('Apmaksas termiņš:', 50, metaY + 18)
        .text(dueDate, 180, metaY + 18);
      doc
        .text('Pasūtījums:', 50, metaY + 36)
        .text(`#${inv.order?.orderNumber ?? '—'}`, 180, metaY + 36);
      if (address) {
        doc
          .text('Piegādes adrese:', 50, metaY + 54)
          .text(address, 180, metaY + 54);
      }
      if (projectName) {
        const projectY = address ? metaY + 72 : metaY + 54;
        doc.text('Projekts:', 50, projectY).text(projectName, 180, projectY);
      }

      // ── Totals table ──────────────────────────────────────────────────────
      const tableY =
        address && projectName ? 238 : address || projectName ? 220 : 200;
      doc
        .moveTo(50, tableY)
        .lineTo(545, tableY)
        .strokeColor('#e5e7eb')
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#374151')
        .text('Apraksts', 50, tableY + 10)
        .text('Summa', 0, tableY + 10, { align: 'right' });

      doc
        .moveTo(50, tableY + 28)
        .lineTo(545, tableY + 28)
        .strokeColor('#e5e7eb')
        .stroke();

      doc
        .font('Helvetica')
        .fillColor('#111827')
        .text('Pakalpojumi', 50, tableY + 38)
        .text(`${currency} ${subtotal.toFixed(2)}`, 0, tableY + 38, {
          align: 'right',
        });

      doc
        .text('PVN (21%)', 50, tableY + 58)
        .text(`${currency} ${tax.toFixed(2)}`, 0, tableY + 58, {
          align: 'right',
        });

      doc
        .moveTo(50, tableY + 80)
        .lineTo(545, tableY + 80)
        .strokeColor('#111827')
        .lineWidth(1)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('KOPĀ', 50, tableY + 92)
        .text(`${currency} ${total.toFixed(2)}`, 0, tableY + 92, {
          align: 'right',
        });

      // ── Footer ────────────────────────────────────────────────────────────
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#9ca3af')
        .text(
          'B3Hub SIA  |  Rīga, Latvija  |  support@b3hub.lv  |  b3hub.lv',
          50,
          750,
          { align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Generate PDF and email it to the buyer.
   * Called after an invoice is issued/confirmed.
   */
  async emailInvoice(
    invoiceId: string,
    recipientEmail: string,
    recipientName: string,
  ): Promise<void> {
    const raw = await this.prisma.invoice.findFirst({
      where: { id: invoiceId },
      include: {
        order: {
          select: {
            orderNumber: true,
            deliveryAddress: true,
            deliveryCity: true,
            project: { select: { name: true } },
          },
        },
      },
    });
    if (!raw) {
      this.logger.warn(`emailInvoice: invoice ${invoiceId} not found`);
      return;
    }

    const pdfBuffer = await this.buildPdf(raw);
    const invoiceNumber = raw.invoiceNumber ?? raw.id.slice(0, 8).toUpperCase();
    const dueDate = raw.dueDate ?? new Date(Date.now() + 14 * 86400_000);

    await this.emailService.sendInvoice(
      recipientEmail,
      recipientName,
      {
        invoiceNumber,
        total: Number(raw.total ?? 0),
        currency: raw.currency ?? 'EUR',
        dueDate,
        orderNumber: raw.order?.orderNumber ?? '—',
      },
      pdfBuffer,
    );
  }

  /**
   * Create an invoice for a newly-confirmed order and email it to the buyer.
   * Shared by OrdersService (direct orders) and QuoteRequestsService (RFQ orders)
   * so both paths produce identical invoice output.
   *
   * @param order  The minimal order shape needed to build the invoice
   * @param buyerUserId  `User.id` of the buyer (createdById) — used for payment terms lookup + email
   */
  async createForOrder(
    order: {
      id: string;
      subtotal: number;
      tax: number;
      total: number;
      currency: string;
    },
    buyerUserId: string,
    paymentMethod?: PaymentMethod,
  ): Promise<void> {
    const invoiceNumber = this.generateInvoiceNumber();

    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId: buyerUserId },
      select: { paymentTerms: true },
    });
    const dueDate = this.parseDueDateFromTerms(buyerProfile?.paymentTerms);

    const inv = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        orderId: order.id,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
        dueDate,
        paymentStatus: PaymentStatus.PENDING,
      },
      select: { id: true },
    });

    this.logger.log(`Invoice ${invoiceNumber} created for order ${order.id}`);

    // For INVOICE-method orders: generate a Stripe Payment Link so the buyer
    // can pay online by card or bank transfer without a stored card.
    if (paymentMethod === PaymentMethod.INVOICE && this.stripe) {
      this.generateStripePaymentLink(inv.id, order).catch((err) =>
        this.logger.warn(
          `Payment Link generation failed for invoice ${inv.id}: ${(err as Error).message}`,
        ),
      );
    }

    // Auto-email the invoice PDF to the buyer (fire-and-forget, non-fatal)
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (buyer?.email) {
      this.emailInvoice(
        inv.id,
        buyer.email,
        [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') ||
          buyer.email,
      ).catch((err) =>
        this.logger.warn(
          `Auto-email invoice ${inv.id} failed: ${(err as Error).message}`,
        ),
      );
    }
  }

  /**
   * Create an invoice for a framework contract call-off (TransportJob).
   * Call-offs don't have an Order record; the invoice is linked directly to the job.
   * Payment Link is always generated since framework buyers typically have NET terms.
   */
  async createForCallOff(job: {
    id: string;
    jobNumber: string;
    rate: number;
    currency: string;
    requestedById: string;
  }): Promise<void> {
    const invoiceNumber = this.generateInvoiceNumber();

    const buyerProfile = job.requestedById
      ? await this.prisma.buyerProfile.findUnique({
          where: { userId: job.requestedById },
          select: { paymentTerms: true },
        })
      : null;
    const dueDate = this.parseDueDateFromTerms(buyerProfile?.paymentTerms);

    const subtotal = job.rate;
    const VAT_RATE = 0.21;
    const tax = subtotal * VAT_RATE;
    const total = subtotal + tax;

    const inv = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        transportJobId: job.id,
        subtotal,
        tax,
        total,
        currency: job.currency ?? 'EUR',
        dueDate,
        paymentStatus: PaymentStatus.PENDING,
      },
      select: { id: true },
    });

    this.logger.log(
      `Invoice ${invoiceNumber} created for call-off job ${job.id}`,
    );

    // Generate a Stripe Payment Link for online payment
    if (this.stripe) {
      this.generateStripePaymentLink(inv.id, {
        id: job.id,
        total,
        currency: job.currency ?? 'EUR',
        transportJobId: job.id,
      }).catch((err) =>
        this.logger.warn(
          `Payment Link generation failed for call-off invoice ${inv.id}: ${(err as Error).message}`,
        ),
      );
    }

    // Email the invoice to the buyer
    if (job.requestedById) {
      const buyer = await this.prisma.user.findUnique({
        where: { id: job.requestedById },
        select: { email: true, firstName: true, lastName: true },
      });
      if (buyer?.email) {
        this.emailInvoice(
          inv.id,
          buyer.email,
          [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') ||
            buyer.email,
        ).catch((err) =>
          this.logger.warn(
            `Auto-email call-off invoice ${inv.id} failed: ${(err as Error).message}`,
          ),
        );
      }
    }
  }

  /**
   * Generate a Stripe Payment Link for an invoice and store the URL.
   * Buyers with NET terms can click this link to pay by card or bank transfer
   * without being prompted at original checkout.
   */
  private async generateStripePaymentLink(
    invoiceId: string,
    order: {
      id: string;
      total: number;
      currency: string;
      transportJobId?: string;
    },
  ): Promise<void> {
    if (!this.stripe) return;

    const amountCents = Math.round(order.total * 100);
    const currency = order.currency.toLowerCase();

    // Create a one-time stripe.Price then attach it to a PaymentLink
    const price = await this.stripe.prices.create({
      currency,
      unit_amount: amountCents,
      product_data: {
        name: order.transportJobId
          ? `B3Hub Invoice — Job ${order.id.slice(-8).toUpperCase()}`
          : `B3Hub Invoice — Order ${order.id.slice(-8).toUpperCase()}`,
        metadata: order.transportJobId
          ? { transportJobId: order.transportJobId, invoiceId }
          : { orderId: order.id, invoiceId },
      },
    });

    const link = await this.stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: order.transportJobId
        ? { invoiceId, transportJobId: order.transportJobId }
        : { invoiceId, orderId: order.id },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${this.configService.get<string>('WEB_URL') ?? 'https://b3hub.lv'}/dashboard/invoices?paid=1&invoiceId=${invoiceId}`,
        },
      },
    });

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        stripePaymentLinkId: link.id,
        stripePaymentLinkUrl: link.url,
      },
    });

    this.logger.log(
      `Payment Link created for invoice ${invoiceId}: ${link.url}`,
    );
  }

  /**
   * Guard used by markAsPaid: rejects payment attempts on invoices whose
   * linked order is already CANCELLED (prevents double credit-release when
   * cancel() and markAsPaid() are both called on the same order).
   */
  async assertOrderNotCancelled(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (order?.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot mark invoice as paid: linked order is cancelled.',
      );
    }
  }

  private parseDueDateFromTerms(paymentTerms?: string | null): Date {
    const now = new Date();
    if (!paymentTerms || paymentTerms === 'COD') return now;
    const match = paymentTerms.match(/NET(\d+)/i);
    if (match) {
      const days = parseInt(match[1], 10);
      return new Date(now.getTime() + days * 86_400_000);
    }
    return new Date(now.getTime() + 30 * 86_400_000);
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `INV${year}${month}${ms}${rand}`;
  }

  /**
   * Runs daily at 08:00.
   * 1. Marks PENDING invoices whose dueDate has passed as FAILED (→ OVERDUE in UI).
   *    Notifies the buyer in-app and by email.
   * 2. Sends a 3-day-before reminder email to buyers with invoices due soon.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async markOverdueInvoices(): Promise<void> {
    await withCronLock(
      this.prisma,
      'markOverdueInvoices',
      async () => {
        const now = new Date();
        const threeDaysFromNow = new Date(
          now.getTime() + 3 * 24 * 60 * 60 * 1000,
        );

        // ── 1. Flip overdue ───────────────────────────────────────────────────────
        const overdue = await this.prisma.invoice.findMany({
          where: {
            paymentStatus: PaymentStatus.PENDING,
            dueDate: { lt: now },
            order: { status: { notIn: [OrderStatus.CANCELLED] } },
          },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            dueDate: true,
            orderId: true,
            order: { select: { orderNumber: true, createdById: true } },
          },
        });

        for (const inv of overdue) {
          await this.prisma.invoice
            .update({
              where: { id: inv.id },
              data: { paymentStatus: PaymentStatus.FAILED },
            })
            .catch((err) =>
              this.logger.error(
                `markOverdue: failed to flip invoice ${inv.id}: ${(err as Error).message}`,
              ),
            );

          const buyerId = inv.order?.createdById;
          if (buyerId) {
            await this.notifications
              .create({
                userId: buyerId,
                type: NotificationType.INVOICE_OVERDUE,
                title: 'Rēķins ir nokavēts',
                message: `Rēķins #${inv.invoiceNumber} par pasūtījumu #${inv.order?.orderNumber} ir nokavēts. Lūdzu, samaksājiet pēc iespējas ātrāk.`,
                data: { invoiceId: inv.id, orderId: inv.orderId },
              })
              .catch((err) =>
                this.logger.warn(
                  'Notification (invoice overdue) failed',
                  (err as Error).message,
                ),
              );

            const buyer = await this.prisma.user.findUnique({
              where: { id: buyerId },
              select: { email: true, firstName: true, lastName: true },
            });
            if (buyer?.email) {
              const daysLate = Math.floor(
                (now.getTime() - (inv.dueDate?.getTime() ?? now.getTime())) /
                  86_400_000,
              );
              this.emailService
                .sendInvoiceOverdue(
                  buyer.email,
                  [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') ||
                    buyer.email,
                  {
                    invoiceNumber:
                      inv.invoiceNumber ?? inv.id.slice(0, 8).toUpperCase(),
                    total: Number(inv.total ?? 0),
                    daysLate,
                    orderId: inv.orderId ?? '',
                  },
                )
                .catch((err) =>
                  this.logger.warn(
                    `markOverdue: email failed for invoice ${inv.id}: ${(err as Error).message}`,
                  ),
                );
            }
          }

          this.logger.log(
            `markOverdueInvoices: invoice ${inv.invoiceNumber} marked OVERDUE`,
          );
        }

        // ── 2. 3-day reminder ─────────────────────────────────────────────────────
        const dueSoon = await this.prisma.invoice.findMany({
          where: {
            paymentStatus: PaymentStatus.PENDING,
            dueDate: { gte: now, lte: threeDaysFromNow },
            order: { status: { notIn: [OrderStatus.CANCELLED] } },
          },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            dueDate: true,
            orderId: true,
            order: { select: { orderNumber: true, createdById: true } },
          },
        });

        for (const inv of dueSoon) {
          const buyerId = inv.order?.createdById;
          if (!buyerId) continue;

          const buyer = await this.prisma.user.findUnique({
            where: { id: buyerId },
            select: { email: true, firstName: true, lastName: true },
          });
          if (!buyer?.email) continue;

          const daysUntilDue = Math.ceil(
            ((inv.dueDate?.getTime() ?? now.getTime()) - now.getTime()) /
              86_400_000,
          );
          this.emailService
            .sendInvoiceReminder(
              buyer.email,
              [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') ||
                buyer.email,
              {
                invoiceNumber:
                  inv.invoiceNumber ?? inv.id.slice(0, 8).toUpperCase(),
                total: Number(inv.total ?? 0),
                dueDate: inv.dueDate ?? new Date(),
                daysUntilDue,
                orderId: inv.orderId ?? '',
              },
            )
            .catch((err) =>
              this.logger.warn(
                `dueSoonReminder: email failed for invoice ${inv.id}: ${(err as Error).message}`,
              ),
            );
        }

        if (overdue.length > 0 || dueSoon.length > 0) {
          this.logger.log(
            `markOverdueInvoices: ${overdue.length} marked overdue, ${dueSoon.length} reminders sent`,
          );
        }
      },
      this.logger,
    );
  }
}
