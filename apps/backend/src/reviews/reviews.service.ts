import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Buyer: submit a review ────────────────────────────────────
  async create(dto: CreateReviewDto, userId: string) {
    if (!dto.orderId && !dto.skipOrderId) {
      throw new BadRequestException(
        'Either orderId or skipOrderId must be provided',
      );
    }
    if (dto.orderId && dto.skipOrderId) {
      throw new BadRequestException(
        'Provide either orderId or skipOrderId, not both',
      );
    }

    let companyId: string;

    if (dto.orderId) {
      // Material order — company to rate is the supplier of the first item
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          items: { include: { material: { select: { supplierId: true } } } },
        },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.createdById !== userId)
        throw new ForbiddenException('Not your order');
      if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
        throw new BadRequestException('Can only review a delivered order');
      }

      // Guard: no duplicate review for same order
      const existing = await this.prisma.review.findUnique({
        where: { orderId: dto.orderId },
      });
      if (existing)
        throw new ConflictException('You already reviewed this order');

      companyId = order.items[0]?.material?.supplierId ?? order.buyerId;
    } else {
      // Skip-hire order — company to rate is the assigned carrier
      const skipOrder = await this.prisma.skipHireOrder.findUnique({
        where: { id: dto.skipOrderId },
      });
      if (!skipOrder) throw new NotFoundException('Skip hire order not found');
      if (skipOrder.userId !== userId)
        throw new ForbiddenException('Not your order');
      if (
        skipOrder.status !== 'COLLECTED' &&
        skipOrder.status !== 'COMPLETED'
      ) {
        throw new BadRequestException(
          'Can only review a completed skip hire order',
        );
      }
      if (!skipOrder.carrierId) {
        throw new BadRequestException(
          'No carrier assigned to this skip hire order',
        );
      }

      // Guard: no duplicate review
      const existing = await this.prisma.review.findUnique({
        where: { skipOrderId: dto.skipOrderId },
      });
      if (existing)
        throw new ConflictException('You already reviewed this order');

      companyId = skipOrder.carrierId;
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        reviewerId: userId,
        companyId,
        orderId: dto.orderId ?? null,
        skipOrderId: dto.skipOrderId ?? null,
      },
    });

    // Recompute and update company average rating
    await this.recomputeRating(companyId);

    return review;
  }

  // ── Get reviews for a company ────────────────────────────────
  async findByCompany(companyId: string) {
    return this.prisma.review.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        reviewer: { select: { firstName: true, lastName: true } },
      },
    });
  }

  // ── Check if the current user has already reviewed an order ──
  async getReviewStatus(
    userId: string,
    orderId?: string,
    skipOrderId?: string,
  ) {
    if (orderId) {
      const r = await this.prisma.review.findUnique({ where: { orderId } });
      return { reviewed: !!r && r.reviewerId === userId };
    }
    if (skipOrderId) {
      const r = await this.prisma.review.findUnique({ where: { skipOrderId } });
      return { reviewed: !!r && r.reviewerId === userId };
    }
    return { reviewed: false };
  }

  // ── Internal: recompute average rating for a company ─────────
  private async recomputeRating(companyId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { companyId },
      _avg: { rating: true },
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: { rating: agg._avg.rating ?? null },
    });
  }
}
