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
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisposalOrderDto } from './dto/create-disposal-order.dto';
import { CreateFreightOrderDto } from './dto/create-freight-order.dto';
import { CreateOrderDto, CreateOrderScheduleDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateSurchargeDto } from './dto/create-surcharge.dto';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
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
import { VAT_RATE } from '../common/constants/tax';
import { MaterialsService } from '../materials/materials.service';

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
    [OrderStatus.IN_PROGRESS]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
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
    private materials: MaterialsService,
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
        throw new BadRequestException(
          'Delivery date must be today or in the future',
        );
      }
    }

    // Verify the supplied projectId belongs to the buyer's own company (IDOR guard)
    if (orderData.projectId && currentUser.userType !== 'ADMIN') {
      const project = await this.prisma.project.findUnique({
        where: { id: orderData.projectId },
        select: { companyId: true },
      });
      if (!project || project.companyId !== buyerCompanyId) {
        throw new ForbiddenException('Project does not belong to your company');
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
        select: {
          id: true,
          basePrice: true,
          supplierId: true,
          active: true,
          inStock: true,
          stockQty: true,
          minOrder: true,
          maxOrder: true,
        },
      });
      if (!material) {
        throw new NotFoundException(`Material ${item.materialId} not found`);
      }
      if (!material.active || !material.inStock) {
        throw new BadRequestException(
          `Material ${item.materialId} is not available`,
        );
      }
      // Enforce stockQty when the supplier tracks it
      if (material.stockQty != null && item.quantity > material.stockQty) {
        throw new BadRequestException(
          `Insufficient stock for material ${item.materialId}: requested ${item.quantity}, available ${material.stockQty}`,
        );
      }
      if (material.minOrder != null && item.quantity < material.minOrder) {
        throw new BadRequestException(
          `Order quantity ${item.quantity} is below minimum order of ${material.minOrder} for material ${item.materialId}`,
        );
      }
      if (material.maxOrder != null && item.quantity > material.maxOrder) {
        throw new BadRequestException(
          `Order quantity ${item.quantity} exceeds maximum order of ${material.maxOrder} for material ${item.materialId}`,
        );
      }
      // Resolve volume-tier price: use the best qualifying tier, fall back to basePrice
      const tiers = await this.prisma.materialPriceTier.findMany({
        where: { materialId: item.materialId },
        select: { minQty: true, unitPrice: true },
      });
      const resolvedPrice = this.materials.resolvePrice(
        material.basePrice,
        tiers,
        item.quantity,
      );
      const enriched: EnrichedItem = {
        ...item,
        resolvedUnitPrice: resolvedPrice,
        supplierId: material.supplierId,
      };
      grandSubtotal += resolvedPrice * item.quantity;
      if (!itemsBySupplier.has(material.supplierId)) {
        itemsBySupplier.set(material.supplierId, []);
      }
      itemsBySupplier.get(material.supplierId)!.push(enriched);
    }

    const grandTax = grandSubtotal * VAT_RATE;
    const grandTotal = grandSubtotal + grandTax + (orderData.deliveryFee || 0);

    // ── Resolve payment method from buyer's payment terms ───────────────────
    // CARD = pay by card now (default for individuals and COD companies)
    // INVOICE = company has NET30/NET60 credit terms — pay via link/transfer later
    const buyerProfile = await this.prisma.buyerProfile.findUnique({
      where: { userId },
      select: { creditLimit: true, creditUsed: true, paymentTerms: true },
    });
    const paymentTerms = buyerProfile?.paymentTerms ?? null;
    const paymentMethod: PaymentMethod =
      paymentTerms && /^NET\d+$/i.test(paymentTerms)
        ? PaymentMethod.INVOICE
        : PaymentMethod.CARD;
    if (buyerProfile?.creditLimit != null) {
      // Use a raw UPDATE with a WHERE guard to atomically check + increment.
      // This prevents TOCTOU races when two orders are placed simultaneously.
      const updated = await this.prisma.$executeRaw`
        UPDATE buyer_profiles
        SET "creditUsed" = "creditUsed" + ${grandTotal}
        WHERE "userId" = ${userId}
          AND "creditLimit" IS NOT NULL
          AND ("creditLimit" - COALESCE("creditUsed", 0)) >= ${grandTotal}
      `;
      if (updated === 0) {
        const remaining =
          Number(buyerProfile.creditLimit) -
          Number(buyerProfile.creditUsed ?? 0);
        throw new BadRequestException(
          `Order total \u20ac${grandTotal.toFixed(
            2,
          )} exceeds your remaining credit limit of \u20ac${remaining.toFixed(
            2,
          )}`,
        );
      }
    }

    // ── Create one order per supplier ─────────────────────────────────────────
    // If any supplier order creation fails mid-loop we roll back the credit that
    // was already atomically incremented above, and re-throw so the caller sees
    // an error rather than a partial order state where credit is permanently consumed.
    const createdOrders: Array<
      Awaited<ReturnType<OrdersService['createSupplierOrder']>>
    > = [];

    try {
      for (const [, supplierItems] of itemsBySupplier) {
        const order = await this.createSupplierOrder(
          supplierItems,
          orderData,
          buyerCompanyId,
          userId,
          paymentMethod,
        );
        createdOrders.push(order);
      }
    } catch (err) {
      // Rollback the credit increment so the buyer isn't charged for a failed order.
      if (buyerProfile?.creditLimit != null) {
        await this.prisma.$executeRaw`
          UPDATE buyer_profiles
          SET "creditUsed" = GREATEST(0, "creditUsed" - ${grandTotal})
          WHERE "userId" = ${userId}
        `.catch((rollbackErr) => {
          this.logger.error(
            `CRITICAL: credit rollback failed for buyer ${userId} after order creation error. Manual adjustment needed. Original error: ${
              (err as Error).message
            }. Rollback error: ${(rollbackErr as Error).message}`,
          );
          // Alert admins — buyer's creditUsed may be permanently overstated
          this.prisma.user
            .findMany({ where: { userType: 'ADMIN' }, select: { id: true } })
            .then((admins) => {
              if (admins.length === 0) return;
              return this.notifications.createForMany(
                admins.map((a) => a.id),
                {
                  type: NotificationType.SYSTEM_ALERT,
                  title: '🚨 Kredīta atgriešana neizdevās',
                  message: `Pircēja ${userId} pasūtījuma izveidošana neizdevās, bet kredītu atiestatīt nevarēja. Pasūtījuma kļūda: ${
                    (err as Error).message
                  }. Rollback kļūda: ${
                    (rollbackErr as Error).message
                  }. Manuāla iejaukšanās nepieciešama.`,
                  data: { userId },
                },
              );
            })
            .catch(() => null);
        });
      }
      throw err;
    }

    // Atomically decrement stockQty for each ordered item.
    // The pre-check above guards UX; this ensures stock is actually consumed,
    // and the WHERE guard prevents going below zero under concurrent load.
    // After decrementing, flip inStock=false and notify the supplier if stockQty hits 0.
    for (const item of items) {
      this.prisma.$executeRaw`
          UPDATE materials
          SET "stockQty" = "stockQty" - ${item.quantity}
          WHERE id = ${item.materialId}
            AND "stockQty" IS NOT NULL
            AND "stockQty" >= ${item.quantity}
        `
        .then(async () => {
          const mat = await this.prisma.material.findUnique({
            where: { id: item.materialId },
            select: { stockQty: true, supplierId: true, name: true },
          });
          if (mat && mat.stockQty !== null && mat.stockQty <= 0) {
            // Flip inStock flag so the catalog hides the listing
            await this.prisma.material
              .update({
                where: { id: item.materialId },
                data: { inStock: false },
              })
              .catch((err) =>
                this.logger.warn(
                  `Failed to set inStock=false for material ${
                    item.materialId
                  }: ${(err as Error).message}`,
                ),
              );

            // Notify supplier users that this material is now out of stock
            if (mat.supplierId) {
              const suppliers = await this.prisma.user.findMany({
                where: { companyId: mat.supplierId, canSell: true },
                select: { id: true },
              });
              if (suppliers.length > 0) {
                this.notifications
                  .createForMany(
                    suppliers.map((u) => u.id),
                    {
                      type: NotificationType.SYSTEM_ALERT,
                      title: '⚠️ Materiāls izpārdots',
                      message: `"${mat.name}" krājums ir izsmelts. Listing ir paslēpts no kataloga. Atjauniniet krājumu, lai atjaunotu redzamību.`,
                      data: { materialId: item.materialId },
                    },
                  )
                  .catch(() => null);
              }
            }

            this.logger.log(
              `Material ${item.materialId} reached 0 stock — marked inStock=false`,
            );
          }
        })
        .catch((err) =>
          this.logger.warn(
            `Stock decrement failed for material ${item.materialId}: ${
              (err as Error).message
            }`,
          ),
        );
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
    paymentMethod: PaymentMethod = PaymentMethod.CARD,
  ) {
    // Retry once on unique constraint violation (P2002) — the millisecond+random
    // number generator has ~10^7 combos per month, so collisions are rare but
    // possible under concurrent load.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
    const orderNumber = this.generateOrderNumber();
    const subtotal = items.reduce(
      (sum, i) => sum + i.resolvedUnitPrice * i.quantity,
      0,
    );
    const tax = subtotal * VAT_RATE;
    const total = subtotal + tax + (orderData.deliveryFee || 0);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        orderType: orderData.orderType,
        buyerId: buyerCompanyId,
        createdById: userId,
        deliveryAddress: orderData.deliveryAddress,
        deliveryCity: orderData.deliveryCity,
        deliveryState: orderData.deliveryState ?? '',
        deliveryPostal: orderData.deliveryPostal ?? '',
        deliveryDate: orderData.deliveryDate
          ? new Date(orderData.deliveryDate)
          : undefined,
        deliveryWindow: orderData.deliveryWindow,
        deliveryFee: orderData.deliveryFee ?? 0,
        notes: orderData.notes,
        siteContactName: orderData.siteContactName,
        siteContactPhone: orderData.siteContactPhone,
        projectId: orderData.projectId ?? null,
        truckCount: orderData.truckCount ?? 1,
        truckIntervalMinutes: orderData.truckIntervalMinutes ?? null,
        subtotal,
        tax,
        total,
        currency: 'EUR',
        status: OrderStatus.PENDING,
        paymentStatus: orderData.paymentStatus || 'PENDING',
        paymentMethod,
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
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt === 0) {
          this.logger.warn(
            `Order number collision on attempt ${attempt + 1}, retrying...`,
          );
          continue;
        }
        throw err;
      }
    }
    throw new InternalServerErrorException(
      'Failed to generate a unique order number after retries',
    );
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
      this.updates.broadcastSellerNewOrder({
        companyId: supplierId,
        orderId,
        orderNumber,
      });

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
              id: true,
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
          project: {
            select: { id: true, name: true },
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
            exceptions: {
              select: {
                id: true,
                type: true,
                status: true,
                notes: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
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
        items: { select: { materialId: true, quantity: true } },
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

    // Capture payment when seller confirms the order (fire-and-forget, non-fatal).
    // INVOICE-method orders skip card capture — buyer pays via Payment Link / bank transfer.
    if (status === OrderStatus.CONFIRMED && order.paymentMethod !== PaymentMethod.INVOICE) {
      this.payments.capturePayment(id).catch(async (err) => {
        this.logger.error(
          `capturePayment failed for order ${id}: ${err.message}`,
        );

        // Notify the buyer so they can re-attempt payment
        this.notifications
          .create({
            userId: order.createdById,
            type: NotificationType.PAYMENT_RECEIVED, // closest available type
            title: '⚠️ Maksājuma iekasēšana neizdevās',
            message: `Pasūtījums #${order.orderNumber} apstiprināts, taču maksājuma iekasēšana neizdevās. Lūdzu, sazinieties ar atbalstu vai mēģiniet atkārtoti.`,
            data: { orderId: id },
          })
          .catch(() => null);

        // Alert admins for manual intervention
        const admins = await this.prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true },
        });
        if (admins.length > 0) {
          this.notifications
            .createForMany(
              admins.map((a) => a.id),
              {
                type: NotificationType.SYSTEM_ALERT,
                title: '🚨 Maksājuma iekasēšana neizdevās',
                message: `Pasūtījums #${order.orderNumber} (${id}): capturePayment kļūda — ${err.message}. Nepieciešama manuāla iejaukšanās.`,
                data: { orderId: id },
              },
            )
            .catch(() => null);
        }
      });
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
      // Also release the buyer's credit exposure now that payment has been captured
      if (order.total) {
        this.prisma.$executeRaw`
          UPDATE buyer_profiles
          SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(order.total)})
          WHERE "userId" = ${order.createdById}
        `.catch((err) =>
          this.logger.error(
            `Failed to release credit for buyer ${order.createdById} on order completion ${id}`,
            err,
          ),
        );
      }
    }

    // Release credit and cascade-cancel transport jobs when order is cancelled.
    // Use raw SQL with GREATEST(0,...) so a credit balance can never go negative
    // even if two admin/user requests race on the same order.
    if (status === OrderStatus.CANCELLED) {
      // Void / refund the Stripe PaymentIntent (fire-and-forget, non-fatal)
      this.payments
        .voidOrRefund(id)
        .catch((err) =>
          this.logger.error(
            `voidOrRefund failed on admin cancel for order ${id}: ${(err as Error).message}`,
          ),
        );

      if (order.total) {
        this.prisma.$executeRaw`
          UPDATE buyer_profiles
          SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(order.total)})
          WHERE "userId" = ${order.createdById}
        `.catch((err) =>
          this.logger.error(
            `Failed to release credit for buyer ${order.createdById} on order cancellation ${id}`,
            err,
          ),
        );
      }

      // Restore stockQty for each ordered item
      for (const item of order.items) {
        if (!item.materialId || !item.quantity) continue;
        this.prisma.$executeRaw`
          UPDATE materials
          SET "stockQty" = "stockQty" + ${item.quantity},
              "inStock" = true
          WHERE id = ${item.materialId}
            AND "stockQty" IS NOT NULL
        `.catch((err) =>
          this.logger.warn(
            `Stock restore failed for material ${item.materialId} on cancel ${id}: ${(err as Error).message}`,
          ),
        );
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
    if (
      buyerEmail &&
      (['CONFIRMED', 'DELIVERED', 'CANCELLED'] as string[]).includes(status)
    ) {
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

  /**
   * Seller-initiated cancellation.
   * A supplier can cancel only if:
   *  - They supplied at least one item in this order (access guard).
   *  - The order hasn't progressed beyond CONFIRMED with an active transport job.
   *    Once a driver has been assigned and accepted the job the supplier must
   *    escalate through support/admin instead.
   * Triggers the same cleanup flow as buyer cancel: void/refund, stock restore,
   * credit release, and buyer notification (with a distinct "seller cancelled" message).
   */
  async sellerCancel(id: string, reason: string, currentUser: RequestingUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { material: { select: { supplierId: true } } } },
        transportJobs: { select: { id: true, status: true, driverId: true } },
      },
    });

    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);

    // Access guard — seller must supply at least one item in this order
    if (currentUser.userType !== 'ADMIN') {
      if (!currentUser.canSell || !currentUser.companyId) {
        throw new ForbiddenException('Only approved sellers can cancel orders');
      }
      const suppliedByMe = order.items.some(
        (i) => i.material?.supplierId === currentUser.companyId,
      );
      if (!suppliedByMe) {
        throw new ForbiddenException('You are not a supplier on this order');
      }
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Order is already ${order.status.toLowerCase()} — cannot cancel`,
      );
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Cannot cancel an order that has already been delivered',
      );
    }

    // Block if any transport job is already past ACCEPTED (driver has loaded / is en-route)
    const blockedStatuses: TransportJobStatus[] = [
      TransportJobStatus.LOADED,
      TransportJobStatus.EN_ROUTE_DELIVERY,
      TransportJobStatus.AT_DELIVERY,
    ];
    const driverEnRoute = order.transportJobs.some((j) =>
      blockedStatuses.includes(j.status),
    );
    if (driverEnRoute) {
      throw new BadRequestException(
        'A driver has already loaded and is en-route. Contact admin support to resolve.',
      );
    }

    // Atomically mark as cancelled (guard against concurrent requests)
    const { count } = await this.prisma.order.updateMany({
      where: { id, status: { not: OrderStatus.CANCELLED } },
      data: { status: OrderStatus.CANCELLED },
    });
    if (count === 0) {
      return this.prisma.order.findUniqueOrThrow({ where: { id } });
    }

    // Cascade-cancel assigned (but not yet loaded) transport jobs
    const cancelableJobStatuses: TransportJobStatus[] = [
      TransportJobStatus.AVAILABLE,
      TransportJobStatus.ASSIGNED,
      TransportJobStatus.ACCEPTED,
      TransportJobStatus.EN_ROUTE_PICKUP,
      TransportJobStatus.AT_PICKUP,
    ];
    const jobsToCancel = order.transportJobs.filter((j) =>
      cancelableJobStatuses.includes(j.status),
    );
    if (jobsToCancel.length > 0) {
      await this.prisma.transportJob.updateMany({
        where: { orderId: id, status: { in: cancelableJobStatuses } },
        data: { status: TransportJobStatus.CANCELLED },
      });
      for (const job of jobsToCancel) {
        if (job.driverId) {
          this.notifications
            .create({
              userId: job.driverId,
              type: NotificationType.ORDER_CANCELLED,
              title: 'Darbs atcelts — piegādātājs',
              message: `Pasūtījums ir atcelts piegādātāja dēļ. Jūsu transporta darbs ir noņemts.`,
              data: { orderId: id, jobId: job.id },
            })
            .catch(() => null);
        }
      }
    }

    // Void / refund payment fire-and-forget
    this.payments
      .voidOrRefund(id)
      .catch((err) =>
        this.logger.error(
          `voidOrRefund failed on seller-cancel for order ${id}: ${
            (err as Error).message
          }`,
        ),
      );

    // Release buyer credit
    if (order.total) {
      this.prisma.$executeRaw`
        UPDATE buyer_profiles
        SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(order.total)})
        WHERE "userId" = ${order.createdById}
      `.catch((err) =>
        this.logger.error(
          `Failed to release credit on seller-cancel for buyer ${
            order.createdById
          }: ${(err as Error).message}`,
        ),
      );
    }

    // Restore stock for each item
    for (const item of order.items) {
      if (!item.materialId || !(item as any).quantity) continue;
      this.prisma.$executeRaw`
        UPDATE materials
        SET "stockQty" = "stockQty" + ${(item as any).quantity as number},
            "inStock" = true
        WHERE id = ${item.materialId} AND "stockQty" IS NOT NULL
      `.catch(() => null);
    }

    // Notify buyer with a seller-specific message
    this.notifications
      .create({
        userId: order.createdById,
        type: NotificationType.ORDER_CANCELLED,
        title: 'Pasūtījums atcelts (piegādātājs)',
        message: `Diemžēl piegādātājs atcēla jūsu pasūtījumu #${order.orderNumber}. Iemesls: ${reason}. Ja maksājums tika veikts, tas tiks atmaksāts.`,
        data: { orderId: id, reason },
      })
      .catch(() => null);

    // If the order was already confirmed or in progress, alert admins — this is
    // a supply-chain disruption the buyer cannot self-serve around.
    if (
      order.status === OrderStatus.CONFIRMED ||
      order.status === OrderStatus.IN_PROGRESS
    ) {
      this.prisma.user
        .findMany({ where: { userType: 'ADMIN' }, select: { id: true } })
        .then((admins) => {
          if (admins.length === 0) return;
          return this.notifications.createForMany(
            admins.map((a) => a.id),
            {
              type: NotificationType.SYSTEM_ALERT,
              title: '⚠️ Piegādātājs atcēla apstiprinātu pasūtījumu',
              message: `Pasūtījums #${order.orderNumber} (statuss bija ${order.status}) tika atcelts piegādātāja dēļ. Iemesls: "${reason}". Pircējs ir paziņots.`,
              data: { orderId: id, previousStatus: order.status, reason },
            },
          );
        })
        .catch((err) =>
          this.logger.error(
            `sellerCancel: failed to notify admins for order ${id}: ${
              (err as Error).message
            }`,
          ),
        );
    }

    return this.prisma.order.findUniqueOrThrow({ where: { id } });
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

    // Block non-admin cancellation once a driver has loaded the truck or is en-route
    // to the delivery point. At that stage the physical goods are in transit; only
    // admins can force a cancellation (e.g. to trigger a dispute resolution).
    if (currentUser.userType !== 'ADMIN') {
      const activeTransportStatuses: TransportJobStatus[] = [
        TransportJobStatus.LOADED,
        TransportJobStatus.EN_ROUTE_DELIVERY,
        TransportJobStatus.AT_DELIVERY,
      ];
      const hasLoadedJob = (order.transportJobs ?? []).some((j) =>
        activeTransportStatuses.includes(j.status),
      );
      if (hasLoadedJob) {
        throw new BadRequestException(
          'Cannot cancel this order — the driver has already loaded the materials and is en-route. Contact support to resolve.',
        );
      }
    }

    // Use updateMany with a status guard to atomically guard against a concurrent
    // cancel request (e.g. user double-taps, or admin and user cancel simultaneously).
    // Only the request that actually transitions the row from non-CANCELLED → CANCELLED
    // will have count > 0, ensuring credit is released exactly once.
    const { count: cancelledCount } = await this.prisma.order.updateMany({
      where: { id, status: { not: OrderStatus.CANCELLED } },
      data: { status: OrderStatus.CANCELLED },
    });

    if (cancelledCount === 0) {
      // A concurrent request already cancelled this order; return it without touching credit.
      return (await this.prisma.order.findUniqueOrThrow({
        where: { id },
      })) as typeof order;
    }

    // Void the Stripe PaymentIntent or issue a full refund depending on capture state.
    // Fire-and-forget — payment failure must never block order cancellation.
    this.payments
      .voidOrRefund(id)
      .catch((err) =>
        this.logger.error(
          `voidOrRefund failed for order ${id} during cancel: ${
            (err as Error).message
          }`,
        ),
      );

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

    // Release credit on cancellation — use raw SQL with GREATEST(0,...) as a safety
    // floor so a hypothetical double-decrement can never produce a negative balance.
    if (order.total) {
      this.prisma.$executeRaw`
        UPDATE buyer_profiles
        SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(order.total)})
        WHERE "userId" = ${order.createdById}
      `.catch((err) =>
        this.logger.error(
          `Failed to release credit for buyer ${order.createdById} on cancel ${id}`,
          err,
        ),
      );
    }

    // Restore stock for each order item so the supplier's listing reflects
    // available inventory again. Only restore if the item had a resolved quantity
    // (not disposal/freight orders that don't consume material stock).
    const items = (order as any).items as
      | Array<{ materialId?: string | null; quantity?: number | null }>
      | undefined;
    if (items?.length) {
      for (const item of items) {
        if (!item.materialId || !item.quantity) continue;
        this.prisma.$executeRaw`
          UPDATE materials
          SET "stockQty" = "stockQty" + ${item.quantity},
              "inStock" = true
          WHERE id = ${item.materialId}
            AND "stockQty" IS NOT NULL
        `.catch((err) =>
          this.logger.warn(
            `Stock restore failed for material ${
              item.materialId
            } on cancel ${id}: ${(err as Error).message}`,
          ),
        );
      }
    }

    const updated = { ...order, status: OrderStatus.CANCELLED };

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
    paymentMethod?: PaymentMethod;
  }): Promise<void> {
    // Delegate to InvoicesService so any order-creation path (direct, RFQ, etc.)
    // produces identical invoice output without duplicating the logic here.
    await this.invoices.createForOrder(
      {
        id: order.id,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        currency: order.currency,
      },
      order.createdById,
      order.paymentMethod,
    );
  }

  /**
   * Auto-create MATERIAL_DELIVERY transport jobs linked to the order.
   * When truckCount > 1, creates one job per truck, each staggered by
   * truckIntervalMinutes (default 60) from the base delivery date.
   * Pickup address = first item's supplier company address.
   * All jobs are immediately AVAILABLE on the driver job board.
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
            lat: true,
            lng: true,
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
    const baseDate = orderData.deliveryDate
      ? new Date(orderData.deliveryDate)
      : new Date();

    const truckCount = Math.max(1, orderData.truckCount ?? 1);
    const intervalMs = (orderData.truckIntervalMinutes ?? 60) * 60 * 1000;
    // Distribute weight equally across trucks
    const weightPerTruck = totalWeight / truckCount;

    // Calculate distance and driver rate from coordinates when available.
    // Fallback to the buyer-provided deliveryFee divided by trucks.
    const DELIVERY_RATE_EUR_PER_KM = 1.2;
    let distanceKm: number | null = null;
    const suppLat = firstMaterial.supplier.lat;
    const suppLng = firstMaterial.supplier.lng;
    if (
      suppLat != null &&
      suppLng != null &&
      orderData.deliveryLat != null &&
      orderData.deliveryLng != null
    ) {
      const R = 6371;
      const dLat =
        ((orderData.deliveryLat - suppLat) * Math.PI) / 180;
      const dLng =
        ((orderData.deliveryLng - suppLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((suppLat * Math.PI) / 180) *
          Math.cos((orderData.deliveryLat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      distanceKm = Math.round(
        R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
      );
    }
    const calculatedFee =
      distanceKm != null
        ? Math.round(distanceKm * DELIVERY_RATE_EUR_PER_KM * 100) / 100
        : 0;
    // Use buyer-supplied fee when it's non-zero; otherwise fall back to
    // the haversine estimate so drivers never see €0 on the job board.
    const effectiveFee =
      (orderData.deliveryFee ?? 0) > 0
        ? orderData.deliveryFee!
        : calculatedFee;
    const driverRate = effectiveFee / truckCount;

    for (let i = 0; i < truckCount; i++) {
      const jobNumber = this.generateTransportJobNumber();
      const pickupDate = new Date(baseDate.getTime() + i * intervalMs);

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
          cargoWeight: weightPerTruck,
          rate: driverRate,
          currency: 'EUR',
          status: TransportJobStatus.AVAILABLE,
          ...(truckCount > 1 ? { truckIndex: i + 1 } : {}),
          // Geo coordinates for map display and radius filtering
          ...(suppLat != null && suppLng != null
            ? { pickupLat: suppLat, pickupLng: suppLng }
            : {}),
          ...(orderData.deliveryLat != null && orderData.deliveryLng != null
            ? {
                deliveryLat: orderData.deliveryLat,
                deliveryLng: orderData.deliveryLng,
              }
            : {}),
          ...(distanceKm != null ? { distanceKm } : {}),
        },
      });

      this.logger.log(
        `Transport job ${jobNumber} created for order ${orderId} — truck ${
          i + 1
        }/${truckCount}` +
          ` (pickup: ${firstMaterial.supplier.city} → delivery: ${orderData.deliveryCity}` +
          (truckCount > 1 ? `, departure: ${pickupDate.toISOString()}` : '') +
          `)`,
      );
    }
  }

  private generateTransportJobNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `TRJ${year}${month}${ms}${rand}`;
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
    const jobNumber = this.generateTransportJobNumber();
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

    if (!center) {
      throw new BadRequestException(
        `No active recycling center found that accepts waste type "${dto.wasteType}". Please contact support.`,
      );
    }

    const deliveryAddress = center.address;
    const deliveryCity = center.city;
    const deliveryState = center.state ?? '';
    const deliveryPostal = center.postalCode ?? '';

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
        rate: dto.quotedRate ?? 0,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(
      `Disposal job ${jobNumber} created (${dto.wasteType} × ${dto.truckCount} trucks from ${dto.pickupCity})`,
    );

    // Generate invoice + Stripe Payment Link for the quoted rate (fire-and-forget)
    this.invoices
      .createForCallOff({
        id: job.id,
        jobNumber: job.jobNumber,
        rate: dto.quotedRate ?? 0,
        currency: 'EUR',
        requestedById: userId,
      })
      .catch((err) =>
        this.logger.error(
          `Invoice creation failed for disposal job ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    // Notify all active drivers about the new job (fire-and-forget)
    this.notifyActiveDrivers(
      `🗑️ Jauns atkritumu izvešanas darbs: ${dto.pickupCity}`,
      `${dto.wasteType} × ${dto.truckCount} transportlīdzekļi`,
    ).catch((err) =>
      this.logger.error(err instanceof Error ? err.message : String(err)),
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
        volume: 22,
      },
      FLATBED: { label: 'Platforma 20t', capacity: 20, volume: 0 },
      BOX_TRUCK: { label: 'Kravas furgons 3.5t', capacity: 3.5, volume: 20 },
    };

    const vehicle =
      VEHICLE_LABELS[dto.vehicleType] ?? VEHICLE_LABELS.TIPPER_LARGE;
    const jobNumber = this.generateTransportJobNumber();
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
        rate: dto.quotedRate,
        buyerOfferedRate: dto.buyerOfferedRate ?? null,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
      },
    });

    this.logger.log(
      `Freight job ${jobNumber} created ` +
        `(${dto.pickupCity} → ${dto.dropoffCity}, ${vehicle.label})`,
    );

    // Generate invoice + Stripe Payment Link for the quoted rate (fire-and-forget)
    this.invoices
      .createForCallOff({
        id: job.id,
        jobNumber: job.jobNumber,
        rate: dto.quotedRate,
        currency: 'EUR',
        requestedById: userId,
      })
      .catch((err) =>
        this.logger.error(
          `Invoice creation failed for freight job ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );

    // Notify all active drivers about the new job (fire-and-forget)
    this.notifyActiveDrivers(
      `🚚 Jauns kravas pārvadājuma darbs: ${dto.pickupCity} → ${dto.dropoffCity}`,
      `${dto.loadDescription ?? vehicle.label}`,
    ).catch((err) =>
      this.logger.error(err instanceof Error ? err.message : String(err)),
    );

    return job;
  }

  private async notifyActiveDrivers(title: string, message: string) {
    const drivers = await this.prisma.user.findMany({
      where: { canTransport: true, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifications.createForMany(
      drivers.map((d) => d.id),
      { type: NotificationType.SYSTEM_ALERT, title, message },
    );
  }

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `ORD${year}${month}${ms}${rand}`;
  }

  /** Add a surcharge line item to an order. Only the seller or ADMIN may do this. */
  async addSurcharge(
    orderId: string,
    dto: CreateSurchargeDto,
    currentUser: RequestingUser,
  ) {
    const order = await this.findOne(orderId, currentUser);

    // Only the seller (supplier) or ADMIN may attach surcharges
    if (currentUser.userType !== 'ADMIN' && !currentUser.canSell) {
      throw new ForbiddenException(
        'Only sellers and admins can add surcharges to an order',
      );
    }

    const surcharge = await this.prisma.orderSurcharge.create({
      data: {
        orderId: order.id,
        type: dto.type,
        label: dto.label,
        amount: dto.amount,
        billable: dto.billable ?? true,
      },
    });

    // Sync the Stripe PaymentIntent to the new order total (base + all billable surcharges)
    if (surcharge.billable) {
      const allBillable = await this.prisma.orderSurcharge.aggregate({
        where: { orderId: order.id, billable: true },
        _sum: { amount: true },
      });
      const newTotal = order.total + (allBillable._sum.amount ?? 0);
      await this.payments.updatePaymentIntentAmount(order.id, newTotal);
    }

    return surcharge;
  }

  /** Remove a surcharge line item. Only the seller or ADMIN may do this. */
  async removeSurcharge(
    orderId: string,
    surchargeId: string,
    currentUser: RequestingUser,
  ) {
    const order = await this.findOne(orderId, currentUser);

    if (currentUser.userType !== 'ADMIN' && !currentUser.canSell) {
      throw new ForbiddenException(
        'Only sellers and admins can remove surcharges from an order',
      );
    }

    const surcharge = await this.prisma.orderSurcharge.findUnique({
      where: { id: surchargeId },
    });
    if (!surcharge || surcharge.orderId !== orderId) {
      throw new NotFoundException(
        `Surcharge ${surchargeId} not found on order ${orderId}`,
      );
    }

    await this.prisma.orderSurcharge.delete({ where: { id: surchargeId } });

    // If the removed surcharge was billable, recalculate the Stripe PaymentIntent amount
    if (surcharge.billable) {
      const allBillable = await this.prisma.orderSurcharge.aggregate({
        where: { orderId, billable: true },
        _sum: { amount: true },
      });
      const newTotal = order.total + (allBillable._sum.amount ?? 0);
      await this.payments.updatePaymentIntentAmount(orderId, newTotal);
    }

    return { deleted: true };
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
      throw new ForbiddenException(
        'Only the order owner or an admin can link a skip hire order',
      );
    }

    if (skipHireOrderId) {
      const skip = await this.prisma.skipHireOrder.findUnique({
        where: { id: skipHireOrderId },
        select: { id: true, linkedMaterialOrder: { select: { id: true } } },
      });
      if (!skip) {
        throw new NotFoundException(
          `SkipHireOrder ${skipHireOrderId} not found`,
        );
      }
      if (skip.linkedMaterialOrder && skip.linkedMaterialOrder.id !== orderId) {
        throw new BadRequestException(
          'That skip hire order is already linked to a different material order',
        );
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

  // ─── Scheduled tasks ─────────────────────────────────────────────────────────

  /**
   * Auto-complete orders that have been DELIVERED for more than 24 hours without
   * a buyer dispute. This fires releaseFunds() and pays the seller + driver.
   *
   * Construction logistics norm: if the buyer hasn't raised a complaint within
   * 24 hours of the ePOD being accepted, the delivery is considered accepted.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCompleteDeliveredOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000); // 24 hrs ago

    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        updatedAt: { lt: cutoff },
        // Do not auto-complete orders with an open or under-review dispute.
        // Funds must not be released until the dispute is resolved by admin.
        NOT: {
          dispute: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        },
      },
      select: { id: true, orderNumber: true, total: true, createdById: true },
    });

    if (stale.length === 0) return;

    for (const order of stale) {
      try {
        const { count } = await this.prisma.order.updateMany({
          where: { id: order.id, status: OrderStatus.DELIVERED },
          data: { status: OrderStatus.COMPLETED },
        });

        if (count === 0) continue; // Concurrent update or dispute moved it away
        // Release funds — fire-and-forget, non-fatal
        this.payments
          .releaseFunds(order.id)
          .catch((err) =>
            this.logger.error(
              `autoComplete: releaseFunds failed for order ${order.id}: ${
                (err as Error).message
              }`,
            ),
          );
        // Release buyer credit exposure
        if (order.total) {
          this.prisma.$executeRaw`
            UPDATE buyer_profiles
            SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(
              order.total,
            )})
            WHERE "userId" = ${order.createdById}
          `.catch((err) =>
            this.logger.error(
              `autoComplete: credit release failed for order ${order.id}: ${
                (err as Error).message
              }`,
            ),
          );
        }
        this.logger.log(
          `autoCompleteDeliveredOrders: order ${order.orderNumber} auto-completed`,
        );
      } catch (err) {
        this.logger.error(
          `autoCompleteDeliveredOrders: failed for order ${order.id}: ${
            (err as Error).message
          }`,
        );
      }
    }
  }

  /**
   * Auto-cancel orders that have been PENDING (awaiting seller confirmation) for
   * more than 48 hours. In construction logistics a supplier is expected to
   * confirm or reject within one working day. After 48h with no action:
   *   - Order → CANCELLED
   *   - Stripe PaymentIntent → voided/refunded
   *   - Buyer credit → released
   *   - Buyer notified
   *
   * This prevents funds from being held indefinitely on Stripe for orders that
   * will never be fulfilled.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async autoCancelStalePendingOrders(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1_000); // 48 hrs ago

    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        orderNumber: true,
        createdById: true,
        total: true,
        items: { select: { materialId: true, quantity: true } },
      },
    });

    if (stale.length === 0) return;

    for (const order of stale) {
      try {
        const { count } = await this.prisma.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING },
          data: { status: OrderStatus.CANCELLED },
        });

        if (count === 0) continue; // Concurrent update beat us

        // Void the Stripe PaymentIntent (fire-and-forget)
        this.payments
          .voidOrRefund(order.id)
          .catch((err) =>
            this.logger.error(
              `autoCancelStale: voidOrRefund failed for order ${order.id}: ${
                (err as Error).message
              }`,
            ),
          );

        // Release buyer credit
        if (order.total) {
          this.prisma.$executeRaw`
            UPDATE buyer_profiles
            SET "creditUsed" = GREATEST(0, "creditUsed" - ${Number(
              order.total,
            )})
            WHERE "userId" = ${order.createdById}
          `.catch((err) =>
            this.logger.error(
              `autoCancelStale: credit release failed for order ${order.id}: ${
                (err as Error).message
              }`,
            ),
          );
        }

        // Restore stockQty for each ordered item
        for (const item of order.items) {
          if (!item.materialId || !item.quantity) continue;
          this.prisma.$executeRaw`
            UPDATE materials
            SET "stockQty" = "stockQty" + ${item.quantity},
                "inStock" = true
            WHERE id = ${item.materialId}
              AND "stockQty" IS NOT NULL
          `.catch(() => null);
        }

        // Notify buyer
        this.notifications
          .create({
            userId: order.createdById,
            type: NotificationType.ORDER_CANCELLED,
            title: 'Pasūtījums atcelts',
            message: `Pasūtījums #${order.orderNumber} tika automātiski atcelts, jo piegādātājs 48 stundu laikā neapstiprināja pasūtījumu.`,
            data: { orderId: order.id },
          })
          .catch(() => null);

        this.logger.log(
          `autoCancelStalePendingOrders: order ${order.orderNumber} auto-cancelled (no seller response in 48h)`,
        );
      } catch (err) {
        this.logger.error(
          `autoCancelStalePendingOrders: failed for order ${order.id}: ${
            (err as Error).message
          }`,
        );
      }
    }
  }

  // ─── Recurring order schedules ─────────────────────────────────────────────

  async createSchedule(
    dto: CreateOrderScheduleDto,
    currentUser: RequestingUser,
  ) {
    const nextRunAt = dto.nextRunAt
      ? new Date(dto.nextRunAt)
      : new Date(Date.now() + 86_400_000); // default: tomorrow
    return this.prisma.orderSchedule.create({
      data: {
        createdById: currentUser.id,
        orderType: dto.orderType,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryState: dto.deliveryState,
        deliveryPostal: dto.deliveryPostal,
        deliveryWindow: dto.deliveryWindow,
        deliveryFee: dto.deliveryFee ?? 0,
        notes: dto.notes,
        siteContactName: dto.siteContactName,
        siteContactPhone: dto.siteContactPhone,
        projectId: dto.projectId,
        itemsSnapshot: dto.items as object,
        intervalDays: dto.intervalDays,
        nextRunAt,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        enabled: true,
      },
    });
  }

  async getMySchedules(currentUser: RequestingUser) {
    return this.prisma.orderSchedule.findMany({
      where: { createdById: currentUser.id },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  async pauseSchedule(scheduleId: string, currentUser: RequestingUser) {
    const schedule = await this.prisma.orderSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (
      schedule.createdById !== currentUser.id &&
      currentUser.userType !== 'ADMIN'
    ) {
      throw new ForbiddenException('Not your schedule');
    }
    return this.prisma.orderSchedule.update({
      where: { id: scheduleId },
      data: { enabled: false },
    });
  }

  async resumeSchedule(scheduleId: string, currentUser: RequestingUser) {
    const schedule = await this.prisma.orderSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (
      schedule.createdById !== currentUser.id &&
      currentUser.userType !== 'ADMIN'
    ) {
      throw new ForbiddenException('Not your schedule');
    }
    return this.prisma.orderSchedule.update({
      where: { id: scheduleId },
      data: { enabled: true },
    });
  }

  async deleteSchedule(scheduleId: string, currentUser: RequestingUser) {
    const schedule = await this.prisma.orderSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');
    if (
      schedule.createdById !== currentUser.id &&
      currentUser.userType !== 'ADMIN'
    ) {
      throw new ForbiddenException('Not your schedule');
    }
    return this.prisma.orderSchedule.delete({ where: { id: scheduleId } });
  }

  /**
   * Runs every day at 06:00 to spawn orders from active schedules.
   * For each due schedule, creates an MATERIAL order, advances nextRunAt,
   * and disables the schedule if endsAt is passed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runScheduledOrders(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.orderSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      include: { createdBy: true },
    });

    for (const schedule of due) {
      try {
        const items = schedule.itemsSnapshot as {
          materialId: string;
          quantity: number;
          unit: string;
        }[];
        // Resolve delivery date = nextRunAt date
        const deliveryDate = schedule.nextRunAt.toISOString().split('T')[0];
        const requestingUser: RequestingUser = {
          id: schedule.createdById,
          userId: schedule.createdById,
          userType: schedule.createdBy.userType as 'BUYER',
          isCompany: schedule.createdBy.isCompany,
          canSell: schedule.createdBy.canSell,
          canTransport: schedule.createdBy.canTransport,
          canSkipHire: schedule.createdBy.canSkipHire,
          companyId: schedule.createdBy.companyId ?? undefined,
          permCreateContracts: schedule.createdBy.permCreateContracts,
          permReleaseCallOffs: schedule.createdBy.permReleaseCallOffs,
          permManageOrders: schedule.createdBy.permManageOrders,
          permViewFinancials: schedule.createdBy.permViewFinancials,
          permManageTeam: schedule.createdBy.permManageTeam,
        };

        const dto: CreateOrderDto = {
          orderType: schedule.orderType as OrderType,
          deliveryAddress: schedule.deliveryAddress,
          deliveryCity: schedule.deliveryCity,
          deliveryState: schedule.deliveryState,
          deliveryPostal: schedule.deliveryPostal,
          deliveryDate,
          deliveryWindow: schedule.deliveryWindow ?? undefined,
          deliveryFee: schedule.deliveryFee,
          notes: schedule.notes
            ? `[Atkārtots] ${schedule.notes}`
            : '[Atkārtots pasūtījums]',
          siteContactName: schedule.siteContactName ?? undefined,
          siteContactPhone: schedule.siteContactPhone ?? undefined,
          projectId: schedule.projectId ?? undefined,
          items: items.map((i) => ({
            materialId: i.materialId,
            quantity: i.quantity,
            unit: i.unit as import('@prisma/client').MaterialUnit,
            unitPrice: 0, // resolved during create()
          })),
        };

        const order = await this.create(dto, requestingUser);
        // Link order back to schedule
        await this.prisma.order.update({
          where: { id: (order as any).id },
          data: { scheduleId: schedule.id },
        });

        // Advance nextRunAt
        const nextRun = new Date(
          schedule.nextRunAt.getTime() + schedule.intervalDays * 86_400_000,
        );
        const shouldDisable =
          schedule.endsAt != null && nextRun > schedule.endsAt;
        await this.prisma.orderSchedule.update({
          where: { id: schedule.id },
          data: { nextRunAt: nextRun, enabled: !shouldDisable },
        });

        this.logger.log(
          `runScheduledOrders: spawned order from schedule ${schedule.id}`,
        );
      } catch (err) {
        this.logger.error(
          `runScheduledOrders: failed for schedule ${schedule.id}: ${
            (err as Error).message
          }`,
        );
        // Notify buyer so they can investigate
        this.notifications
          .create({
            userId: schedule.createdById,
            type: NotificationType.SYSTEM_ALERT,
            title: 'Atkārtots pasūtījums neizdevās',
            message: `Automātiskais pasūtījums neizdevās: ${(err as Error).message}. Grafiks tika apturēts — pārbaudiet savus pasūtījumu iestatījumus.`,
            data: { scheduleId: schedule.id },
          })
          .catch(() => null);
        // Pause the schedule to prevent repeated failures
        this.prisma.orderSchedule
          .update({
            where: { id: schedule.id },
            data: { enabled: false },
          })
          .catch(() => null);
      }
    }
  }
}
