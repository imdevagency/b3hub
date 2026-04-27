/**
 * PayoutsService — manages B3Hub's principal-model payout obligations.
 *
 * Under the principal model, B3Hub collects the full buyer payment and settles
 * separately with suppliers and carriers on NET-30 terms. This service provides
 * admin tooling to:
 *  - List pending/overdue payout obligations (SupplierPayout + CarrierPayout)
 *  - Mark individual or batch payouts as PAID when IBAN transfers are confirmed
 *  - Cancel payout obligations when orders are refunded
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { PayoutStatus } from '@prisma/client';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { PayseraService } from '../paysera/paysera.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private paysera: PayseraService,
  ) {}

  private requireAdmin(user: RequestingUser): void {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  async listPayouts(
    user: RequestingUser,
    params: {
      status?: PayoutStatus;
      type?: 'supplier' | 'carrier';
      overdue?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ) {
    this.requireAdmin(user);

    const { status, type, overdue, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;
    const now = new Date();

    const statusFilter = status ? { status } : undefined;
    const overdueFilter = overdue
      ? {
          status: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] as PayoutStatus[] },
          dueDate: { lt: now },
        }
      : undefined;

    const where = overdueFilter ?? statusFilter;

    const [supplierPayouts, carrierPayouts, supplierTotal, carrierTotal] =
      await Promise.all([
        type === 'carrier'
          ? Promise.resolve([])
          : this.prisma.supplierPayout.findMany({
              where,
              include: {
                order: { select: { orderNumber: true } },
                supplier: { select: { id: true, name: true, legalName: true, ibanNumber: true } },
              },
              orderBy: { dueDate: 'asc' },
              skip: type === 'supplier' ? skip : 0,
              take: type === 'supplier' ? limit : 200,
            }),
        type === 'supplier'
          ? Promise.resolve([])
          : this.prisma.carrierPayout.findMany({
              where,
              include: {
                order: { select: { orderNumber: true } },
                carrier: { select: { id: true, name: true, legalName: true, ibanNumber: true } },
                driver: { select: { id: true, firstName: true, lastName: true } },
              },
              orderBy: { dueDate: 'asc' },
              skip: type === 'carrier' ? skip : 0,
              take: type === 'carrier' ? limit : 200,
            }),
        type === 'carrier' ? Promise.resolve(0) : this.prisma.supplierPayout.count({ where }),
        type === 'supplier' ? Promise.resolve(0) : this.prisma.carrierPayout.count({ where }),
      ]);

    return {
      supplierPayouts: supplierPayouts.map((p) => ({ ...p, payoutType: 'supplier' })),
      carrierPayouts: carrierPayouts.map((p) => ({ ...p, payoutType: 'carrier' })),
      meta: { supplierTotal, carrierTotal, page, limit },
    };
  }

  async getSummary(user: RequestingUser) {
    this.requireAdmin(user);
    const now = new Date();

    const [supplierPending, carrierPending, supplierOverdue, carrierOverdue] =
      await Promise.all([
        this.prisma.supplierPayout.aggregate({ where: { status: PayoutStatus.PENDING }, _sum: { amount: true }, _count: true }),
        this.prisma.carrierPayout.aggregate({ where: { status: PayoutStatus.PENDING }, _sum: { amount: true }, _count: true }),
        this.prisma.supplierPayout.aggregate({ where: { status: PayoutStatus.PENDING, dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
        this.prisma.carrierPayout.aggregate({ where: { status: PayoutStatus.PENDING, dueDate: { lt: now } }, _sum: { amount: true }, _count: true }),
      ]);

    return {
      pending: {
        supplierAmount: supplierPending._sum.amount ?? 0,
        supplierCount: supplierPending._count,
        carrierAmount: carrierPending._sum.amount ?? 0,
        carrierCount: carrierPending._count,
        totalAmount: (supplierPending._sum.amount ?? 0) + (carrierPending._sum.amount ?? 0),
      },
      overdue: {
        supplierAmount: supplierOverdue._sum.amount ?? 0,
        supplierCount: supplierOverdue._count,
        carrierAmount: carrierOverdue._sum.amount ?? 0,
        carrierCount: carrierOverdue._count,
        totalAmount: (supplierOverdue._sum.amount ?? 0) + (carrierOverdue._sum.amount ?? 0),
      },
    };
  }

  async executeSupplierPayout(
    payoutId: string,
    user: RequestingUser,
    payseraTransferId?: string,
  ) {
    this.requireAdmin(user);

    const payout = await this.prisma.supplierPayout.findUnique({
      where: { id: payoutId },
      include: {
        supplier: { select: { name: true, ibanNumber: true } },
        order: { select: { orderNumber: true } },
      },
    });

    if (!payout) throw new NotFoundException('Supplier payout not found');
    if (payout.status === PayoutStatus.PAID) throw new BadRequestException('Payout already paid');

    if (!payout.supplier.ibanNumber) {
      throw new BadRequestException(
        `Supplier ${payout.supplier.name} has no IBAN number — update company profile first`,
      );
    }

    // Auto-transfer via Paysera Mass Payments if enabled and no manual transferId provided
    let resolvedTransferId = payseraTransferId ?? null;
    if (!resolvedTransferId && this.paysera.enabled) {
      const orderRef = payout.order?.orderNumber ?? payout.orderId ?? payoutId;
      const transfer = await this.paysera.sendTransfer({
        iban: payout.supplier.ibanNumber,
        beneficiaryName: payout.supplier.name,
        amountCents: Math.round(payout.amount * 100),
        currency: payout.currency,
        reference: `B3HUB-${orderRef}`.slice(0, 35),
        description: `B3Hub izmaksa par pasūtījumu ${orderRef}`,
      });
      resolvedTransferId = transfer.id;
    }

    await this.prisma.supplierPayout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PAID, paidAt: new Date(), payseraTransferId: resolvedTransferId },
    });

    this.logger.log(`SupplierPayout ${payoutId} PAID — €${payout.amount.toFixed(2)} to ${payout.supplier.name}`);
    return { success: true, payoutId };
  }

  async executeCarrierPayout(
    payoutId: string,
    user: RequestingUser,
    payseraTransferId?: string,
  ) {
    this.requireAdmin(user);

    const payout = await this.prisma.carrierPayout.findUnique({
      where: { id: payoutId },
      include: {
        carrier: { select: { name: true, ibanNumber: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { orderNumber: true } },
      },
    });

    if (!payout) throw new NotFoundException('Carrier payout not found');
    if (payout.status === PayoutStatus.PAID) throw new BadRequestException('Payout already paid');

    if (!payout.carrier?.ibanNumber) {
      throw new BadRequestException('Carrier has no IBAN number configured');
    }

    // Auto-transfer via Paysera Mass Payments if enabled and no manual transferId provided
    let resolvedTransferId = payseraTransferId ?? null;
    if (!resolvedTransferId && this.paysera.enabled) {
      const orderRef = payout.order?.orderNumber ?? payout.orderId ?? payoutId;
      const transfer = await this.paysera.sendTransfer({
        iban: payout.carrier.ibanNumber,
        beneficiaryName: payout.carrier.name,
        amountCents: Math.round(payout.amount * 100),
        currency: payout.currency,
        reference: `B3HUB-${orderRef}`.slice(0, 35),
        description: `B3Hub izmaksa par pasūtījumu ${orderRef}`,
      });
      resolvedTransferId = transfer.id;
    }

    await this.prisma.carrierPayout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PAID, paidAt: new Date(), payseraTransferId: resolvedTransferId },
    });

    if (payout.driverId) {
      const orderRef = payout.order?.orderNumber ?? payout.orderId ?? payoutId;
      this.notifications
        .create({
          userId: payout.driverId,
          type: NotificationType.PAYMENT_RECEIVED,
          title: 'Izmaksa veikta',
          message: `Jūsu atalgojums €${payout.amount.toFixed(2)} par pasūtījumu #${orderRef} ir pārskaitīts.`,
          data: { payoutId, orderId: payout.orderId },
        })
        .catch((e: unknown) => this.logger.warn(`Notification failed: ${(e as Error).message}`));
    }

    this.logger.log(`CarrierPayout ${payoutId} PAID — €${payout.amount.toFixed(2)}`);
    return { success: true, payoutId };
  }

  async executeDuePayouts(user?: RequestingUser) {
    if (user) this.requireAdmin(user);

    const now = new Date();
    let processed = 0;
    let failed = 0;

    const dueSupplierPayouts = await this.prisma.supplierPayout.findMany({
      where: { status: PayoutStatus.PENDING, dueDate: { lte: now } },
      include: {
        supplier: { select: { name: true, ibanNumber: true } },
        order: { select: { orderNumber: true } },
      },
    });

    for (const payout of dueSupplierPayouts) {
      if (!payout.supplier.ibanNumber) {
        await this.prisma.supplierPayout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.FAILED, notes: 'No IBAN number configured' },
        });
        failed++;
        continue;
      }

      try {
        // Auto-transfer via Paysera Mass Payments when enabled
        let transferId: string | undefined;
        if (this.paysera.enabled) {
          const orderRef = payout.order?.orderNumber ?? payout.orderId ?? payout.id;
          const transfer = await this.paysera.sendTransfer({
            iban: payout.supplier.ibanNumber,
            beneficiaryName: payout.supplier.name,
            amountCents: Math.round(payout.amount * 100),
            currency: payout.currency,
            reference: `B3HUB-${orderRef}`.slice(0, 35),
            description: `B3Hub izmaksa par pasūtījumu ${orderRef}`,
          });
          transferId = transfer.id;
        }

        await this.prisma.supplierPayout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.PAID, paidAt: new Date(), payseraTransferId: transferId ?? null },
        });

        const supplierUsers = await this.prisma.user.findMany({
          where: { companyId: payout.supplierId },
          select: { id: true },
        });
        if (supplierUsers.length > 0) {
          this.notifications
            .createForMany(
              supplierUsers.map((u) => u.id),
              {
                type: NotificationType.PAYMENT_RECEIVED,
                title: 'Izmaksa veikta',
                message: `Izmaksa €${payout.amount.toFixed(2)} par pasūtījumu #${payout.order?.orderNumber ?? payout.orderId} ir pārskaitīta.`,
                data: { payoutId: payout.id, orderId: payout.orderId },
              },
            )
            .catch((e: unknown) => this.logger.warn(`Notification failed: ${(e as Error).message}`));
        }
        processed++;
      } catch (err) {
        await this.prisma.supplierPayout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.FAILED, notes: (err as Error).message },
        });
        failed++;
      }
    }

    const dueCarrierPayouts = await this.prisma.carrierPayout.findMany({
      where: { status: PayoutStatus.PENDING, dueDate: { lte: now } },
      include: {
        carrier: { select: { name: true, ibanNumber: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { orderNumber: true } },
      },
    });

    for (const payout of dueCarrierPayouts) {
      if (!payout.carrier?.ibanNumber) {
        await this.prisma.carrierPayout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.FAILED, notes: 'No IBAN number configured' },
        });
        failed++;
        continue;
      }

      try {
        // Auto-transfer via Paysera Mass Payments when enabled
        let transferId: string | undefined;
        if (this.paysera.enabled && payout.carrier?.ibanNumber) {
          const orderRef = payout.order?.orderNumber ?? payout.orderId ?? payout.id;
          const transfer = await this.paysera.sendTransfer({
            iban: payout.carrier.ibanNumber,
            beneficiaryName: payout.carrier.name,
            amountCents: Math.round(payout.amount * 100),
            currency: payout.currency,
            reference: `B3HUB-${orderRef}`.slice(0, 35),
            description: `B3Hub izmaksa par pasūtījumu ${orderRef}`,
          });
          transferId = transfer.id;
        }

        await this.prisma.carrierPayout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.PAID, paidAt: new Date(), payseraTransferId: transferId ?? null },
        });

        if (payout.driverId) {
          const orderRef = payout.order?.orderNumber ?? payout.orderId ?? payout.id;
          this.notifications
            .create({
              userId: payout.driverId,
              type: NotificationType.PAYMENT_RECEIVED,
              title: 'Izmaksa veikta',
              message: `Jūsu atalgojums €${payout.amount.toFixed(2)} par pasūtījumu #${orderRef} ir pārskaitīts.`,
              data: { payoutId: payout.id, orderId: payout.orderId },
            })
            .catch((e: unknown) => this.logger.warn(`Notification failed: ${(e as Error).message}`));
        }
        processed++;
      } catch (err) {
        await this.prisma.carrierPayout.update({
          where: { id: payout.id },
          data: { status: PayoutStatus.FAILED, notes: (err as Error).message },
        });
        failed++;
      }
    }

    this.logger.log(`executeDuePayouts: processed=${processed}, failed=${failed}`);

    if (failed > 0) {
      const admins = await this.prisma.user.findMany({ where: { userType: 'ADMIN' }, select: { id: true }, take: 50 });
      if (admins.length > 0) {
        this.notifications
          .createForMany(admins.map((u) => u.id), {
            type: NotificationType.SYSTEM_ALERT,
            title: '🚨 Izmaksu partija — kļūdas',
            message: `Automātiskā izmaksu partija: ${processed} veiksmīgas, ${failed} neizdevušās.`,
            data: { processed, failed },
          })
          .catch((e: unknown) => this.logger.warn(`Admin notification failed: ${(e as Error).message}`));
      }
    }

    return { processed, failed };
  }

  async cancelOrderPayouts(orderId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.supplierPayout.updateMany({
        where: { orderId, status: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] } },
        data: { status: PayoutStatus.CANCELLED },
      }),
      this.prisma.carrierPayout.updateMany({
        where: { orderId, status: { in: [PayoutStatus.PENDING, PayoutStatus.FAILED] } },
        data: { status: PayoutStatus.CANCELLED },
      }),
    ]);
    this.logger.log(`cancelOrderPayouts: voided payout obligations for order ${orderId}`);
  }

  @Cron('0 8 * * 1-5')
  async scheduledPayoutRun(): Promise<void> {
    await withCronLock(
      this.prisma,
      'scheduled-payout-run',
      async () => {
        this.logger.log('Running scheduled payout batch...');
        await this.executeDuePayouts();
      },
      this.logger,
    );
  }
}
