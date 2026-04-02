/**
 * Orders service.
 * Manages material purchase orders (buyer → supplier).
 * Handles creation, status transitions (pending → confirmed → delivered),
 * invoice generation triggers, and order history queries.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisposalOrderDto } from './dto/create-disposal-order.dto';
import { CreateFreightOrderDto } from './dto/create-freight-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateSurchargeDto } from './dto/create-surcharge.dto';
import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  TransportJobStatus,
  TransportJobType,
  Prisma,
} from '@prisma/client';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { PaymentsService } from '../payments/payments.service';
import { InvoicesService } from '../invoices/invoices.service';
import { UpdatesGateway } from '../updates/updates.gateway';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly allowedStatusTransitions: Record<
    OrderStatus,
    OrderStatus[]
  > = {
    [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [
      OrderStatus.IN_PROGRESS,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.IN_PROGRESS]: [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
    private invoices: InvoicesService,
    private updates: UpdatesGateway,
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
    const buyerCompanyId =
      currentUser.userType === 'ADMIN'
        ? orderData.buyerId
        : currentUser.companyId;

    if (!buyerCompanyId) {
      throw new BadRequestException(
        'Material orders require a buyer company linked to the authenticated user',
      );
    }

    // Delivery date must not be in the past
    if (orderData.deliveryDate) {
      const deliveryDate = new Date(orderData.deliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deliveryDate < today) {
        throw new BadRequestException('Delivery date must be today or in the future');
      }
    }

    // ── Enrich items and group by supplier ────────────────────────────────────
    type EnrichedItem = (typeof items)[0] & {
      resolvedUnitPrice: number;
      supplierId: string;
    };
    const itemsBySupplier = new Map<string, EnrichedItem[]>();
    let grandSubtotal = 0;

    for (const item of items) {
      const material = await this.prisma.material.findUnique({
        where: { id: item.materialId },
        select: { id: true, basePrice: true, supplierId: true },
      });
      if (!material) {
        throw new NotFoundException(`Material ${item.materialId} not found`);
      }
      const enriched: EnrichedItem = {
        ...item,
        resolvedUnitPrice: material.basePrice,
        supplierId: material.supplierId,
      };
      grandSubtotal += material.basePrice * item.quantity;
      if (!itemsBySupplier.has(material.supplierId)) {
        itemsBySupplier.set(material.supplierId, []);
      }
      itemsBySupplier.get(material.supplierId)!.push(enriched);
    }

    const grandTax = grandSubtotal * 0.21; // 21% VAT (Latvia)
    const grandTotal = grandSubtotal + grandTax + (orderData.deliveryFee || 0);

    // ── Credit limit check (whole cart) ──────────────────────────────────────
    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
      select: { creditLimit: true, creditUsed: true },
    });
    if (buyerProfile?.creditLimit != null) {
      const remaining =
        buyerProfile.creditLimit - (buyerProfile.creditUsed ?? 0);
      if (grandTotal > remaining) {
        throw new BadRequestException(
          `Order total €${grandTotal.toFixed(2)} exceeds your remaining credit limit of €${remaining.toFixed(2)}`,
        );
      }
    }

    // Increment credit once for the whole cart (non-blocking, best-effort)
    if (buyerProfile?.creditLimit != null) {
      this.prisma.buyerProfile
        .update({
          where: { userId },
          data: { creditUsed: { increment: grandTotal } },
        })
        .catch((err) => this.logger.error(`Failed to increment creditUsed for buyer ${userId}`, err));
    }

    // ── Create one order per supplier ─────────────────────────────────────────
    const createdOrders: Array<
      Awaited<ReturnType<OrdersService['createSupplierOrder']>>
    > = [];

    for (const [, supplierItems] of itemsBySupplier) {
      const order = await this.createSupplierOrder(
        supplierItems,
        orderData,
        buyerCompanyId,
        userId,
      );
      createdOrders.push(order);
    }

    // Single supplier: return the plain order for backward compatibility.
    // Multiple suppliers: return { orders: [...] } so clients can handle the split.
    if (createdOrders.length === 1) {
      return createdOrders[0];
    }
    return { orders: createdOrders };
  }

  /**
   * Creates one order for a single supplier's item group and fires all side-effects
   * (email, transport job, seller notifications). Extracted so `create()` can call
   * it once per supplier when the cart contains items from multiple suppliers.
   */
  private async createSupplierOrder(
    items: Array<{
      materialId: string;
      quantity: number;
      unit: any;
      unitPrice: number;
      resolvedUnitPrice: number;
      supplierId: string;
    }>,
    orderData: Omit<CreateOrderDto, 'items'>,
    buyerCompanyId: string,
    userId: string,
  ) {
    const orderNumber = await this.generateOrderNumber();
    const subtotal = items.reduce(
      (sum, i) => sum + i.resolvedUnitPrice * i.quantity,
      0,
    );
    const tax = subtotal * 0.21; // 21% VAT (Latvia)
    const total = subtotal + tax + (orderData.deliveryFee || 0);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        orderType: orderData.orderType,
        buyerId: buyerCompanyId,
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
        projectId: orderData.projectId ?? null,
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
            unitPrice: item.resolvedUnitPrice,
            total: item.resolvedUnitPrice * item.quantity,
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

    // Email (fire-and-forget)
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

    // Auto-create transport job (fire-and-forget, non-fatal)
    if (orderData.orderType === OrderType.MATERIAL && items.length > 0) {
      this.spawnTransportJob(order.id, items, orderData, total).catch((err) => {
        this.logger.error(
          `Failed to auto-create transport job for order ${order.id}:`,
          err,
        );
      });
    }

    // Notify sellers (fire-and-forget)
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
      // Push real-time event to seller's WebSocket room (fire-and-forget)
      this.updates.broadcastSellerNewOrder({ companyId: supplierId, orderId, orderNumber });

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

  async findAll(
    currentUser: RequestingUser,
    status?: OrderStatus,
    limit: number = 20,
    skip: number = 0,
  ) {
    const where = this.buildOrderWhere(currentUser, status);

    // Execute count and data queries in parallel
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
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
          linkedSkipOrder: {
            select: {
              id: true,
              orderNumber: true,
              skipSize: true,
              wasteCategory: true,
              status: true,
              deliveryDate: true,
              price: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    };
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

  private async assertOrderAccess(
    order: { id: string; createdById: string },
    currentUser: RequestingUser,
  ) {
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
        surcharges: true,
        linkedSkipOrder: {
          select: {
            id: true,
            orderNumber: true,
            skipSize: true,
            wasteCategory: true,
            status: true,
            deliveryDate: true,
            price: true,
            location: true,
          },
        },
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
    const order = await this.findOne(id, currentUser);

    if (
      currentUser.userType !== 'ADMIN' &&
      order.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException(
        'Only the buyer who created the order can update order details',
      );
    }

    const updateData: Prisma.OrderUpdateInput = {};

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
      include: {
        invoices: { select: { id: true } },
        createdBy: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    if (order.status === status) {
      return order;
    }

    const allowedTargets = this.allowedStatusTransitions[order.status] ?? [];
    if (!allowedTargets.includes(status)) {
      throw new BadRequestException(
        `Invalid order status transition: ${order.status} -> ${status}`,
      );
    }

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

    // Capture payment when seller confirms the order (fire-and-forget, non-fatal)
    if (status === OrderStatus.CONFIRMED) {
      this.payments
        .capturePayment(id)
        .catch((err) =>
          this.logger.error(
            `capturePayment failed for order ${id}: ${err.message}`,
          ),
        );
    }

    // Release funds to seller/driver when order is completed (fire-and-forget, non-fatal)
    if (status === OrderStatus.COMPLETED) {
      this.payments
        .releaseFunds(id)
        .catch((err) =>
          this.logger.error(
            `releaseFunds failed for order ${id}: ${err.message}`,
          ),
        );
    }

    // Release credit and cascade-cancel transport jobs when order is cancelled
    if (status === OrderStatus.CANCELLED) {
      if (order.total) {
        this.prisma.buyerProfile
          .update({
            where: { userId: order.createdById },
            data: { creditUsed: { decrement: Number(order.total) } },
          })
          .catch((err) => this.logger.error(`Failed to release credit for buyer ${order.createdById} on order cancellation ${id}`, err));
      }

      // Cancel all transport jobs for this order that are still in a pre-delivery state
      const cancelableStatuses: TransportJobStatus[] = [
        TransportJobStatus.AVAILABLE,
        TransportJobStatus.ASSIGNED,
        TransportJobStatus.ACCEPTED,
        TransportJobStatus.EN_ROUTE_PICKUP,
        TransportJobStatus.AT_PICKUP,
        TransportJobStatus.LOADED,
        TransportJobStatus.EN_ROUTE_DELIVERY,
        TransportJobStatus.AT_DELIVERY,
      ];

      const jobsToCancel = await this.prisma.transportJob.findMany({
        where: { orderId: id, status: { in: cancelableStatuses } },
        select: { id: true, driverId: true },
      });

      if (jobsToCancel.length > 0) {
        await this.prisma.transportJob.updateMany({
          where: { orderId: id, status: { in: cancelableStatuses } },
          data: { status: TransportJobStatus.CANCELLED },
        });

        for (const job of jobsToCancel) {
          if (job.driverId) {
            this.notifications
              .create({
                userId: job.driverId,
                type: NotificationType.ORDER_CANCELLED,
                title: 'Darbs atcelts',
                message: `Pasūtījums #${order.orderNumber} ir atcelts. Jūsu transporta darbs tika atcelts.`,
                data: { orderId: id, jobId: job.id },
              })
              .catch(() => null);
          }
        }
      }
    }

    // Notify buyer of status change (fire-and-forget)
    const notifMap: Partial<
      Record<
        OrderStatus,
        { type: NotificationType; title: string; message: string }
      >
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

    // Broadcast real-time status change to subscribed clients (fire-and-forget)
    this.updates.broadcastOrderStatus({ orderId: id, status });

    // Email buyer on key status transitions (fire-and-forget)
    const buyerEmail = order.createdBy?.email;
    if (buyerEmail && (['CONFIRMED', 'DELIVERED', 'CANCELLED'] as string[]).includes(status)) {
      const buyerName = [order.createdBy?.firstName, order.createdBy?.lastName]
        .filter(Boolean)
        .join(' ');
      this.email
        .sendOrderStatusUpdate(buyerEmail, buyerName, {
          orderNumber: order.orderNumber,
          status,
        })
        .catch(() => null);
    }

    return updated;
  }

  async updateStatusAsUser(
    id: string,
    status: OrderStatus,
    currentUser: RequestingUser,
  ) {
    if (currentUser.userType === 'ADMIN') {
      return this.updateStatus(id, status);
    }

    // Ensure the order exists and caller has base visibility.
    await this.findOne(id, currentUser);

    // Confirm/start-loading are seller-side operational actions.
    if (
      status === OrderStatus.CONFIRMED ||
      status === OrderStatus.IN_PROGRESS
    ) {
      const canManageSupplierOrders = this.canManageSupplierOrder(currentUser);

      if (!canManageSupplierOrders) {
        throw new ForbiddenException(
          'Only supplier operators can confirm or start loading orders',
        );
      }

      const supplierMatchCount = await this.prisma.orderItem.count({
        where: {
          orderId: id,
          material: { supplierId: currentUser.companyId! },
        },
      });

      if (supplierMatchCount === 0) {
        throw new ForbiddenException(
          'This order does not belong to your supplier company',
        );
      }
    }

    return this.updateStatus(id, status);
  }

  private canManageSupplierOrder(currentUser: RequestingUser): boolean {
    return (
      !!currentUser.companyId &&
      (currentUser.canSell ||
        currentUser.companyRole === 'OWNER' ||
        currentUser.companyRole === 'MANAGER' ||
        currentUser.permManageOrders)
    );
  }

  async cancel(id: string, currentUser: RequestingUser) {
    const order = await this.findOne(id, currentUser);

    if (order.status === OrderStatus.CANCELLED) {
      return order; // Already cancelled — no-op, do NOT decrement credit twice
    }

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

    // Cascade-cancel any transport jobs that are still in progress
    const cancelableStatuses: TransportJobStatus[] = [
      TransportJobStatus.AVAILABLE,
      TransportJobStatus.ASSIGNED,
      TransportJobStatus.ACCEPTED,
      TransportJobStatus.EN_ROUTE_PICKUP,
      TransportJobStatus.AT_PICKUP,
      TransportJobStatus.LOADED,
      TransportJobStatus.EN_ROUTE_DELIVERY,
      TransportJobStatus.AT_DELIVERY,
    ];

    const jobsToCancel = (order.transportJobs ?? []).filter((j) =>
      cancelableStatuses.includes(j.status),
    );

    if (jobsToCancel.length > 0) {
      await this.prisma.transportJob.updateMany({
        where: { orderId: id, status: { in: cancelableStatuses } },
        data: { status: TransportJobStatus.CANCELLED },
      });

      // Notify each assigned driver
      for (const job of jobsToCancel) {
        const driverId = job.driverId ?? job.driver?.id;
        if (driverId) {
          this.notifications
            .create({
              userId: driverId,
              type: NotificationType.ORDER_CANCELLED,
              title: 'Darbs atcelts',
              message: `Pasūtījums #${order.orderNumber} ir atcelts. Jūsu transporta darbs tika atcelts.`,
              data: { orderId: id, jobId: job.id },
            })
            .catch(() => null);
        }
      }
    }

    // Release credit on cancellation
    if (order.total) {
      this.prisma.buyerProfile
        .update({
          where: { userId: order.createdById },
          data: { creditUsed: { decrement: Number(order.total) } },
        })
        .catch((err) => this.logger.error(`Failed to release credit for buyer ${order.createdById} on cancel ${id}`, err));
    }

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

  private parseDueDateFromTerms(paymentTerms?: string | null): Date {
    const now = new Date();
    if (!paymentTerms || paymentTerms === 'COD') return now;
    const match = paymentTerms.match(/NET(\d+)/i);
    if (match) {
      const days = parseInt(match[1], 10);
      return new Date(now.getTime() + days * 86_400_000);
    }
    // Default: Net-30
    return new Date(now.getTime() + 30 * 86_400_000);
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

    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId: order.createdById },
      select: { paymentTerms: true },
    });
    const dueDate = this.parseDueDateFromTerms(buyerProfile?.paymentTerms);

    const inv = await this.prisma.invoice.create({
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
      select: { id: true },
    });

    this.logger.log(`Invoice ${invoiceNumber} created for order ${order.id}`);

    // Auto-email the invoice PDF to the buyer (fire-and-forget, non-fatal)
    const buyer = await this.prisma.user.findUnique({
      where: { id: order.createdById },
      select: { email: true, firstName: true, lastName: true },
    });
    if (buyer?.email) {
      this.invoices
        .emailInvoice(
          inv.id,
          buyer.email,
          [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') ||
            buyer.email,
        )
        .catch((err) =>
          this.logger.warn(
            `Auto-email invoice ${inv.id} failed: ${(err as Error).message}`,
          ),
        );
    }
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
        // Use the explicit delivery fee as the driver rate; fall back to 0 so
        // the dispatcher can set the correct rate before dispatching.
        rate: orderData.deliveryFee ?? 0,
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

  async createDisposalOrder(dto: CreateDisposalOrderDto, userId: string) {
    const TRUCK_LABELS: Record<
      string,
      { label: string; capacity: number; volume: number }
    > = {
      TIPPER_SMALL: { label: 'Pašizgāzējs 10t', capacity: 10, volume: 8 },
      TIPPER_LARGE: { label: 'Pašizgāzējs 18t', capacity: 18, volume: 12 },
      ARTICULATED_TIPPER: {
        label: 'Artikulētais pašizgāzējs 26t',
        capacity: 26,
        volume: 18,
      },
    };

    const truck = TRUCK_LABELS[dto.truckType] ?? TRUCK_LABELS.TIPPER_LARGE;
    const totalWeight = truck.capacity * dto.truckCount;
    const jobNumber = await this.generateTransportJobNumber();
    const pickupDate = new Date(dto.requestedDate);

    // Find nearest recycling center that accepts this waste type
    const center = await this.prisma.recyclingCenter.findFirst({
      where: { active: true, acceptedWasteTypes: { has: dto.wasteType } },
      select: {
        name: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
      },
    });

    const deliveryAddress = center?.address ?? 'Utilizācijas centrs';
    const deliveryCity = center?.city ?? 'TBD';
    const deliveryState = center?.state ?? '';
    const deliveryPostal = center?.postalCode ?? '';

    const job = await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType: TransportJobType.WASTE_COLLECTION,
        requestedById: userId, // buyer who requested the disposal
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupState: dto.pickupState ?? '',
        pickupPostal: dto.pickupPostal ?? '',
        pickupDate,
        pickupLat: dto.pickupLat ?? null,
        pickupLng: dto.pickupLng ?? null,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryPostal,
        deliveryDate: pickupDate,
        cargoType: dto.wasteType,
        cargoWeight: totalWeight,
        cargoVolume: truck.volume * dto.truckCount,
        requiredVehicleType: truck.label,
        specialRequirements: dto.description ?? null,
        rate: 0,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(
      `Disposal job ${jobNumber} created (${dto.wasteType} × ${dto.truckCount} trucks from ${dto.pickupCity})`,
    );
    return job;
  }

  async createFreightOrder(dto: CreateFreightOrderDto, userId: string) {
    const VEHICLE_LABELS: Record<
      string,
      { label: string; capacity: number; volume: number }
    > = {
      TIPPER_SMALL: { label: 'Pašizgāzējs 10t', capacity: 10, volume: 8 },
      TIPPER_LARGE: { label: 'Pašizgāzējs 18t', capacity: 18, volume: 12 },
      ARTICULATED_TIPPER: {
        label: 'Artikulētais pašizgāzējs 26t',
        capacity: 26,
        volume: 18,
      },
    };

    const vehicle =
      VEHICLE_LABELS[dto.vehicleType] ?? VEHICLE_LABELS.TIPPER_LARGE;
    const jobNumber = await this.generateTransportJobNumber();
    const pickupDate = new Date(dto.requestedDate);

    const job = await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType: TransportJobType.TRANSPORT,
        requestedById: userId, // buyer who requested the freight
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupState: dto.pickupState ?? '',
        pickupPostal: dto.pickupPostal ?? '',
        pickupDate,
        pickupLat: dto.pickupLat ?? null,
        pickupLng: dto.pickupLng ?? null,
        deliveryAddress: dto.dropoffAddress,
        deliveryCity: dto.dropoffCity,
        deliveryState: dto.dropoffState ?? '',
        deliveryPostal: dto.dropoffPostal ?? '',
        deliveryDate: pickupDate,
        deliveryLat: dto.dropoffLat ?? null,
        deliveryLng: dto.dropoffLng ?? null,
        cargoType: dto.loadDescription,
        cargoWeight: dto.estimatedWeight ?? vehicle.capacity,
        cargoVolume: vehicle.volume,
        requiredVehicleType: vehicle.label,
        specialRequirements: null,
        rate: 0,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
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

  /** Add a surcharge line item to an order. Only the seller or ADMIN may do this. */
  async addSurcharge(
    orderId: string,
    dto: CreateSurchargeDto,
    currentUser: RequestingUser,
  ) {
    const order = await this.findOne(orderId, currentUser);

    // Only the seller (supplier) or ADMIN may attach surcharges
    if (
      currentUser.userType !== 'ADMIN' &&
      !currentUser.canSell
    ) {
      throw new ForbiddenException(
        'Only sellers and admins can add surcharges to an order',
      );
    }

    return this.prisma.orderSurcharge.create({
      data: {
        orderId: order.id,
        type: dto.type,
        label: dto.label,
        amount: dto.amount,
        billable: dto.billable ?? true,
      },
    });
  }

  /** Remove a surcharge line item. Only the seller or ADMIN may do this. */
  async removeSurcharge(
    orderId: string,
    surchargeId: string,
    currentUser: RequestingUser,
  ) {
    await this.findOne(orderId, currentUser);

    if (
      currentUser.userType !== 'ADMIN' &&
      !currentUser.canSell
    ) {
      throw new ForbiddenException(
        'Only sellers and admins can remove surcharges from an order',
      );
    }

    const surcharge = await this.prisma.orderSurcharge.findUnique({
      where: { id: surchargeId },
    });
    if (!surcharge || surcharge.orderId !== orderId) {
      throw new NotFoundException(`Surcharge ${surchargeId} not found on order ${orderId}`);
    }

    return this.prisma.orderSurcharge.delete({ where: { id: surchargeId } });
  }

  /**
   * Link (or unlink) a SkipHireOrder to a material Order.
   * Pass skipHireOrderId=null to remove an existing link.
   */
  async linkSkipOrder(
    orderId: string,
    skipHireOrderId: string | null,
    currentUser: RequestingUser,
  ) {
    const order = await this.findOne(orderId, currentUser);

    // Only the buyer who created the order or an admin may link
    if (
      currentUser.userType !== 'ADMIN' &&
      order.createdById !== currentUser.userId
    ) {
      throw new ForbiddenException('Only the order owner or an admin can link a skip hire order');
    }

    if (skipHireOrderId) {
      const skip = await this.prisma.skipHireOrder.findUnique({
        where: { id: skipHireOrderId },
        select: { id: true, linkedMaterialOrder: { select: { id: true } } },
      });
      if (!skip) {
        throw new NotFoundException(`SkipHireOrder ${skipHireOrderId} not found`);
      }
      if (skip.linkedMaterialOrder && skip.linkedMaterialOrder.id !== orderId) {
        throw new BadRequestException('That skip hire order is already linked to a different material order');
      }
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { linkedSkipOrderId: skipHireOrderId },
      include: {
        linkedSkipOrder: {
          select: {
            id: true,
            orderNumber: true,
            skipSize: true,
            wasteCategory: true,
            status: true,
            deliveryDate: true,
            price: true,
          },
        },
      },
    });
  }
}
