import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderStatus, TransportJobStatus } from '@prisma/client';
import { RequestingUser } from '../common/types/requesting-user.interface';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto, currentUser: RequestingUser) {
    // Transport-only users cannot place orders
    const transportOnly =
      currentUser.canTransport && !currentUser.canSell && currentUser.userType !== 'ADMIN';
    if (transportOnly) {
      throw new ForbiddenException('Transport-only accounts cannot create orders');
    }

    const userId = currentUser.userId;
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

  async findAll(currentUser: RequestingUser, status?: OrderStatus) {
    const where = this.buildOrderWhere(currentUser, status);
    return this.prisma.order.findMany({
      where,
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

  private buildOrderWhere(currentUser: RequestingUser, status?: OrderStatus) {
    const statusFilter = status ? { status } : {};

    // Admins see everything
    if (currentUser.userType === 'ADMIN') return statusFilter;

    // Build union of all perspectives this user has
    const orConditions: any[] = [];

    // Transport-only users have no buying capability — skip the "created by" bucket
    // so they don't appear in order listings as buyers and can't create orders.
    const transportOnly =
      currentUser.canTransport && !currentUser.canSell && currentUser.userType !== 'ADMIN';

    if (!transportOnly) {
      orConditions.push({ createdById: currentUser.userId });
    }

    // Seller: orders that contain their company's materials
    if (currentUser.canSell && currentUser.companyId) {
      orConditions.push({
        items: { some: { material: { supplierId: currentUser.companyId } } },
      });
    }

    // Driver: orders with transport jobs assigned to them
    if (currentUser.canTransport) {
      orConditions.push({
        transportJobs: { some: { driverId: currentUser.userId } },
      });
    }

    return { ...statusFilter, OR: orConditions };
  }

  private async assertOrderAccess(order: any, currentUser: RequestingUser) {
    if (currentUser.userType === 'ADMIN') return;

    const transportOnly =
      currentUser.canTransport && !currentUser.canSell && currentUser.userType !== 'ADMIN';

    // Buyer: created this order (not applicable to transport-only accounts)
    if (!transportOnly && order.createdById === currentUser.userId) return;

    // Seller: has their materials in this order
    if (currentUser.canSell && currentUser.companyId) {
      const count = await this.prisma.orderItem.count({
        where: { orderId: order.id, material: { supplierId: currentUser.companyId } },
      });
      if (count > 0) return;
    }

    // Driver: has a transport job on this order
    if (currentUser.canTransport) {
      const count = await this.prisma.transportJob.count({
        where: { orderId: order.id, driverId: currentUser.userId },
      });
      if (count > 0) return;
    }

    throw new ForbiddenException('You do not have access to this order');
  }

  async findOne(id: string, currentUser?: RequestingUser) {
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

    if (currentUser && currentUser.userType !== 'ADMIN') {
      await this.assertOrderAccess(order, currentUser);
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto, currentUser: RequestingUser) {
    await this.findOne(id, currentUser); // Check existence and ownership

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

  async cancel(id: string, currentUser: RequestingUser) {
    const order = await this.findOne(id, currentUser);

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a delivered or completed order');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });
  }

  async getDashboardStats(currentUser: RequestingUser) {
    const { userId, canSell, canTransport, companyId } = currentUser;

    // ── Always compute buyer section ──────────────────────────────────────────
    const [activeOrders, awaitingDelivery, skipHireOrders, documents] = await Promise.all([
      this.prisma.order.count({
        where: {
          createdById: userId,
          status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.order.count({
        where: { createdById: userId, status: OrderStatus.DELIVERED },
      }),
      this.prisma.skipHireOrder.count({ where: { userId } }),
      this.prisma.document.count({ where: { ownerId: userId } }),
    ]);

    const buyer = { activeOrders, awaitingDelivery, myOrders: skipHireOrders, documents };

    // ── Seller section (only if canSell) ──────────────────────────────────────
    let seller: Record<string, any> | null = null;
    if (canSell && companyId) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [activeListings, pendingOrders, revenueResult] = await Promise.all([
        this.prisma.material.count({ where: { supplierId: companyId, active: true } }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.PENDING,
            items: { some: { material: { supplierId: companyId } } },
          },
        }),
        this.prisma.orderItem.aggregate({
          where: {
            material: { supplierId: companyId },
            order: {
              status: { in: [OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS, OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
              createdAt: { gte: startOfMonth },
            },
          },
          _sum: { total: true },
        }),
      ]);
      seller = {
        activeListings,
        pendingOrders,
        monthlyRevenue: revenueResult._sum.total ?? 0,
        documents,
      };
    } else if (canSell) {
      // canSell but no company linked yet
      seller = { activeListings: 0, pendingOrders: 0, monthlyRevenue: 0, documents };
    }

    // ── Transport section (only if canTransport) ──────────────────────────────
    let transport: Record<string, any> | null = null;
    if (canTransport) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const [activeJobs, completedToday] = await Promise.all([
        this.prisma.transportJob.count({
          where: {
            driverId: userId,
            status: {
              in: [
                TransportJobStatus.ASSIGNED,
                TransportJobStatus.ACCEPTED,
                TransportJobStatus.EN_ROUTE_PICKUP,
                TransportJobStatus.AT_PICKUP,
                TransportJobStatus.LOADED,
                TransportJobStatus.EN_ROUTE_DELIVERY,
                TransportJobStatus.AT_DELIVERY,
              ],
            },
          },
        }),
        this.prisma.transportJob.count({
          where: {
            driverId: userId,
            status: TransportJobStatus.DELIVERED,
            updatedAt: { gte: today, lt: tomorrow },
          },
        }),
      ]);
      transport = { activeJobs, completedToday, awaitingPayment: 0, documents };
    }

    return { buyer, seller, transport };
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
