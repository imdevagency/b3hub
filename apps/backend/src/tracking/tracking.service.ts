import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateTrackingDeliveryDto } from './dto/update-tracking-delivery.dto';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async getByToken(token: string) {
    const order = await this.prisma.order.findUnique({
      where: { trackingToken: token },
      select: {
        orderNumber: true,
        status: true,
        deliveryAddress: true,
        deliveryCity: true,
        deliveryDate: true,
        deliveryWindow: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            unit: true,
            material: {
              select: { name: true, category: true },
            },
          },
        },
        transportJobs: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            pickupCity: true,
            deliveryCity: true,
            estimatedArrival: true,
            currentLocation: true,
            statusTimestamps: true,
            truckIndex: true,
            carrier: {
              select: { name: true },
            },
            driver: {
              select: { firstName: true },
            },
          },
          orderBy: { truckIndex: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Tracking link not found or has expired');
    }

    return order;
  }

  /**
   * Update delivery details via the public share link.
   * Only allowed while the order is in DRAFT or PENDING status.
   */
  async updateDelivery(token: string, dto: UpdateTrackingDeliveryDto) {
    const order = await this.prisma.order.findUnique({
      where: { trackingToken: token },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('Tracking link not found or has expired');
    }

    const editableStatuses: OrderStatus[] = [
      OrderStatus.DRAFT,
      OrderStatus.PENDING,
    ];

    if (!editableStatuses.includes(order.status)) {
      throw new BadRequestException(
        'Delivery details can only be updated while the order is in DRAFT or PENDING status',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        ...(dto.deliveryAddress !== undefined && { deliveryAddress: dto.deliveryAddress }),
        ...(dto.deliveryCity !== undefined && { deliveryCity: dto.deliveryCity }),
        ...(dto.deliveryPostal !== undefined && { deliveryPostal: dto.deliveryPostal }),
        ...(dto.siteContactName !== undefined && { siteContactName: dto.siteContactName }),
        ...(dto.siteContactPhone !== undefined && { siteContactPhone: dto.siteContactPhone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: {
        orderNumber: true,
        status: true,
        deliveryAddress: true,
        deliveryCity: true,
        deliveryPostal: true,
        siteContactName: true,
        siteContactPhone: true,
        notes: true,
      },
    });

    return updated;
  }
}
