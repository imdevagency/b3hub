import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  TransportJobStatus,
  TransportJobType,
} from '@prisma/client';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notifications: NotificationsService,
  ) {}

  async create(createOrderDto: CreateOrderDto, currentUser: RequestingUser) {
    // Transport-only users cannot place orders
    const transportOnly =
      currentUser.canTransport &&
      !currentUser.canSell &&
      currentUser.userType !== 'ADMIN';
    if (transportOnly) {
      throw new ForbiddenException(
        'Transport-only accounts cannot create orders',
      );
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
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        orderType: orderData.orderType,
        buyerId: orderData.buyerId,
        createdById: userId,
        deliveryAddress: orderData.deliveryAddress,
        deliveryCity: orderData.deliveryCity,
        deliveryState: orderData.deliveryState,
        deliveryPostal: orderData.deliveryPostal,
        deliveryDate: orderData.deliveryDate
          ? new Date(orderData.deliveryDate)
          : undefined,
        deliveryWindow: orderData.deliveryWindow,
        deliveryFee: orderData.deliveryFee,
        notes: orderData.notes,
        siteContactName: orderData.siteContactName,
        siteContactPhone: orderData.siteContactPhone,
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

    // Send order confirmation email to buyer (non-blocking)
    if (order.buyer?.email) {
      this.email
        .sendOrderConfirmation(order.buyer.email, order.buyer.name ?? '', {
          orderNumber: order.orderNumber,
          total: Number(order.total),
          currency: order.currency ?? 'EUR',
          deliveryAddress: order.deliveryAddress ?? undefined,
          deliveryCity: order.deliveryCity ?? undefined,
          items: order.items.map((i) => ({
            quantity: Number(i.quantity),
            unit: i.unit,
            material: { name: i.material.name },
          })),
        })
        .catch(() => null);
    }

    // Auto-create a transport job for material orders so drivers see it on the job board immediately.
    if (orderData.orderType === OrderType.MATERIAL && items.length > 0) {
      try {
        await this.spawnTransportJob(order.id, items, orderData, total);
      } catch (err) {
        // Non-fatal — log but don't roll back the order
        this.logger.error(
          `Failed to auto-create transport job for order ${order.id}:`,
          err,
        );
      }
    }

    // Notify seller(s) of new order (fire-and-forget)
    this.notifyOrderSellers(order.id, order.orderNumber).catch(() => null);

    return order;
  }

  /** Push ORDER_CREATED to every user belonging to supplier companies in this order. */
  private async notifyOrderSellers(orderId: string, orderNumber: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { material: { select: { supplierId: true } } },
    });
    const supplierIds = [...new Set(items.map((i) => i.material.supplierId))];
    for (const supplierId of supplierIds) {
      const users = await this.prisma.user.findMany({
        where: { companyId: supplierId },
        select: { id: true },
      });
      for (const user of users) {
        this.notifications
          .create({
            userId: user.id,
            type: NotificationType.ORDER_CREATED,
            title: 'Jauns pasūtījums',
            message: `Saņemts jauns pasūtījums #${orderNumber} jūsu materiāliem.`,
            data: { orderId },
          })
          .catch(() => null);
      }
    }
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
        transportJobs: {
          select: {
            id: true,
            status: true,
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
              },
            },
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
      currentUser.canTransport &&
      !currentUser.canSell &&
      currentUser.userType !== 'ADMIN';

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
      currentUser.canTransport &&
      !currentUser.canSell &&
      currentUser.userType !== 'ADMIN';

    // Buyer: created this order (not applicable to transport-only accounts)
    if (!transportOnly && order.createdById === currentUser.userId) return;

    // Seller: has their materials in this order
    if (currentUser.canSell && currentUser.companyId) {
      const count = await this.prisma.orderItem.count({
        where: {
          orderId: order.id,
          material: { supplierId: currentUser.companyId },
        },
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
        transportJobs: {
          include: {
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            vehicle: {
              select: { id: true, licensePlate: true, vehicleType: true },
            },
            deliveryProof: true,
          },
        },
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

  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
    currentUser: RequestingUser,
  ) {
    await this.findOne(id, currentUser); // Check existence and ownership

    const updateData: any = {};

    if (updateOrderDto.deliveryAddress)
      updateData.deliveryAddress = updateOrderDto.deliveryAddress;
    if (updateOrderDto.deliveryCity)
      updateData.deliveryCity = updateOrderDto.deliveryCity;
    if (updateOrderDto.deliveryState)
      updateData.deliveryState = updateOrderDto.deliveryState;
    if (updateOrderDto.deliveryPostal)
      updateData.deliveryPostal = updateOrderDto.deliveryPostal;
    if (updateOrderDto.deliveryDate)
      updateData.deliveryDate = new Date(updateOrderDto.deliveryDate);
    if (updateOrderDto.deliveryWindow)
      updateData.deliveryWindow = updateOrderDto.deliveryWindow;
    if (updateOrderDto.deliveryFee !== undefined)
      updateData.deliveryFee = updateOrderDto.deliveryFee;
    if (updateOrderDto.notes) updateData.notes = updateOrderDto.notes;
    if (updateOrderDto.siteContactName !== undefined)
      updateData.siteContactName = updateOrderDto.siteContactName;
    if (updateOrderDto.siteContactPhone !== undefined)
      updateData.siteContactPhone = updateOrderDto.siteContactPhone;
    if (updateOrderDto.paymentStatus)
      updateData.paymentStatus = updateOrderDto.paymentStatus;

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
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { invoices: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    // Auto-create an invoice on CONFIRMED (or DELIVERED as fallback), unless one already exists
    if (
      (status === OrderStatus.CONFIRMED || status === OrderStatus.DELIVERED) &&
      order.invoices.length === 0
    ) {
      try {
        await this.spawnInvoice(order);
      } catch (err) {
        this.logger.error(
          `Failed to auto-create invoice for order ${id}:`,
          err,
        );
      }
    }

    // Notify buyer of status change (fire-and-forget)
    const notifMap: Partial<
      Record<OrderStatus, { type: NotificationType; title: string; message: string }>
    > = {
      [OrderStatus.CONFIRMED]: {
        type: NotificationType.ORDER_CONFIRMED,
        title: 'Pasūtījums apstiprināts',
        message: `Jūsu pasūtījums #${order.orderNumber} ir apstiprināts.`,
      },
      [OrderStatus.DELIVERED]: {
        type: NotificationType.ORDER_DELIVERED,
        title: 'Pasūtījums piegādāts',
        message: `Jūsu pasūtījums #${order.orderNumber} ir piegādāts.`,
      },
      [OrderStatus.CANCELLED]: {
        type: NotificationType.ORDER_CANCELLED,
        title: 'Pasūtījums atcelts',
        message: `Pasūtījums #${order.orderNumber} ir atcelts.`,
      },
    };
    const notif = notifMap[status];
    if (notif) {
      this.notifications
        .create({ userId: order.createdById, ...notif, data: { orderId: id } })
        .catch(() => null);
    }

    return updated;
  }

  async cancel(id: string, currentUser: RequestingUser) {
    const order = await this.findOne(id, currentUser);

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Cannot cancel a delivered or completed order',
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });

    // Notify buyer (if someone else cancelled on their behalf)
    this.notifications
      .create({
        userId: order.createdById,
        type: NotificationType.ORDER_CANCELLED,
        title: 'Pasūtījums atcelts',
        message: `Pasūtījums #${order.orderNumber} ir atcelts.`,
        data: { orderId: id },
      })
      .catch(() => null);

    return updated;
  }

  async getDashboardStats(currentUser: RequestingUser) {
    const { userId, canSell, canTransport, companyId } = currentUser;

    // ── Always compute buyer section ──────────────────────────────────────────
    const [activeOrders, awaitingDelivery, skipHireOrders, documents] =
      await Promise.all([
        this.prisma.order.count({
          where: {
            createdById: userId,
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.IN_PROGRESS,
              ],
            },
          },
        }),
        this.prisma.order.count({
          where: { createdById: userId, status: OrderStatus.DELIVERED },
        }),
        this.prisma.skipHireOrder.count({ where: { userId } }),
        this.prisma.document.count({ where: { ownerId: userId } }),
      ]);

    const buyer = {
      activeOrders,
      awaitingDelivery,
      myOrders: skipHireOrders,
      documents,
    };

    // ── Seller section (only if canSell) ──────────────────────────────────────
    let seller: Record<string, any> | null = null;
    if (canSell && companyId) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [activeListings, pendingOrders, revenueResult] = await Promise.all([
        this.prisma.material.count({
          where: { supplierId: companyId, active: true },
        }),
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
              status: {
                in: [
                  OrderStatus.CONFIRMED,
                  OrderStatus.IN_PROGRESS,
                  OrderStatus.DELIVERED,
                  OrderStatus.COMPLETED,
                ],
              },
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
      seller = {
        activeListings: 0,
        pendingOrders: 0,
        monthlyRevenue: 0,
        documents,
      };
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
      const awaitingPayment = await this.prisma.transportJob.count({
        where: {
          driverId: userId,
          status: TransportJobStatus.DELIVERED,
        },
      });
      transport = { activeJobs, completedToday, awaitingPayment, documents };
    }

    return { buyer, seller, transport };
  }

  private async spawnInvoice(order: {
    id: string;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    createdById: string;
  }): Promise<void> {
    const invoiceNumber = await this.generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // Net-30 payment terms

    await this.prisma.invoice.create({
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
    });

    this.logger.log(`Invoice ${invoiceNumber} created for order ${order.id}`);
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const number = (count + 1).toString().padStart(5, '0');
    return `INV${year}${month}${number}`;
  }

  /**
   * Auto-create a MATERIAL_DELIVERY transport job linked to the order.
   * Pickup address = first item's supplier company address.
   * The job is immediately AVAILABLE on the driver job board.
   */
  private async spawnTransportJob(
    orderId: string,
    items: CreateOrderDto['items'],
    orderData: Omit<CreateOrderDto, 'items'>,
    orderTotal: number,
  ): Promise<void> {
    const firstMaterial = await this.prisma.material.findUnique({
      where: { id: items[0].materialId },
      include: {
        supplier: {
          select: {
            name: true,
            street: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
      },
    });

    if (!firstMaterial?.supplier) {
      this.logger.warn(
        `Could not find supplier for material ${items[0].materialId} — transport job skipped`,
      );
      return;
    }

    const totalWeight = items.reduce((sum, item) => sum + item.quantity, 0);
    const cargoType = firstMaterial.name;
    const pickupDate = orderData.deliveryDate
      ? new Date(orderData.deliveryDate)
      : new Date();
    const jobNumber = await this.generateTransportJobNumber();

    await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType: TransportJobType.MATERIAL_DELIVERY,
        orderId,
        pickupAddress: firstMaterial.supplier.street,
        pickupCity: firstMaterial.supplier.city,
        pickupState: firstMaterial.supplier.state ?? '',
        pickupPostal: firstMaterial.supplier.postalCode ?? '',
        pickupDate,
        deliveryAddress: orderData.deliveryAddress,
        deliveryCity: orderData.deliveryCity,
        deliveryState: orderData.deliveryState ?? '',
        deliveryPostal: orderData.deliveryPostal ?? '',
        deliveryDate: pickupDate,
        cargoType,
        cargoWeight: totalWeight,
        rate: orderTotal,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(
      `Transport job ${jobNumber} created for order ${orderId} (pickup: ${firstMaterial.supplier.city} → delivery: ${orderData.deliveryCity})`,
    );
  }

  private async generateTransportJobNumber(): Promise<string> {
    const count = await this.prisma.transportJob.count();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const number = (count + 1).toString().padStart(5, '0');
    return `TRJ${year}${month}${number}`;
  }

  // ── Disposal Order (WASTE_COLLECTION transport job) ─────────────────────────

  async createDisposalOrder(dto: any, userId: string) {
    const TRUCK_LABELS: Record<string, { label: string; capacity: number; volume: number }> = {
      TIPPER_SMALL:       { label: 'Pašizgāzējs 10t',           capacity: 10, volume: 8 },
      TIPPER_LARGE:       { label: 'Pašizgāzējs 18t',           capacity: 18, volume: 12 },
      ARTICULATED_TIPPER: { label: 'Artikulētais pašizgāzējs 26t', capacity: 26, volume: 18 },
    };

    const truck = TRUCK_LABELS[dto.truckType] ?? TRUCK_LABELS.TIPPER_LARGE;
    const totalWeight = truck.capacity * dto.truckCount;
    const jobNumber   = await this.generateTransportJobNumber();
    const pickupDate  = new Date(dto.requestedDate);

    // Find nearest recycling center that accepts this waste type
    const center = await this.prisma.recyclingCenter.findFirst({
      where: { active: true, acceptedWasteTypes: { has: dto.wasteType } },
      select: { name: true, address: true, city: true, state: true, postalCode: true },
    });

    const deliveryAddress = center?.address ?? 'Utilizācijas centrs';
    const deliveryCity    = center?.city    ?? 'TBD';
    const deliveryState   = center?.state   ?? '';
    const deliveryPostal  = center?.postalCode ?? '';

    const job = await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType:              TransportJobType.WASTE_COLLECTION,
        requestedById:        userId,   // buyer who requested the disposal
        pickupAddress:        dto.pickupAddress,
        pickupCity:           dto.pickupCity,
        pickupState:          dto.pickupState  ?? '',
        pickupPostal:         dto.pickupPostal ?? '',
        pickupDate,
        pickupLat:            dto.pickupLat  ?? null,
        pickupLng:            dto.pickupLng  ?? null,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryPostal,
        deliveryDate:         pickupDate,
        cargoType:            dto.wasteType,
        cargoWeight:          totalWeight,
        cargoVolume:          truck.volume * dto.truckCount,
        requiredVehicleType:  truck.label,
        specialRequirements:  dto.description ?? null,
        rate:                 0,
        currency:             'EUR',
        status:               TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(`Disposal job ${jobNumber} created (${dto.wasteType} × ${dto.truckCount} trucks from ${dto.pickupCity})`);
    return job;
  }

  async createFreightOrder(dto: any, userId: string) {
    const VEHICLE_LABELS: Record<string, { label: string; capacity: number; volume: number }> = {
      TIPPER_SMALL:       { label: 'Pašizgāzējs 10t',              capacity: 10, volume: 8  },
      TIPPER_LARGE:       { label: 'Pašizgāzējs 18t',              capacity: 18, volume: 12 },
      ARTICULATED_TIPPER: { label: 'Artikulētais pašizgāzējs 26t', capacity: 26, volume: 18 },
    };

    const vehicle     = VEHICLE_LABELS[dto.vehicleType] ?? VEHICLE_LABELS.TIPPER_LARGE;
    const jobNumber   = await this.generateTransportJobNumber();
    const pickupDate  = new Date(dto.requestedDate);

    const job = await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType:              TransportJobType.TRANSPORT,
        requestedById:        userId,   // buyer who requested the freight
        pickupAddress:        dto.pickupAddress,
        pickupCity:           dto.pickupCity,
        pickupState:          dto.pickupState  ?? '',
        pickupPostal:         dto.pickupPostal ?? '',
        pickupDate,
        pickupLat:            dto.pickupLat  ?? null,
        pickupLng:            dto.pickupLng  ?? null,
        deliveryAddress:      dto.dropoffAddress,
        deliveryCity:         dto.dropoffCity,
        deliveryState:        dto.dropoffState  ?? '',
        deliveryPostal:       dto.dropoffPostal ?? '',
        deliveryDate:         pickupDate,
        deliveryLat:          dto.dropoffLat  ?? null,
        deliveryLng:          dto.dropoffLng  ?? null,
        cargoType:            dto.loadDescription,
        cargoWeight:          dto.estimatedWeight ?? vehicle.capacity,
        cargoVolume:          vehicle.volume,
        requiredVehicleType:  vehicle.label,
        specialRequirements:  null,
        rate:                 0,
        currency:             'EUR',
        status:               TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(
      `Freight job ${jobNumber} created ` +
      `(${dto.pickupCity} → ${dto.dropoffCity}, ${vehicle.label})`,
    );
    return job;
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
