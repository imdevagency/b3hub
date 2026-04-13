/**
 * Containers service.
 * Tracks physical waste containers (skips, bins) associated with skip-hire orders —
 * inventory management, location updates, and availability checks.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContainerOrderStatus,
  ContainerStatus,
  OrderStatus,
  OrderType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

/** Maps ContainerOrderStatus transitions → parent Order.status */
const CONTAINER_TO_ORDER_STATUS: Partial<Record<ContainerOrderStatus, OrderStatus>> = {
  [ContainerOrderStatus.DELIVERED]: OrderStatus.CONFIRMED,
  [ContainerOrderStatus.IN_USE]: OrderStatus.IN_PROGRESS,
  [ContainerOrderStatus.PICKED_UP]: OrderStatus.DELIVERED,
  [ContainerOrderStatus.COMPLETED]: OrderStatus.COMPLETED,
  [ContainerOrderStatus.CANCELLED]: OrderStatus.CANCELLED,
};
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { QueryContainersDto } from './dto/query-containers.dto';
import { CreateContainerOrderDto } from './dto/create-container-order.dto';
import { UpdateContainerOrderStatusDto } from './dto/update-container-order-status.dto';
import { VAT_RATE } from '../common/constants/tax';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ContainersService {
  private readonly logger = new Logger(ContainersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Container Fleet (carrier) ─────────────────────────────────────────────

  /** Carrier: add a container to their company fleet */
  async create(dto: CreateContainerDto, companyId: string) {
    const container = await this.prisma.container.create({
      data: {
        containerType: dto.containerType,
        size: dto.size,
        volume: dto.volume,
        maxWeight: dto.maxWeight,
        rentalPrice: dto.rentalPrice,
        deliveryFee: dto.deliveryFee,
        pickupFee: dto.pickupFee,
        location: dto.location,
        currency: dto.currency ?? 'EUR',
        status: ContainerStatus.AVAILABLE,
        ownerId: companyId,
      },
    });
    this.logger.log(`Container ${container.id} added to company ${companyId}`);
    return container;
  }

  /** Public: list available containers with optional filters */
  async findAll(query: QueryContainersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ContainerWhereInput = {
      status: ContainerStatus.AVAILABLE,
    };
    if (query.containerType) where.containerType = query.containerType;
    if (query.size) where.size = query.size;
    if (query.minVolume) where.volume = { gte: query.minVolume };
    if (query.maxPrice) where.rentalPrice = { lte: query.maxPrice };

    const [data, total] = await Promise.all([
      this.prisma.container.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              logo: true,
              rating: true,
              city: true,
            },
          },
        },
        orderBy: { rentalPrice: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.container.count({ where }),
    ]);

    return { data, meta: { page, limit, total } };
  }

  /** Carrier: list their own containers (all statuses) */
  async findMine(companyId: string) {
    return this.prisma.container.findMany({
      where: { ownerId: companyId },
      include: {
        _count: { select: { containerOrders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const container = await this.prisma.container.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            logo: true,
            rating: true,
            city: true,
            phone: true,
          },
        },
      },
    });
    if (!container) throw new NotFoundException('Container not found');
    return container;
  }

  /** Carrier: update their container */
  async update(id: string, dto: UpdateContainerDto, companyId: string) {
    await this.assertOwnership(id, companyId);
    return this.prisma.container.update({
      where: { id },
      data: dto,
    });
  }

  /** Carrier: remove a container (only if not currently rented) */
  async remove(id: string, companyId: string) {
    const container = await this.assertOwnership(id, companyId);
    if (container.status === ContainerStatus.RENTED) {
      throw new BadRequestException(
        'Cannot delete a container that is currently rented',
      );
    }
    await this.prisma.container.delete({ where: { id } });
    return { ok: true };
  }

  // ── Container Orders (rental) ─────────────────────────────────────────────

  /**
   * Buyer: rent a container.
   * Creates a parent Order (CONTAINER type) + ContainerOrder.
   */
  async createOrder(
    containerId: string,
    dto: CreateContainerOrderDto,
    userId: string,
  ) {
    const container = await this.prisma.container.findUnique({
      where: { id: containerId },
      include: { owner: { select: { id: true } } },
    });
    if (!container) throw new NotFoundException('Container not found');
    if (container.status !== ContainerStatus.AVAILABLE) {
      throw new BadRequestException('Container is not available for rent');
    }

    // Resolve buyer's company
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!user?.companyId) {
      throw new BadRequestException(
        'You must have a company account to rent a container',
      );
    }
    const buyerCompanyId = user.companyId;

    const subtotal =
      dto.rentalDays * container.rentalPrice +
      container.deliveryFee +
      container.pickupFee;
    const tax = subtotal * VAT_RATE;
    const total = subtotal + tax;

    const orderNumber = this.generateOrderNumber();

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        orderType: OrderType.CONTAINER,
        buyerId: buyerCompanyId,
        createdById: userId,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryState: '',
        deliveryPostal: '',
        deliveryLat: dto.deliveryLat ?? null,
        deliveryLng: dto.deliveryLng ?? null,
        deliveryDate: new Date(dto.startDate),
        subtotal,
        tax,
        deliveryFee: container.deliveryFee,
        total,
        currency: container.currency,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        notes: dto.notes,
        containerOrders: {
          create: {
            containerId,
            startDate: new Date(dto.startDate),
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            purpose: dto.purpose,
            wasteType: dto.wasteType,
            estimatedWeight: dto.estimatedWeight,
            rentalDays: dto.rentalDays,
            dailyRate: container.rentalPrice,
            deliveryFee: container.deliveryFee,
            pickupFee: container.pickupFee,
            total: subtotal,
            status: ContainerOrderStatus.SCHEDULED,
          },
        },
      },
      include: {
        containerOrders: true,
      },
    });

    // Mark container as rented
    await this.prisma.container.update({
      where: { id: containerId },
      data: { status: ContainerStatus.RENTED },
    });

    return order;
  }

  /** Buyer: get their own container orders */
  async findMyOrders(userId: string) {
    const _user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    return this.prisma.containerOrder.findMany({
      where: { order: { createdById: userId } },
      include: {
        container: {
          include: {
            owner: { select: { id: true, name: true, phone: true } },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrder(id: string, userId: string) {
    const order = await this.prisma.containerOrder.findFirst({
      where: {
        id,
        order: { createdById: userId },
      },
      include: {
        container: {
          include: {
            owner: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
        },
        order: true,
        wasteRecords: true,
      },
    });
    if (!order) throw new NotFoundException('Container order not found');
    return order;
  }

  /**
   * Carrier: update container order status.
   * Also marks the container back as AVAILABLE when picked up / completed / cancelled.
   */
  async updateOrderStatus(
    id: string,
    dto: UpdateContainerOrderStatusDto,
    companyId: string,
  ) {
    const containerOrder = await this.prisma.containerOrder.findFirst({
      where: { id },
      include: {
        container: { select: { id: true, ownerId: true, status: true } },
      },
    });
    if (!containerOrder)
      throw new NotFoundException('Container order not found');
    if (containerOrder.container.ownerId !== companyId) {
      throw new ForbiddenException('You do not own this container');
    }

    const terminalStatuses: ContainerOrderStatus[] = [
      ContainerOrderStatus.COMPLETED,
      ContainerOrderStatus.CANCELLED,
      ContainerOrderStatus.PICKED_UP,
    ];

    const parentOrderStatus = CONTAINER_TO_ORDER_STATUS[dto.status];

    const [updated] = await this.prisma.$transaction([
      this.prisma.containerOrder.update({
        where: { id },
        data: {
          status: dto.status,
          ...(terminalStatuses.includes(dto.status) && {
            actualEndDate: new Date(),
          }),
        },
      }),
      // Sync parent Order.status so dashboards and queries reflect the current rental state
      ...(parentOrderStatus
        ? [
            this.prisma.order.update({
              where: { id: containerOrder.orderId },
              data: { status: parentOrderStatus },
            }),
          ]
        : []),
    ]);

    // Free up the container when the rental ends
    if (terminalStatuses.includes(dto.status)) {
      await this.prisma.container.update({
        where: { id: containerOrder.containerId },
        data: { status: ContainerStatus.AVAILABLE },
      });
    }

    return updated;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertOwnership(id: string, companyId: string) {
    const container = await this.prisma.container.findUnique({ where: { id } });
    if (!container) throw new NotFoundException('Container not found');
    if (container.ownerId !== companyId) {
      throw new ForbiddenException('You do not own this container');
    }
    return container;
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `ORD-${year}${month}${ms}${rand}`;
  }
}
