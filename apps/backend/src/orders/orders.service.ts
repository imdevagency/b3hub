import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    const { items, ...orderData } = createOrderDto;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      const material = await this.prisma.material.findUnique({
        where: { id: item.materialId },
      });
      if (!material) {
        throw new NotFoundException(`Material ${item.materialId} not found`);
      }
      subtotal += material.basePrice * item.quantity;
    }

    const tax = subtotal * 0.19; // 19% VAT
    const total = subtotal + tax + (orderData.deliveryFee || 0);

    // Create order with items
    return this.prisma.order.create({
      data: {
        orderNumber,
        orderType: orderData.orderType,
        buyerId: orderData.buyerId,
        createdById: userId,
        deliveryAddress: orderData.deliveryAddress,
        deliveryCity: orderData.deliveryCity,
        deliveryState: orderData.deliveryState,
        deliveryPostal: orderData.deliveryPostal,
        deliveryDate: orderData.deliveryDate ? new Date(orderData.deliveryDate) : undefined,
        deliveryWindow: orderData.deliveryWindow,
        deliveryFee: orderData.deliveryFee,
        notes: orderData.notes,
        subtotal,
        tax,
        total,
        currency: 'EUR',
        status: OrderStatus.PENDING,
        paymentStatus: orderData.paymentStatus || 'PENDING',
        items: {
          create: items.map((item) => ({
            materialId: item.materialId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            material: {
              select: {
                name: true,
                category: true,
                images: true,
              },
            },
          },
        },
        buyer: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async findAll(filters?: {
    buyerId?: string;
    status?: OrderStatus;
    userId?: string;
  }) {
    return this.prisma.order.findMany({
      where: filters,
      include: {
        items: {
          include: {
            material: {
              select: {
                name: true,
                images: true,
              },
            },
          },
        },
        buyer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            material: {
              include: {
                supplier: {
                  select: {
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        buyer: {
          select: {
            name: true,
            email: true,
            phone: true,
            street: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
        transportJobs: true,
        invoices: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    await this.findOne(id); // Check if exists

    const updateData: any = {};
    
    if (updateOrderDto.deliveryAddress) updateData.deliveryAddress = updateOrderDto.deliveryAddress;
    if (updateOrderDto.deliveryCity) updateData.deliveryCity = updateOrderDto.deliveryCity;
    if (updateOrderDto.deliveryState) updateData.deliveryState = updateOrderDto.deliveryState;
    if (updateOrderDto.deliveryPostal) updateData.deliveryPostal = updateOrderDto.deliveryPostal;
    if (updateOrderDto.deliveryDate) updateData.deliveryDate = new Date(updateOrderDto.deliveryDate);
    if (updateOrderDto.deliveryWindow) updateData.deliveryWindow = updateOrderDto.deliveryWindow;
    if (updateOrderDto.deliveryFee !== undefined) updateData.deliveryFee = updateOrderDto.deliveryFee;
    if (updateOrderDto.notes) updateData.notes = updateOrderDto.notes;
    if (updateOrderDto.paymentStatus) updateData.paymentStatus = updateOrderDto.paymentStatus;

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            material: true,
          },
        },
      },
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    await this.findOne(id); // Check if exists

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async cancel(id: string) {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a delivered or completed order');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });
  }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const number = (count + 1).toString().padStart(5, '0');
    return `ORD${year}${month}${number}`;
  }
}
