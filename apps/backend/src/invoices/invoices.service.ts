/**
 * Invoices service.
 * Generates and tracks invoices for material orders and transport jobs.
 * Supports payment-status updates (pending → paid), PDF generation,
 * invoice email delivery, and filtered queries by buyer/supplier/carrier.
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';

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

function mapPaymentStatus(ps: PaymentStatus): InvoiceStatus {
  switch (ps) {
    case PaymentStatus.PAID:
      return 'PAID';
    case PaymentStatus.FAILED:
      return 'OVERDUE';
    case PaymentStatus.REFUNDED:
      return 'CANCELLED';
    default:
      return 'ISSUED'; // PENDING, PARTIALLY_PAID
  }
}

function mapInvoice(inv: InvoiceWithRelations) {
  const status = mapPaymentStatus(inv.paymentStatus);
  // Normalize to the frontend PaymentStatus union: PENDING | PAID | OVERDUE | CANCELLED
  const paymentStatus =
    status === 'PAID'
      ? 'PAID'
      : status === 'OVERDUE'
        ? 'OVERDUE'
        : status === 'CANCELLED'
          ? 'CANCELLED'
          : 'PENDING'; // ISSUED → PENDING
  return {
    ...inv,
    paymentStatus, // override raw DB enum with normalised frontend value
    status,
    vatAmount: inv.tax,
    issuedAt: inv.createdAt.toISOString(),
    paidAt: inv.paidDate?.toISOString() ?? null,
  };
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

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
   * A user can see invoices for orders where they are the buyer.
   */
  async getMyInvoices(
    userId: string,
    companyId?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      order: this.buyerAccess(userId, companyId),
    };
    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data: invoices.map(mapInvoice), meta: { page, limit, total } };
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

  async markAsPaid(invoiceId: string, userId: string, companyId?: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, order: this.buyerAccess(userId, companyId) },
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
    const [updatedInvoice] = await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidDate: new Date(),
        },
      }),
      this.prisma.order.update({
        where: { id: invoice.orderId },
        data: { paymentStatus: PaymentStatus.PAID },
      }),
    ]);

    // Release the credit that was reserved when the order was placed.
    // Symmetric to the increment in orders.service.ts create() — without this
    // a buyer who pays all their invoices will permanently exhaust their credit line.
    const buyerUserId = invoice.order?.createdById;
    if (invoice.total && buyerUserId) {
      this.prisma.buyerProfile
        .update({
          where: { userId: buyerUserId },
          data: { creditUsed: { decrement: Number(invoice.total) } },
        })
        .catch((err) =>
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

      // ── Totals table ──────────────────────────────────────────────────────
      const tableY = address ? 220 : 200;
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

    // Auto-email the invoice PDF to the buyer (fire-and-forget, non-fatal)
    const buyer = await this.prisma.user.findUnique({
      where: { id: buyerUserId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (buyer?.email) {
      this.emailInvoice(
        inv.id,
        buyer.email,
        [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') || buyer.email,
      ).catch((err) =>
        this.logger.warn(`Auto-email invoice ${inv.id} failed: ${(err as Error).message}`),
      );
    }
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
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `INV${year}${month}${ms}${rand}`;
  }
}
