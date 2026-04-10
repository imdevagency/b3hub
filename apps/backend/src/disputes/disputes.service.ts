import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { PaymentsService } from '../payments/payments.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
  ) {}

  async create(dto: CreateDisputeDto, currentUser: RequestingUser) {
    // Verify the order exists and belongs to the current user's company
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: {
        id: true,
        status: true,
        buyerId: true,
        dispute: { select: { id: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only the buyer company or admin can raise a dispute
    if (currentUser.userType !== 'ADMIN' && order.buyerId !== currentUser.companyId) {
      throw new ForbiddenException('Order does not belong to your company');
    }

    // Only allow disputes on DELIVERED or COMPLETED orders
    if (
      currentUser.userType !== 'ADMIN' &&
      order.status !== 'DELIVERED' &&
      order.status !== 'COMPLETED'
    ) {
      throw new ForbiddenException('Disputes can only be raised on delivered orders');
    }

    // One dispute per order
    if (order.dispute) {
      throw new ConflictException('A dispute already exists for this order');
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId: dto.orderId,
        raisedById: currentUser.userId,
        reason: dto.reason,
        description: dto.description,
      },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true },
        },
        raisedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Dispute ${dispute.id} raised for order ${dto.orderId} by user ${currentUser.userId}`);

    // Alert all admins so they can review promptly
    this.prisma.user
      .findMany({ where: { userType: 'ADMIN' }, select: { id: true } })
      .then((admins) =>
        Promise.all(
          admins.map((admin) =>
            this.notifications
              .create({
                userId: admin.id,
                type: NotificationType.DISPUTE_FILED,
                title: '⚠️ Jauns strīds',
                message: `Pirćējs iesniedzis strīdu par pasūtījumu #${dispute.order.orderNumber}. Iemesls: ${dto.reason}.`,
                data: { orderId: dto.orderId, disputeId: dispute.id },
              })
              .catch(() => null),
          ),
        ),
      )
      .catch((err) =>
        this.logger.error(`Failed to notify admins of dispute ${dispute.id}: ${(err as Error).message}`),
      );

    return dispute;
  }

  async findAll(currentUser: RequestingUser, orderId?: string) {
    const where: Record<string, unknown> = {};

    if (orderId) {
      where.orderId = orderId;
    }

    // Non-admins see disputes they raised themselves OR any dispute raised for
    // their company's orders (so managers can audit teammate-raised disputes).
    if (currentUser.userType !== 'ADMIN') {
      if (currentUser.companyId) {
        where.OR = [
          { raisedById: currentUser.userId },
          { order: { buyerId: currentUser.companyId } },
        ];
      } else {
        where.raisedById = currentUser.userId;
      }
    }

    return this.prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, deliveryAddress: true },
        },
        raisedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findOne(id: string, currentUser: RequestingUser) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, deliveryAddress: true, buyerId: true },
        },
        raisedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (
      currentUser.userType !== 'ADMIN' &&
      dispute.raisedById !== currentUser.userId &&
      dispute.order.buyerId !== currentUser.companyId
    ) {
      throw new ForbiddenException('Access denied');
    }

    return dispute;
  }

  async update(id: string, dto: UpdateDisputeDto, currentUser: RequestingUser) {
    // Only admins can update dispute status / resolution
    if (currentUser.userType !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update disputes');
    }

    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const resolvedAt =
      dto.status === 'RESOLVED' || dto.status === 'REJECTED' ? new Date() : undefined;

    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
        ...(resolvedAt !== undefined ? { resolvedAt } : {}),
      },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true },
        },
        raisedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Dispute ${id} updated to status ${dto.status} by admin ${currentUser.userId}`);

    // When admin resolves in buyer's favour → trigger a Stripe refund
    if (dto.status === 'RESOLVED') {
      this.payments
        .voidOrRefund(updated.order.id)
        .catch((err) =>
          this.logger.error(
            `voidOrRefund failed after dispute RESOLVED for order ${updated.order.id}: ${(err as Error).message}`,
          ),
        );
    }

    // Notify the buyer of the outcome
    if (dto.status === 'RESOLVED' || dto.status === 'REJECTED') {
      const resolutionText = dto.resolution ? ` Rezolūcija: ${dto.resolution}.` : '';
      this.notifications
        .create({
          userId: updated.raisedBy.id,
          type: NotificationType.DISPUTE_RESOLVED,
          title: dto.status === 'RESOLVED' ? '✅ Strīds atrisināts' : 'ℹ️ Strīds noraidīts',
          message:
            dto.status === 'RESOLVED'
              ? `Jūsu strīds par pasūtījumu #${updated.order.orderNumber} ir atrisināts jūsu labā. Atlīdzība tiek apstrādāta.${resolutionText}`
              : `Jūsu strīds par pasūtījumu #${updated.order.orderNumber} tika noraidīts.${resolutionText}`,
          data: { orderId: updated.order.id, disputeId: id },
        })
        .catch(() => null);
    }

    return updated;
  }
}
