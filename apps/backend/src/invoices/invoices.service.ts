import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

function mapPaymentStatus(ps: PaymentStatus): InvoiceStatus {
  switch (ps) {
    case PaymentStatus.PAID: return 'PAID';
    case PaymentStatus.FAILED: return 'OVERDUE';
    case PaymentStatus.REFUNDED: return 'CANCELLED';
    default: return 'ISSUED'; // PENDING, PARTIALLY_PAID
  }
}

function mapInvoice(inv: any) {
  return {
    ...inv,
    status: mapPaymentStatus(inv.paymentStatus),
    vatAmount: inv.tax,
    issuedAt: inv.createdAt?.toISOString?.() ?? inv.createdAt ?? null,
    paidAt: inv.paidDate?.toISOString?.() ?? inv.paidDate ?? null,
  };
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get invoices visible to the requesting user.
   * A user can see invoices for orders where they are the buyer.
   */
  async getMyInvoices(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = {
      order: {
        buyerId: userId,
      },
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

  async getById(invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        order: { buyerId: userId },
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

  async getByOrder(orderId: string, userId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        orderId,
        order: { buyerId: userId },
      },
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(mapInvoice);
  }

  async markAsPaid(invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, order: { buyerId: userId } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    this.logger.log(`Invoice ${invoiceId} marked as paid by user ${userId}`);
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidDate: new Date(),
      },
    });
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
}
