import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
