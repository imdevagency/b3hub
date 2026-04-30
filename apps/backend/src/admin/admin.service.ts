/**
 * Admin service.
 * Platform-level operations: list/approve/suspend users, view all orders,
 * review provider applications, and retrieve aggregated statistics.
 * All methods are restricted to ADMIN userType.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TransportJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private userSelect = {
    id: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    userType: true,
    status: true,
    canSell: true,
    canTransport: true,
    canSkipHire: true,
    companyRole: true,
    emailVerified: true,
    createdAt: true,
    company: { select: { id: true, name: true } },
    buyerProfile: {
      select: { creditLimit: true, creditUsed: true, paymentTerms: true },
    },
  } as const;

  async getUsers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        select: this.userSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.userSelect,
        company: {
          select: {
            id: true, name: true, legalName: true, companyType: true,
            verified: true, payoutEnabled: true, commissionRate: true,
          },
        },
        ordersCreated: {
          select: { id: true, orderNumber: true, status: true, total: true, currency: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getCompanyById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true, name: true, legalName: true, companyType: true,
        email: true, phone: true, city: true, country: true, street: true,
        registrationNum: true, taxId: true,
        verified: true, payoutEnabled: true, commissionRate: true,
        createdAt: true,
        users: {
          select: { id: true, firstName: true, lastName: true, email: true, companyRole: true, status: true, canSell: true, canTransport: true },
          orderBy: { createdAt: 'asc' },
        },
        orders: {
          select: { id: true, orderNumber: true, status: true, total: true, currency: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { users: true, orders: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true, orderNumber: true, orderType: true, status: true,
        paymentStatus: true, total: true, currency: true,
        deliveryAddress: true, deliveryCity: true, deliveryDate: true,
        notes: true, createdAt: true, updatedAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true, quantity: true, unitPrice: true, total: true, unit: true,
            material: { select: { id: true, name: true, category: true } },
          },
        },
        transportJobs: {
          select: {
            id: true, jobNumber: true, status: true, jobType: true,
            pickupDate: true, deliveryDate: true, rate: true, currency: true,
            driver: { select: { id: true, firstName: true, lastName: true } },
            carrier: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getTransportJobById(id: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: {
        id: true, jobNumber: true, jobType: true, status: true,
        cargoType: true, cargoWeight: true, rate: true, pricePerTonne: true,
        currency: true, pickupAddress: true, pickupCity: true,
        deliveryAddress: true, deliveryCity: true,
        pickupDate: true, deliveryDate: true, specialRequirements: true,
        createdAt: true, updatedAt: true,
        order: { select: { id: true, orderNumber: true, status: true } },
        carrier: { select: { id: true, name: true } },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicle: { select: { id: true, make: true, model: true, licensePlate: true } },
        exceptions: {
          select: { id: true, type: true, status: true, notes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    return job;
  }

  async updateUser(id: string, data: UpdateUserDto, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userType: true,
        canSell: true,
        canTransport: true,
        canSkipHire: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    this.logger.log(`Admin ${adminId} updated user ${id}`);
    const hasCreditUpdate =
      data.creditLimit !== undefined || data.paymentTerms !== undefined;

    const capabilityChanged =
      data.canSell !== undefined ||
      data.canTransport !== undefined ||
      data.canSkipHire !== undefined ||
      data.userType !== undefined ||
      data.status !== undefined; // status change (suspend/deactivate) must also invalidate JWTs

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.canSell !== undefined && { canSell: data.canSell }),
        ...(data.canTransport !== undefined && {
          canTransport: data.canTransport,
        }),
        ...(data.canSkipHire !== undefined && {
          canSkipHire: data.canSkipHire,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.userType !== undefined && {
          userType: data.userType,
        }),
        // Invalidate in-flight JWTs when capabilities or role change.
        ...(capabilityChanged && { tokenVersion: { increment: 1 } }),
      },
      select: this.userSelect,
    });

    if (hasCreditUpdate) {
      await this.prisma.buyerProfile.upsert({
        where: { userId: id },
        create: {
          userId: id,
          creditLimit: data.creditLimit ?? null,
          paymentTerms: data.paymentTerms ?? null,
        },
        update: {
          ...(data.creditLimit !== undefined && {
            creditLimit: data.creditLimit,
          }),
          ...(data.paymentTerms !== undefined && {
            paymentTerms: data.paymentTerms,
          }),
        },
      });
      // Re-fetch with updated buyerProfile
      const result = await this.prisma.user.findUnique({
        where: { id },
        select: this.userSelect,
      });
      this.logAdminAction(adminId, 'UPDATE_USER', 'User', id, user, data).catch(
        (err) =>
          this.logger.error('logAdminAction failed', (err as Error).message),
      );
      return result;
    }

    this.logAdminAction(adminId, 'UPDATE_USER', 'User', id, user, data).catch(
      (err) =>
        this.logger.error('logAdminAction failed', (err as Error).message),
    );
    return updatedUser;
  }

  async getOrders(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        select: {
          id: true,
          orderNumber: true,
          orderType: true,
          status: true,
          paymentStatus: true,
          total: true,
          currency: true,
          deliveryCity: true,
          deliveryDate: true,
          createdAt: true,
          buyer: {
            select: { id: true, name: true, email: true },
          },
          items: { select: { id: true } },
          transportJobs: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count(),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getTransportJobs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.transportJob.findMany({
        select: {
          id: true,
          jobNumber: true,
          jobType: true,
          status: true,
          cargoType: true,
          cargoWeight: true,
          rate: true,
          pricePerTonne: true,
          currency: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          deliveryDate: true,
          createdAt: true,
          order: { select: { id: true, orderNumber: true } },
          carrier: { select: { id: true, name: true } },
          driver: { select: { id: true, firstName: true, lastName: true } },
          vehicle: {
            select: { id: true, make: true, model: true, licensePlate: true },
          },
          exceptions: { where: { status: 'OPEN' }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transportJob.count(),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getCompanies() {
    return this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        legalName: true,
        companyType: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        verified: true,
        payoutEnabled: true,
        commissionRate: true,
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCompany(
    id: string,
    data: {
      verified?: boolean;
      commissionRate?: number;
      carrierCommissionRate?: number;
      payoutEnabled?: boolean;
    },
    adminId: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        verified: true,
        commissionRate: true,
        carrierCommissionRate: true,
        payoutEnabled: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    this.logger.log(`Admin ${adminId} updated company ${id}`);
    const result = await this.prisma.company.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        legalName: true,
        companyType: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        verified: true,
        payoutEnabled: true,
        commissionRate: true,
        carrierCommissionRate: true,
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
    });
    this.logAdminAction(
      adminId,
      'UPDATE_COMPANY',
      'Company',
      id,
      company,
      data,
    ).catch((err) =>
      this.logger.error('logAdminAction failed', (err as Error).message),
    );
    return result;
  }

  async getStats() {
    const now = new Date();
    const day30ago = new Date(now);
    day30ago.setDate(day30ago.getDate() - 30);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Today's date range (midnight-to-midnight)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 30 days from now for expiry window
    const day30ahead = new Date(now);
    day30ahead.setDate(day30ahead.getDate() + 30);

    const [
      totalUsers,
      totalOrders,
      pendingApplications,
      activeJobs,
      totalCompanies,
      gmvAllTimeResult,
      gmv30dResult,
      recentOrders,
      openDisputes,
      pipelineCounts,
      todayOrders,
      openSupport,
      pendingSupplierPayouts,
      pendingCarrierPayouts,
      expiringDocumentsCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.providerApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.transportJob.count({
        where: {
          status: {
            in: [
              'ACCEPTED',
              'EN_ROUTE_PICKUP',
              'AT_PICKUP',
              'LOADED',
              'EN_ROUTE_DELIVERY',
              'AT_DELIVERY',
            ],
          },
        },
      }),
      this.prisma.company.count(),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: ['COMPLETED', 'DELIVERED'] } },
      }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { in: ['COMPLETED', 'DELIVERED'] },
          createdAt: { gte: day30ago },
        },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
      // Order pipeline: counts per active status
      this.prisma.order.groupBy({
        by: ['status'],
        where: { status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED'] } },
        _count: { id: true },
      }),
      // Today's scheduled deliveries
      this.prisma.order.findMany({
        where: {
          deliveryDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          deliveryDate: true,
          deliveryAddress: true,
          deliveryCity: true,
          buyer: { select: { name: true } },
          transportJobs: {
            where: { status: { not: 'CANCELLED' } },
            take: 1,
            select: {
              driver: { select: { firstName: true, lastName: true } },
              status: true,
            },
          },
        },
        orderBy: { deliveryDate: 'asc' },
        take: 50,
      }),
      // Open support threads
      this.prisma.supportThread.count({ where: { status: 'OPEN' } }),
      // Pending payouts
      this.prisma.supplierPayout.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where: { status: 'PENDING' },
      }),
      this.prisma.carrierPayout.aggregate({
        _count: { id: true },
        _sum: { amount: true },
        where: { status: 'PENDING' },
      }),
      // Documents expiring in next 30 days
      this.prisma.document.count({
        where: {
          expiresAt: { gte: now, lte: day30ahead },
          status: { not: 'ARCHIVED' },
        },
      }),
    ]);

    // Build last-6-month GMV + order count trend
    const monthlyMap: Record<string, { orders: number; gmv: number }> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = { orders: 0, gmv: 0 };
    }
    for (const order of recentOrders) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key]) {
        monthlyMap[key].orders++;
        monthlyMap[key].gmv += order.total;
      }
    }
    const monthlyTrends = Object.entries(monthlyMap).map(([month, v]) => ({
      month,
      orders: v.orders,
      gmv: Math.round(v.gmv * 100) / 100,
    }));

    const gmvAllTime =
      Math.round((gmvAllTimeResult._sum.total ?? 0) * 100) / 100;
    const gmv30d = Math.round((gmv30dResult._sum.total ?? 0) * 100) / 100;
    // Platform commission estimate at default 6% supplier + 8% carrier blended rate (approximation)
    const commissionEst30d = Math.round(gmv30d * 0.06 * 100) / 100;

    // Build order pipeline map
    const pipelineMap: Record<string, number> = {
      PENDING: 0, CONFIRMED: 0, IN_PROGRESS: 0, DELIVERED: 0,
    };
    for (const row of pipelineCounts) {
      pipelineMap[row.status] = row._count.id;
    }

    // Flatten today's deliveries
    const todayDeliveries = todayOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      deliveryDate: o.deliveryDate,
      deliveryAddress: `${o.deliveryAddress}, ${o.deliveryCity}`,
      buyerName: o.buyer.name,
      driverName: o.transportJobs[0]?.driver
        ? `${o.transportJobs[0].driver.firstName} ${o.transportJobs[0].driver.lastName}`
        : null,
      jobStatus: o.transportJobs[0]?.status ?? null,
    }));

    const pendingPayoutsCount =
      (pendingSupplierPayouts._count.id ?? 0) + (pendingCarrierPayouts._count.id ?? 0);
    const pendingPayoutsTotal = Math.round(
      ((pendingSupplierPayouts._sum.amount ?? 0) + (pendingCarrierPayouts._sum.amount ?? 0)) * 100,
    ) / 100;

    return {
      totalUsers,
      totalOrders,
      pendingApplications,
      activeJobs,
      totalCompanies,
      gmvAllTime,
      gmv30d,
      commissionEst30d,
      openDisputes,
      monthlyTrends,
      orderPipeline: pipelineMap,
      todayDeliveries,
      openSupport,
      pendingPayoutsCount,
      pendingPayoutsTotal,
      expiringDocumentsCount,
    };
  }

  /** GET /admin/audit-logs — recent admin actions for compliance review */
  async getAuditLogs(limit = 100) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        admin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  /**
   * Write an immutable audit record for every admin mutation.
   * Fire-and-forget — a failed write must never block the mutation itself.
   * Pass `before` = snapshot before update, `after` = the mutation payload.
   */
  logAdminAction(
    adminId: string,
    action: string,
    entityType: string,
    entityId: string,
    before?: object | null,
    after?: object | null,
    note?: string,
  ): Promise<void> {
    return this.prisma.adminAuditLog
      .create({
        data: {
          adminId,
          action,
          entityType,
          entityId,
          before: before ?? undefined,
          after: after ?? undefined,
          note: note ?? undefined,
        },
      })
      .then(() => undefined)
      .catch((err) =>
        this.logger.error(
          `Failed to write audit log for ${action} on ${entityType}:${entityId} by admin ${adminId}: ${(err as Error).message}`,
        ),
      );
  }

  /**
   * Override the rate (and optionally pricePerTonne) on a transport job.
   * Audit-logged. Only applicable to jobs that have not yet completed payout
   * (status != COMPLETED / CANCELLED).
   */
  async updateJobRate(
    jobId: string,
    data: { rate?: number; pricePerTonne?: number; note?: string },
    adminId: string,
  ) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        rate: true,
        pricePerTonne: true,
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
      throw new BadRequestException(
        `Cannot override rate on a ${job.status} job — payout may have already occurred`,
      );
    }

    const updateData: { rate?: number; pricePerTonne?: number } = {};
    if (data.rate !== undefined) updateData.rate = data.rate;
    if (data.pricePerTonne !== undefined)
      updateData.pricePerTonne = data.pricePerTonne;

    const updated = await this.prisma.transportJob.update({
      where: { id: jobId },
      data: updateData,
      select: {
        id: true,
        jobNumber: true,
        rate: true,
        pricePerTonne: true,
        status: true,
      },
    });

    await this.logAdminAction(
      adminId,
      'UPDATE_JOB_RATE',
      'TransportJob',
      jobId,
      { rate: job.rate, pricePerTonne: job.pricePerTonne },
      { rate: updated.rate, pricePerTonne: updated.pricePerTonne },
      data.note,
    );

    return updated;
  }

  /** GET /admin/materials — all material listings across all suppliers */
  async getMaterials() {
    return this.prisma.material.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        subCategory: true,
        basePrice: true,
        unit: true,
        currency: true,
        inStock: true,
        stockQty: true,
        active: true,
        isRecycled: true,
        createdAt: true,
        supplier: { select: { id: true, name: true, verified: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * PATCH /admin/materials/:id — toggle active flag.
   * Deactivating pulls the listing from the buyer catalog immediately.
   * Audit-logged.
   */
  async setMaterialActive(id: string, active: boolean, adminId: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: { id: true, name: true, active: true },
    });
    if (!material) throw new NotFoundException('Material not found');

    const updated = await this.prisma.material.update({
      where: { id },
      data: { active },
      select: { id: true, name: true, active: true },
    });

    await this.logAdminAction(
      adminId,
      active ? 'MATERIAL_REACTIVATED' : 'MATERIAL_DEACTIVATED',
      'Material',
      id,
      { active: material.active },
      { active: updated.active },
    );

    return updated;
  }

  /** GET /admin/payments — full payment pipeline view (last 500 records) */
  async getPaymentQueue() {
    const payments = await this.prisma.payment.findMany({
      select: {
        id: true,
        amount: true,
        sellerPayout: true,
        driverPayout: true,
        platformFee: true,
        status: true,
        currency: true,
        payseraOrderId: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            buyer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return payments;
  }

  /**
   * PATCH /admin/payments/:id/release
   * Manually trigger fund release for a CAPTURED payment.
   * Used when automatic release didn't fire (e.g. Stripe webhook missed).
   */
  async releasePayment(paymentId: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        orderId: true,
        order: { select: { orderNumber: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'RELEASED')
      throw new BadRequestException('Payment already released');
    if (payment.status !== 'CAPTURED')
      throw new BadRequestException(
        `Cannot release payment in status ${payment.status}`,
      );
    if (!payment.orderId)
      throw new BadRequestException(
        'Payment has no linked order — manual Stripe transfer required',
      );

    this.logger.log(
      `Admin ${adminId} manually releasing payment ${paymentId} for order ${payment.orderId}`,
    );
    await this.paymentsService.releaseFunds(payment.orderId);
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'RELEASE_PAYMENT',
        entityType: 'Payment',
        entityId: paymentId,
        note: `Manual release triggered for order ${payment.order?.orderNumber ?? payment.orderId}`,
      },
    });
    return { ok: true, paymentId };
  }

  /**
   * GET /admin/sla
   * Orders stuck in PENDING or CONFIRMED for more than the SLA threshold (hours).
   * Default thresholds: PENDING > 4h, CONFIRMED > 24h.
   */
  async getSlaOrders() {
    const now = new Date();
    const pendingThreshold = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours
    const confirmedThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

    const orders = await this.prisma.order.findMany({
      where: {
        OR: [
          { status: 'PENDING', updatedAt: { lt: pendingThreshold } },
          { status: 'CONFIRMED', updatedAt: { lt: confirmedThreshold } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderType: true,
        total: true,
        currency: true,
        deliveryCity: true,
        createdAt: true,
        updatedAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        transportJobs: { select: { id: true, status: true } },
      },
      orderBy: { updatedAt: 'asc' }, // oldest first — highest urgency
    });

    return orders.map((o) => ({
      ...o,
      ageHours: Math.floor(
        (now.getTime() - new Date(o.updatedAt).getTime()) / 3_600_000,
      ),
    }));
  }

  /**
   * GET /admin/supplier-performance
   * Per-supplier metrics: order count, acceptance rate, dispute rate, GMV.
   */
  async getSupplierPerformance() {
    const suppliers = await this.prisma.company.findMany({
      where: { companyType: { in: ['SUPPLIER', 'HYBRID', 'RECYCLER'] } },
      select: {
        id: true,
        name: true,
        city: true,
        verified: true,
        commissionRate: true,
        createdAt: true,
        orders: {
          select: {
            id: true,
            status: true,
            total: true,
            paymentStatus: true,
            dispute: { select: { id: true, status: true } },
          },
        },
        materials: {
          select: { id: true, active: true },
        },
      },
    });

    return suppliers.map((s) => {
      const total = s.orders.length;
      const completed = s.orders.filter((o) => o.status === 'COMPLETED').length;
      const cancelled = s.orders.filter((o) => o.status === 'CANCELLED').length;
      const gmv = s.orders
        .filter((o) =>
          ['COMPLETED', 'IN_PROGRESS', 'DELIVERED'].includes(o.status),
        )
        .reduce((sum, o) => sum + (o.total ?? 0), 0);
      const allDisputes = s.orders
        .filter((o) => o.dispute != null)
        .map((o) => o.dispute!);
      const openDisputes = allDisputes.filter((d) =>
        ['OPEN', 'UNDER_REVIEW'].includes(d.status),
      ).length;
      const disputeRate =
        total > 0 ? Math.round((allDisputes.length / total) * 100) : 0;
      const completionRate =
        total > 0 ? Math.round((completed / total) * 100) : 0;
      const activeMaterials = s.materials.filter((m) => m.active).length;

      return {
        id: s.id,
        name: s.name,
        city: s.city,
        verified: s.verified,
        commissionRate: s.commissionRate,
        createdAt: s.createdAt,
        totalOrders: total,
        completedOrders: completed,
        cancelledOrders: cancelled,
        completionRate,
        gmv,
        openDisputes,
        disputeRate,
        activeMaterials,
      };
    });
  }

  /** GET /admin/surcharges — surcharges pending admin approval */
  async getPendingSurcharges() {
    return this.prisma.orderSurcharge.findMany({
      where: { approvalStatus: 'PENDING' },
      select: {
        id: true,
        type: true,
        label: true,
        amount: true,
        currency: true,
        billable: true,
        approvalStatus: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            buyer: { select: { id: true, name: true } },
          },
        },
        transportJob: {
          select: {
            id: true,
            jobNumber: true,
            driver: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** PATCH /admin/surcharges/:id/approve */
  async approveSurcharge(surchargeId: string, adminId: string) {
    const surcharge = await this.prisma.orderSurcharge.findUnique({
      where: { id: surchargeId },
    });
    if (!surcharge) throw new NotFoundException('Surcharge not found');
    if (surcharge.approvalStatus !== 'PENDING')
      throw new BadRequestException('Surcharge is not pending approval');

    const updated = await this.prisma.orderSurcharge.update({
      where: { id: surchargeId },
      data: {
        approvalStatus: 'APPROVED',
        approvedByAdminId: adminId,
        approvedAt: new Date(),
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'APPROVE_SURCHARGE',
        entityType: 'OrderSurcharge',
        entityId: surchargeId,
        note: `Approved surcharge: ${surcharge.label} €${surcharge.amount}`,
      },
    });

    return updated;
  }

  /** PATCH /admin/surcharges/:id/reject */
  async rejectSurcharge(surchargeId: string, note: string, adminId: string) {
    const surcharge = await this.prisma.orderSurcharge.findUnique({
      where: { id: surchargeId },
    });
    if (!surcharge) throw new NotFoundException('Surcharge not found');
    if (surcharge.approvalStatus !== 'PENDING')
      throw new BadRequestException('Surcharge is not pending approval');

    const updated = await this.prisma.orderSurcharge.update({
      where: { id: surchargeId },
      data: {
        approvalStatus: 'REJECTED',
        approvedByAdminId: adminId,
        approvedAt: new Date(),
        rejectionNote: note || 'Noraidīts bez piezīmes',
      },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'REJECT_SURCHARGE',
        entityType: 'OrderSurcharge',
        entityId: surchargeId,
        note: `Rejected surcharge: ${surcharge.label} €${surcharge.amount}. Reason: ${note}`,
      },
    });

    return updated;
  }

  // ── Operational response tools ────────────────────────────────────────────

  /**
   * POST /admin/orders/:id/cancel
   * Force-cancel an order regardless of current status.
   * Triggers voidOrRefund so the buyer is never left charged for a cancelled order.
   * Audit-logged.
   */
  /**
   * PATCH /admin/jobs/:id/force-status
   * Override a transport job's status — for stuck jobs or dispute resolution.
   * Audit-logged. Does NOT trigger any payout.
   */
  async forceJobStatus(
    jobId: string,
    status: string,
    reason: string,
    adminId: string,
  ) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      select: { id: true, jobNumber: true, status: true },
    });
    if (!job) throw new NotFoundException('Transport job not found');

    const VALID_STATUSES = [
      'AVAILABLE',
      'ASSIGNED',
      'ACCEPTED',
      'EN_ROUTE_PICKUP',
      'AT_PICKUP',
      'LOADED',
      'EN_ROUTE_DELIVERY',
      'AT_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ];
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const updated = await this.prisma.transportJob.update({
      where: { id: jobId },
      data: {
        status: status as never,
        statusUpdatedAt: new Date(),
      },
      select: { id: true, jobNumber: true, status: true, statusUpdatedAt: true },
    });

    await this.logAdminAction(
      adminId,
      'FORCE_JOB_STATUS',
      'TransportJob',
      jobId,
      { status: job.status },
      { status: updated.status },
      reason,
    );

    return updated;
  }

  /**
   * PATCH /admin/orders/:id/status
   * Force an order into a specific status — for resolving stuck or disputed orders.
   * Audit-logged.
   */
  async forceOrderStatus(
    orderId: string,
    status: string,
    reason: string,
    adminId: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const VALID_STATUSES = [
      'DRAFT',
      'PENDING',
      'CONFIRMED',
      'IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
    ];
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: status as never },
      select: { id: true, orderNumber: true, status: true, updatedAt: true },
    });

    await this.logAdminAction(
      adminId,
      'FORCE_ORDER_STATUS',
      'Order',
      orderId,
      { status: order.status },
      { status: updated.status },
      reason,
    );

    return updated;
  }

  async cancelOrder(orderId: string, reason: string, adminId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'CANCELLED')
      throw new BadRequestException('Order is already cancelled');

    // Void or refund via PaymentsService (non-fatal — cancellation must always succeed)
    try {
      await this.paymentsService.voidOrRefund(orderId);
    } catch (err) {
      this.logger.error(
        `voidOrRefund failed during admin cancel of order ${orderId}: ${(err as Error).message}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
      },
    });

    await this.logAdminAction(
      adminId,
      'CANCEL_ORDER',
      'Order',
      orderId,
      { status: order.status },
      { status: 'CANCELLED' },
      reason,
    );

    return updated;
  }

  /**
   * POST /admin/payments/:id/refund
   * Issue a full refund for a CAPTURED or PAID payment.
   * Delegates to voidOrRefund (which handles both Stripe refund and void flows).
   * Audit-logged.
   */
  async refundPayment(paymentId: string, reason: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        orderId: true,
        order: { select: { orderNumber: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!['CAPTURED', 'PAID'].includes(payment.status))
      throw new BadRequestException(
        `Cannot refund payment in status ${payment.status}. Only CAPTURED or PAID payments can be refunded.`,
      );
    if (!payment.orderId)
      throw new BadRequestException(
        'Payment has no linked order — manual Stripe refund required via Stripe dashboard',
      );

    await this.paymentsService.voidOrRefund(payment.orderId);

    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'REFUND_PAYMENT',
        entityType: 'Payment',
        entityId: paymentId,
        note: `Manual admin refund for order ${payment.order?.orderNumber ?? payment.orderId}. Reason: ${reason}`,
      },
    });

    return { ok: true, paymentId, orderId: payment.orderId };
  }

  /**
   * PATCH /admin/jobs/:id/reassign
   * Force-reassign a transport job to a different driver.
   * Blocked for COMPLETED / CANCELLED jobs.
   * Audit-logged.
   */
  async reassignJob(
    jobId: string,
    driverId: string,
    adminId: string,
    note?: string,
  ) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        driverId: true,
        carrierId: true,
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    if (['COMPLETED', 'CANCELLED'].includes(job.status))
      throw new BadRequestException(
        `Cannot reassign a ${job.status} job`,
      );

    const newDriver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        canTransport: true,
        companyId: true,
      },
    });
    if (!newDriver) throw new NotFoundException('Driver not found');
    if (!newDriver.canTransport)
      throw new BadRequestException('User does not have canTransport capability');

    const updated = await this.prisma.transportJob.update({
      where: { id: jobId },
      data: {
        driverId,
        // If the new driver belongs to a different carrier, update carrierId too
        ...(newDriver.companyId &&
          newDriver.companyId !== job.carrierId && {
            carrierId: newDriver.companyId,
          }),
        status: 'ASSIGNED',
      },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        driver: { select: { id: true, firstName: true, lastName: true } },
        carrier: { select: { id: true, name: true } },
      },
    });

    await this.logAdminAction(
      adminId,
      'REASSIGN_JOB',
      'TransportJob',
      jobId,
      {
        driverId: job.driverId,
        driverName: job.driver
          ? `${job.driver.firstName} ${job.driver.lastName}`
          : null,
      },
      {
        driverId,
        driverName: `${newDriver.firstName} ${newDriver.lastName}`,
      },
      note,
    );

    return updated;
  }

  /**
   * GET /admin/skip-hire — all skip hire orders (paginated)
   */
  async getSkipHireOrders(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.skipHireOrder.findMany({
        select: {
          id: true,
          orderNumber: true,
          location: true,
          wasteCategory: true,
          skipSize: true,
          deliveryDate: true,
          hireDays: true,
          price: true,
          currency: true,
          paymentStatus: true,
          status: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          notes: true,
          carrier: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.skipHireOrder.count(),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * GET /admin/exceptions — all open transport job exceptions (paginated)
   */
  async getExceptions(page = 1, limit = 50, statusFilter?: string) {
    const skip = (page - 1) * limit;
    const where = statusFilter && statusFilter !== 'ALL'
      ? { status: statusFilter as any }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.transportJobException.findMany({
        where,
        select: {
          id: true,
          type: true,
          status: true,
          notes: true,
          photoUrls: true,
          resolution: true,
          createdAt: true,
          resolvedAt: true,
          transportJob: {
            select: {
              id: true,
              jobNumber: true,
              status: true,
              order: { select: { id: true, orderNumber: true } },
            },
          },
          reportedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          resolvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transportJobException.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * PATCH /admin/exceptions/:id/resolve
   * Mark a transport job exception as RESOLVED with a resolution note.
   * Audit-logged.
   */
  async resolveException(
    exceptionId: string,
    resolution: string,
    adminId: string,
  ) {
    const exception = await this.prisma.transportJobException.findUnique({
      where: { id: exceptionId },
      select: { id: true, status: true, type: true, transportJobId: true },
    });
    if (!exception) throw new NotFoundException('Exception not found');
    if (exception.status === 'RESOLVED')
      throw new BadRequestException('Exception is already resolved');

    const updated = await this.prisma.transportJobException.update({
      where: { id: exceptionId },
      data: {
        status: 'RESOLVED',
        resolvedById: adminId,
        resolution,
        resolvedAt: new Date(),
      },
      select: {
        id: true,
        type: true,
        status: true,
        resolution: true,
        resolvedAt: true,
        resolvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.logAdminAction(
      adminId,
      'RESOLVE_EXCEPTION',
      'TransportJobException',
      exceptionId,
      { status: exception.status },
      { status: 'RESOLVED', resolution },
    );

    return updated;
  }

  // ── Invoices (admin view) ─────────────────────────────────────────────────

  async getAllInvoices(page = 1, limit = 50, status?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where['paymentStatus'] = status;
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, orderType: true } },
          buyerCompany: { select: { id: true, name: true } },
          sellerCompany: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Framework contracts (admin view) ─────────────────────────────────────

  async getAllFrameworkContracts(page = 1, limit = 50, status?: string) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where['status'] = status;
    const [data, total] = await Promise.all([
      this.prisma.frameworkContract.findMany({
        where,
        include: {
          buyer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          positions: { select: { id: true, agreedQty: true, unitPrice: true, unit: true } },
          _count: { select: { callOffJobs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.frameworkContract.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Broadcast notification ────────────────────────────────────────────────

  async broadcastNotification(
    title: string,
    message: string,
    audience: 'ALL' | 'BUYERS' | 'SELLERS' | 'CARRIERS',
    adminId: string,
  ) {
    let where: Record<string, unknown> = {};
    if (audience === 'BUYERS') where = { userType: 'BUYER', canSell: false, canTransport: false };
    if (audience === 'SELLERS') where = { canSell: true };
    if (audience === 'CARRIERS') where = { canTransport: true };

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    const notificationData = users.map((u) => ({
      userId: u.id,
      type: 'SYSTEM_ALERT' as const,
      title,
      message,
    }));

    await this.prisma.notification.createMany({ data: notificationData });

    // Fire push notifications in background (best-effort)
    const pushRows = await this.prisma.user.findMany({
      where: { ...where, pushToken: { not: null } },
      select: { pushToken: true },
    });
    const tokens = pushRows.map((r) => r.pushToken).filter(Boolean) as string[];
    if (tokens.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));
      for (const chunk of chunks) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(chunk.map((token) => ({ to: token, sound: 'default', title, body: message }))),
        }).catch((err: Error) => this.logger.warn(`Broadcast push chunk error: ${err.message}`));
      }
    }

    await this.logAdminAction(adminId, 'BROADCAST_NOTIFICATION', 'Notification', 'bulk', {}, {
      title,
      message,
      audience,
      recipientCount: users.length,
    });

    return { sent: users.length, audience };
  }

  // ── Platform settings ───────────────────────────────────────────────────────

  /** Returns all platform settings as a plain key→value object */
  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  /** Bulk-upsert settings. Each key/value pair is upserted atomically. */
  async updateSettings(
    settings: Record<string, string>,
    adminId: string,
  ): Promise<Record<string, string>> {
    const entries = Object.entries(settings);
    await Promise.all(
      entries.map(([key, value]) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          create: { key, value, updatedBy: adminId },
          update: { value, updatedBy: adminId },
        }),
      ),
    );
    return this.getSettings();
  }

  // ── Skip size catalogue ───────────────────────────────────────────────────

  async adminListSkipSizes() {
    return this.prisma.skipSizeDefinition.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async adminUpsertSkipSize(
    code: string,
    data: {
      label?: string;
      labelLv?: string;
      volumeM3?: number;
      category?: string;
      description?: string;
      descriptionLv?: string;
      heightPct?: number;
      basePrice?: number;
      currency?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.skipSizeDefinition.upsert({
      where: { code },
      create: {
        code,
        label: data.label ?? code,
        labelLv: data.labelLv,
        volumeM3: data.volumeM3 ?? 0,
        category: (data.category as any) ?? 'SKIP',
        description: data.description,
        descriptionLv: data.descriptionLv,
        heightPct: data.heightPct ?? 0.5,
        basePrice: data.basePrice,
        currency: data.currency ?? 'EUR',
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
      update: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.labelLv !== undefined && { labelLv: data.labelLv }),
        ...(data.volumeM3 !== undefined && { volumeM3: data.volumeM3 }),
        ...(data.category !== undefined && { category: data.category as any }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.descriptionLv !== undefined && { descriptionLv: data.descriptionLv }),
        ...(data.heightPct !== undefined && { heightPct: data.heightPct }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async adminDeleteSkipSize(code: string) {
    await this.prisma.skipSizeDefinition.delete({ where: { code } });
  }

  // ── Marketplace engine overview ────────────────────────────────────────────
  /**
   * Returns everything the comparison engine needs, aggregated for admin review:
   * - All skip size definitions (CMS floor prices)
   * - All verified CARRIER/HYBRID companies with:
   *     • their CarrierPricing rows per skip size
   *     • their service zones with surcharges
   *     • whether they have a radius or national coverage
   *     • today's availability status
   */
  async adminGetMarketplace() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [sizes, carriers] = await Promise.all([
      this.prisma.skipSizeDefinition.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.company.findMany({
        where: { companyType: { in: ['CARRIER', 'HYBRID'] } },
        select: {
          id: true,
          name: true,
          logo: true,
          verified: true,
          companyType: true,
          lat: true,
          lng: true,
          serviceRadiusKm: true,
          rating: true,
          commissionRate: true,
          carrierCommissionRate: true,
          serviceZones: {
            select: { id: true, city: true, postcode: true, surcharge: true },
          },
          carrierPricing: {
            select: { skipSize: true, price: true, currency: true, updatedAt: true },
          },
          availabilityBlocks: {
            where: { blockedDate: { gte: today, lt: tomorrow } },
            select: { id: true, blockedDate: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Derive coverage type for each carrier
    const enrichedCarriers = carriers.map((c) => {
      let coverageType: 'zones' | 'radius' | 'national';
      if (c.serviceZones.length > 0) coverageType = 'zones';
      else if (c.serviceRadiusKm !== null) coverageType = 'radius';
      else coverageType = 'national';

      return {
        ...c,
        coverageType,
        blockedToday: c.availabilityBlocks.length > 0,
        // Map pricing by skipSize for quick lookup in UI
        pricingBySizeCode: Object.fromEntries(
          c.carrierPricing.map((p) => [p.skipSize, p]),
        ),
      };
    });

    return { sizes, carriers: enrichedCarriers };
  }

  // ── RFQ / Quote Requests (admin view) ────────────────────────────────────

  /** All quote requests across all buyers, newest first */
  async adminGetQuoteRequests(page = 1, limit = 50, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as never } : undefined;
    const [data, total] = await Promise.all([
      this.prisma.quoteRequest.findMany({
        where,
        include: {
          buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
          responses: {
            select: {
              id: true,
              pricePerUnit: true,
              totalPrice: true,
              unit: true,
              status: true,
              createdAt: true,
              supplier: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.quoteRequest.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Recycling centers (admin view) ────────────────────────────────────────

  /** GET /admin/recycling-centers — all centers (active and inactive) with waste record count */
  async adminGetRecyclingCenters(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.recyclingCenter.findMany({
        include: {
          company: { select: { id: true, name: true, logo: true, city: true } },
          _count: { select: { wasteRecords: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.recyclingCenter.count(),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /** PATCH /admin/recycling-centers/:id — toggle active flag */
  async adminToggleRecyclingCenter(
    id: string,
    active: boolean,
    adminId: string,
  ) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id },
      select: { id: true, name: true, active: true },
    });
    if (!center) throw new NotFoundException('Recycling center not found');

    const updated = await this.prisma.recyclingCenter.update({
      where: { id },
      data: { active },
      select: { id: true, name: true, active: true },
    });

    await this.logAdminAction(
      adminId,
      active ? 'RECYCLING_CENTER_ACTIVATED' : 'RECYCLING_CENTER_DEACTIVATED',
      'RecyclingCenter',
      id,
      { active: center.active },
      { active: updated.active },
    );

    return updated;
  }

  // ── B3 Recycling — inbound jobs & waste records (admin view) ─────────────

  /**
   * GET /admin/b3-recycling/jobs
   * All DISPOSAL orders, optionally scoped to a specific recycling center's B3 Field.
   * Used by the B3 Recycling admin section.
   */
  async adminGetRecyclingInboundJobs(page = 1, limit = 50, centerId?: string) {
    const skip = (page - 1) * limit;

    const where: import('@prisma/client').Prisma.OrderWhereInput = {
      orderType: 'DISPOSAL',
      ...(centerId
        ? {
            pickupField: {
              recyclingCenterId: centerId,
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          deliveryAddress: true,
          deliveryCity: true,
          deliveryDate: true,
          total: true,
          currency: true,
          createdAt: true,
          buyer: { select: { id: true, name: true, email: true, phone: true } },
          pickupField: { select: { id: true, name: true, city: true } },
          transportJobs: { select: { id: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    // Normalise shape: expose pickupField as b3Field and add null stubs for
    // DISPOSAL-specific fields that exist only on GuestOrder schema.
    const normalised = data.map(({ pickupField, ...rest }) => ({
      ...rest,
      wasteTypes: null as string | null,
      disposalVolume: null as number | null,
      b3Field: pickupField ?? null,
    }));

    return { data: normalised, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * GET /admin/b3-recycling/waste-records
   * All WasteRecord entries, optionally scoped to a specific recycling center.
   * Used by the B3 Recycling waste log and certificates sections.
   */
  async adminGetRecyclingWasteRecords(page = 1, limit = 50, centerId?: string) {
    const skip = (page - 1) * limit;

    const where: import('@prisma/client').Prisma.WasteRecordWhereInput = centerId
      ? { recyclingCenterId: centerId }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.wasteRecord.findMany({
        where,
        include: {
          recyclingCenter: { select: { id: true, name: true, city: true } },
          containerOrder: {
            select: {
              id: true,
              order: { select: { id: true, orderNumber: true, buyer: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.wasteRecord.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * PATCH /admin/b3-recycling/jobs/:id
   * Update the status of a DISPOSAL order (inbound recycling job).
   * Valid transitions: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED
   */
  async adminUpdateRecyclingJob(
    id: string,
    data: { status?: string; notes?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, orderType: true, status: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.orderType !== 'DISPOSAL') throw new NotFoundException('Order is not a disposal job');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status as import('@prisma/client').OrderStatus } : {}),
        ...(data.notes ? { internalNotes: data.notes } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  /**
   * POST /admin/b3-recycling/waste-records
   * Manually log a waste record (e.g., walk-in vehicle arriving without online booking).
   */
  async adminCreateWasteRecord(data: {
    recyclingCenterId: string;
    wasteType: string;
    weight: number;
    volume?: number;
    processedDate?: string;
    recyclableWeight?: number;
    recyclingRate?: number;
  }) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: data.recyclingCenterId },
      select: { id: true },
    });
    if (!center) throw new NotFoundException('Recycling center not found');

    const record = await this.prisma.wasteRecord.create({
      data: {
        recyclingCenterId: data.recyclingCenterId,
        wasteType: data.wasteType as import('@prisma/client').WasteType,
        weight: data.weight,
        volume: data.volume,
        processedDate: data.processedDate ? new Date(data.processedDate) : new Date(),
        recyclableWeight: data.recyclableWeight,
        recyclingRate: data.recyclingRate,
      },
      include: {
        recyclingCenter: { select: { id: true, name: true, city: true } },
      },
    });

    return record;
  }

  // ── Documents (admin view) ────────────────────────────────────────────────

  /**
   * GET /admin/documents
   * Platform-wide document listing, bypassing ownerId scoping.
   */
  async getDocuments(
    page = 1,
    limit = 50,
    type?: string,
    status?: string,
    search?: string,
    isGenerated?: boolean,
  ) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (type) where.type = type;
    if (status) where.status = status;
    if (isGenerated !== undefined) where.isGenerated = isGenerated;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { issuedBy: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [docs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { links: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    // Enrich with owner info (no Prisma relation on Document.ownerId)
    const ownerIds = [...new Set(docs.map((d) => d.ownerId))];
    const owners = ownerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const ownerMap = Object.fromEntries(owners.map((u) => [u.id, u]));

    const data = docs.map((d) => ({ ...d, owner: ownerMap[d.ownerId] ?? null }));

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * PATCH /admin/documents/:id/status
   * Change document status. System-generated docs can only be ARCHIVED.
   */
  async updateDocumentStatus(
    id: string,
    status: string,
    adminId: string,
    note?: string,
  ) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, title: true, type: true, status: true, isGenerated: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: status as never, ...(note ? { notes: note } : {}) },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        isGenerated: true,
        updatedAt: true,
      },
    });

    await this.logAdminAction(
      adminId,
      'DOCUMENT_STATUS_CHANGED',
      'Document',
      id,
      { status: doc.status },
      { status: updated.status },
      note,
    );

    return updated;
  }

  // ─── Live Dispatch View ────────────────────────────────────────────────────

  /**
   * Returns a snapshot of the live fleet for the admin dispatcher view:
   *  - All active transport jobs (not COMPLETED / CANCELLED) with coords
   *  - All drivers that are currently online, grouped by carrier
   */
  async getLiveDispatch() {
    const ACTIVE_STATUSES: TransportJobStatus[] = [
      TransportJobStatus.ASSIGNED,
      TransportJobStatus.ACCEPTED,
      TransportJobStatus.EN_ROUTE_PICKUP,
      TransportJobStatus.AT_PICKUP,
      TransportJobStatus.LOADED,
      TransportJobStatus.EN_ROUTE_DELIVERY,
      TransportJobStatus.AT_DELIVERY,
    ];

    const [jobs, onlineDrivers, carriers] = await Promise.all([
      // Active jobs with geo coords + driver/carrier/vehicle
      this.prisma.transportJob.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        select: {
          id: true,
          jobNumber: true,
          jobType: true,
          status: true,
          cargoType: true,
          cargoWeight: true,
          rate: true,
          currency: true,
          pickupCity: true,
          deliveryCity: true,
          pickupLat: true,
          pickupLng: true,
          deliveryLat: true,
          deliveryLng: true,
          pickupDate: true,
          deliveryDate: true,
          order: { select: { id: true, orderNumber: true } },
          carrier: { select: { id: true, name: true } },
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              driverProfile: { select: { isOnline: true, currentLocation: true, rating: true } },
            },
          },
          vehicle: { select: { id: true, make: true, model: true, licensePlate: true } },
          exceptions: { where: { status: 'OPEN' }, select: { id: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // All online drivers
      this.prisma.driverProfile.findMany({
        where: { isOnline: true },
        select: {
          id: true,
          isOnline: true,
          currentLocation: true,
          rating: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // All carrier companies with basic fleet stats
      this.prisma.company.findMany({
        where: { companyType: { in: ['CARRIER', 'HYBRID'] }, verified: true },
        select: {
          id: true,
          name: true,
          companyType: true,
          city: true,
          _count: {
            select: {
              users: { where: { canTransport: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Enrich carriers with online driver count + active job count
    const carrierJobMap = new Map<string, number>();
    const carrierOnlineMap = new Map<string, number>();
    for (const j of jobs) {
      if (j.carrier?.id) {
        carrierJobMap.set(j.carrier.id, (carrierJobMap.get(j.carrier.id) ?? 0) + 1);
      }
    }
    for (const d of onlineDrivers) {
      const companyId = d.user.company?.id;
      if (companyId) {
        carrierOnlineMap.set(companyId, (carrierOnlineMap.get(companyId) ?? 0) + 1);
      }
    }

    return {
      jobs,
      onlineDrivers,
      carriers: carriers.map((c) => ({
        ...c,
        activeJobs: carrierJobMap.get(c.id) ?? 0,
        onlineDrivers: carrierOnlineMap.get(c.id) ?? 0,
      })),
      summary: {
        totalActiveJobs: jobs.length,
        totalOnlineDrivers: onlineDrivers.length,
        totalCarriers: carriers.length,
        jobsByStatus: ACTIVE_STATUSES.reduce(
          (acc, s) => {
            acc[s] = jobs.filter((j) => j.status === s).length;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }

  // ── B3 Construction ───────────────────────────────────────────────────────

  /**
   * GET /admin/b3-construction/projects
   * All projects across the platform (admin view, not company-scoped).
   * Includes per-project order count, material costs, contract value, and status.
   */
  async adminGetConstructionProjects(
    page = 1,
    limit = 50,
    status?: string,
    companyId?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: import('@prisma/client').Prisma.ProjectWhereInput = {
      ...(status ? { status: status as import('@prisma/client').ProjectStatus } : {}),
      ...(companyId ? { companyId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          clientName: true,
          siteAddress: true,
          status: true,
          contractValue: true,
          budgetAmount: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { orders: true, transportJobs: true } },
          orders: {
            select: {
              total: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    const enriched = data.map((p) => {
      const committedOrders = p.orders.filter((o) =>
        ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'].includes(o.status),
      );
      const materialCosts = committedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
      const grossMargin = p.contractValue - materialCosts;
      const marginPct = p.contractValue > 0 ? (grossMargin / p.contractValue) * 100 : 0;
      const budgetUsedPct =
        p.budgetAmount && p.budgetAmount > 0
          ? (materialCosts / p.budgetAmount) * 100
          : null;

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        clientName: p.clientName,
        siteAddress: p.siteAddress,
        status: p.status,
        contractValue: p.contractValue,
        budgetAmount: p.budgetAmount,
        startDate: p.startDate,
        endDate: p.endDate,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        company: p.company,
        createdBy: p.createdBy,
        orderCount: p._count.orders,
        transportJobCount: p._count.transportJobs,
        materialCosts,
        grossMargin,
        marginPct,
        budgetUsedPct,
      };
    });

    return { data: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * GET /admin/b3-construction/disposal
   * All disposal (waste) orders tagged to a project, across the platform.
   */
  async adminGetConstructionDisposalOrders(page = 1, limit = 100, projectId?: string, status?: string) {
    const skip = (page - 1) * limit;
    const where: import('@prisma/client').Prisma.OrderWhereInput = {
      orderType: 'DISPOSAL',
      projectId: { not: null },
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as import('@prisma/client').OrderStatus } : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          deliveryDate: true,
          deliveryAddress: true,
          deliveryCity: true,
          createdAt: true,
          project: { select: { id: true, name: true } },
          buyer: { select: { id: true, name: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data: orders, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * GET /admin/b3-construction/projects/:id
   * Single project detail — orders, sites, and framework contracts.
   */
  async adminGetConstructionProjectById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            orderType: true,
            total: true,
            deliveryAddress: true,
            deliveryCity: true,
            deliveryDate: true,
            createdAt: true,
            items: {
              select: {
                material: { select: { name: true, category: true } },
                quantity: true,
                unit: true,
                unitPrice: true,
                total: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        sites: {
          orderBy: { createdAt: 'asc' },
        },
        frameworkContracts: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            supplier: { select: { id: true, name: true } },
          },
        },
        transportJobs: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            cargoType: true,
            cargoWeight: true,
            pickupAddress: true,
            pickupCity: true,
            deliveryAddress: true,
            deliveryCity: true,
            pickupDate: true,
            deliveryDate: true,
            rate: true,
            driver: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { pickupDate: 'desc' as const },
        },
        _count: { select: { orders: true, transportJobs: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const committedOrders = project.orders.filter((o) =>
      ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'].includes(o.status),
    );
    const materialCosts = committedOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const pendingCosts = project.orders
      .filter((o) => o.status === 'PENDING')
      .reduce((sum, o) => sum + (o.total ?? 0), 0);
    const grossMargin = project.contractValue - materialCosts;
    const marginPct = project.contractValue > 0 ? (grossMargin / project.contractValue) * 100 : 0;
    const budgetUsedPct =
      project.budgetAmount && project.budgetAmount > 0
        ? (materialCosts / project.budgetAmount) * 100
        : null;

    return {
      ...project,
      orderCount: project._count.orders,
      transportJobCount: project._count.transportJobs,
      materialCosts,
      pendingCosts,
      grossMargin,
      marginPct,
      budgetUsedPct,
    };
  }

  /**
   * PATCH /admin/b3-construction/projects/:id
   * Update project status or basic fields.
   */
  async adminCreateConstructionProject(
    adminUserId: string,
    data: {
      name: string;
      companyId: string;
      contractValue: number;
      clientName?: string;
      description?: string;
      siteAddress?: string;
      budgetAmount?: number;
      startDate?: string;
      endDate?: string;
      status?: import('@prisma/client').ProjectStatus;
    },
  ) {
    const company = await this.prisma.company.findUnique({ where: { id: data.companyId } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.project.create({
      data: {
        name: data.name,
        companyId: data.companyId,
        createdById: adminUserId,
        contractValue: data.contractValue,
        clientName: data.clientName,
        description: data.description,
        siteAddress: data.siteAddress,
        budgetAmount: data.budgetAmount,
        status: data.status ?? 'PLANNING',
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      select: {
        id: true,
        name: true,
        status: true,
        companyId: true,
        contractValue: true,
        clientName: true,
        startDate: true,
        createdAt: true,
      },
    });
  }

  async adminUpdateConstructionProject(
    id: string,
    data: {
      status?: import('@prisma/client').ProjectStatus;
      name?: string;
      description?: string;
      clientName?: string;
      siteAddress?: string;
      contractValue?: number;
      budgetAmount?: number;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Project not found');

    return this.prisma.project.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
        endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  // ── B3 Construction — Project Documents ──────────────────────────────────

  async adminGetProjectDocuments(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');

    const links = await this.prisma.documentLink.findMany({
      where: { entityId: projectId, entityType: 'PROJECT' },
      select: { documentId: true, role: true },
    });
    if (links.length === 0) return [];

    const docIds = links.map((l) => l.documentId);
    const roleMap = Object.fromEntries(links.map((l) => [l.documentId, l.role]));

    const docs = await this.prisma.document.findMany({
      where: { id: { in: docIds } },
      orderBy: { createdAt: 'desc' },
    });

    const ownerIds = [...new Set(docs.map((d) => d.ownerId))];
    const owners = ownerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const ownerMap = Object.fromEntries(owners.map((u) => [u.id, u]));

    return docs.map((d) => ({
      ...d,
      role: roleMap[d.id] ?? 'RELATED',
      owner: ownerMap[d.ownerId] ?? null,
    }));
  }

  async adminCreateProjectDocument(
    projectId: string,
    adminUserId: string,
    data: {
      title: string;
      type: string;
      status?: string;
      fileUrl?: string;
      notes?: string;
      expiresAt?: string;
      issuedBy?: string;
    },
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');

    const doc = await this.prisma.document.create({
      data: {
        title: data.title,
        type: data.type as never,
        status: (data.status ?? 'DRAFT') as never,
        fileUrl: data.fileUrl ?? null,
        ownerId: adminUserId,
        issuedBy: data.issuedBy ?? null,
        notes: data.notes ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isGenerated: false,
      },
      select: { id: true, title: true, type: true, status: true, fileUrl: true, createdAt: true },
    });

    await this.prisma.documentLink.create({
      data: {
        documentId: doc.id,
        entityId: projectId,
        entityType: 'PROJECT',
        role: 'PRIMARY',
      },
    });

    return doc;
  }

  async adminDeleteProjectDocument(projectId: string, documentId: string) {
    const link = await this.prisma.documentLink.findFirst({
      where: { documentId, entityId: projectId, entityType: 'PROJECT' },
    });
    if (!link) throw new NotFoundException('Document not linked to this project');

    await this.prisma.documentLink.delete({ where: { id: link.id } });
    await this.prisma.document.delete({ where: { id: documentId } });
    return { ok: true };
  }

  // ── B3 Construction — Subcontractor Spend ────────────────────────────────

  async adminGetSubcontractorSpend(params: { projectId?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = { costCode: 'SUBCONTRACTOR' };

    if (params.projectId) {
      where.report = { projectId: params.projectId };
    }

    const lines = await this.prisma.dailyReportLine.findMany({
      where: where as never,
      select: {
        id: true,
        description: true,
        quantity: true,
        unitRate: true,
        totalCost: true,
        costCode: true,
        report: {
          select: {
            id: true,
            reportDate: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { report: { reportDate: 'desc' } },
    });

    // Aggregate by subcontractor name (description)
    const byName: Record<
      string,
      {
        name: string;
        totalCost: number;
        lineCount: number;
        projects: Set<string>;
        lastSeen: string;
      }
    > = {};

    for (const line of lines) {
      const name = line.description.trim() || 'Nezināms';
      if (!byName[name]) {
        byName[name] = {
          name,
          totalCost: 0,
          lineCount: 0,
          projects: new Set(),
          lastSeen: line.report.reportDate.toISOString(),
        };
      }
      byName[name].totalCost += line.totalCost;
      byName[name].lineCount += 1;
      if (line.report.project?.name) byName[name].projects.add(line.report.project.name);
      if (line.report.reportDate.toISOString() > byName[name].lastSeen) {
        byName[name].lastSeen = line.report.reportDate.toISOString();
      }
    }

    const summary = Object.values(byName)
      .map((s) => ({
        name: s.name,
        totalCost: s.totalCost,
        lineCount: s.lineCount,
        projectCount: s.projects.size,
        projects: [...s.projects],
        lastSeen: s.lastSeen,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const totalSpend = summary.reduce((s, r) => s + r.totalCost, 0);
    return { summary, totalSpend, lineCount: lines.length };
  }

  // ── B3 Construction — Clients ─────────────────────────────────────────────

  async adminGetConstructionClients() {
    return this.prisma.company.findMany({
      where: { companyType: 'CONSTRUCTION' },
      select: {
        id: true,
        name: true,
        legalName: true,
        registrationNum: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        verified: true,
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async adminCreateConstructionClient(data: {
    name: string;
    legalName: string;
    registrationNum?: string;
    taxId?: string;
    email: string;
    phone: string;
    city?: string;
    street?: string;
    postalCode?: string;
  }) {
    return this.prisma.company.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        registrationNum: data.registrationNum ?? null,
        taxId: data.taxId ?? null,
        companyType: 'CONSTRUCTION',
        email: data.email,
        phone: data.phone,
        street: data.street ?? '',
        city: data.city ?? '',
        state: '',
        postalCode: data.postalCode ?? '',
        country: 'LV',
      },
      select: {
        id: true,
        name: true,
        legalName: true,
        registrationNum: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        verified: true,
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
    });
  }

  // ── Material Rate Library ──────────────────────────────────────────────────

  async adminGetRateEntries(params: {
    category?: import('@prisma/client').RateCategory;
    activeOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { category, activeOnly = false, page = 1, limit = 200 } = params;
    const skip = (page - 1) * limit;
    const where: import('@prisma/client').Prisma.MaterialRateEntryWhereInput = {
      ...(category ? { category } : {}),
      ...(activeOnly ? { effectiveTo: null } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.materialRateEntry.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }, { effectiveFrom: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.materialRateEntry.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adminCreateRateEntry(data: {
    name: string;
    unit: import('@prisma/client').UnitOfMeasure;
    category: import('@prisma/client').RateCategory;
    supplierName: string;
    supplierNote?: string;
    pricePerUnit: number;
    deliveryFee?: number;
    selfCostPerUnit?: number;
    densityCoeff?: number;
    truckConfig?: string;
    zone?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    notes?: string;
  }) {
    return this.prisma.materialRateEntry.create({
      data: {
        name: data.name,
        unit: data.unit,
        category: data.category,
        supplierName: data.supplierName,
        supplierNote: data.supplierNote,
        pricePerUnit: data.pricePerUnit,
        deliveryFee: data.deliveryFee ?? 0,
        selfCostPerUnit: data.selfCostPerUnit,
        densityCoeff: data.densityCoeff,
        truckConfig: data.truckConfig,
        zone: data.zone,
        effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
        effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        notes: data.notes,
      },
    });
  }

  async adminUpdateRateEntry(
    id: string,
    data: {
      name?: string;
      unit?: import('@prisma/client').UnitOfMeasure;
      category?: import('@prisma/client').RateCategory;
      supplierName?: string;
      supplierNote?: string;
      pricePerUnit?: number;
      deliveryFee?: number;
      selfCostPerUnit?: number;
      densityCoeff?: number;
      truckConfig?: string;
      zone?: string;
      effectiveTo?: string | null;
      notes?: string;
    },
  ) {
    const existing = await this.prisma.materialRateEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rate entry not found');
    return this.prisma.materialRateEntry.update({
      where: { id },
      data: {
        ...data,
        effectiveTo: data.effectiveTo === null ? null : data.effectiveTo ? new Date(data.effectiveTo) : undefined,
      },
    });
  }

  async adminDeleteRateEntry(id: string) {
    const existing = await this.prisma.materialRateEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Rate entry not found');
    await this.prisma.materialRateEntry.delete({ where: { id } });
  }

  // ── Daily Production Reports ───────────────────────────────────────────────

  async adminGetDailyReports(params: {
    projectId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { projectId, status, page = 1, limit = 100 } = params;
    const skip = (page - 1) * limit;
    const where: import('@prisma/client').Prisma.DailyReportWhereInput = {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as import('@prisma/client').DailyReportStatus } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.dailyReport.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { reportDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.dailyReport.count({ where }),
    ]);
    // Compute totals per report
    const withTotals = await Promise.all(
      data.map(async (r) => {
        const agg = await this.prisma.dailyReportLine.aggregate({
          where: { reportId: r.id },
          _sum: { total: true },
        });
        return { ...r, totalCost: agg._sum.total ?? 0 };
      }),
    );
    return { data: withTotals, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adminGetDailyReportById(id: string) {
    const report = await this.prisma.dailyReport.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, contractValue: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          include: { rateEntry: { select: { id: true, name: true, supplierName: true } } },
          orderBy: [{ costCode: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!report) throw new NotFoundException('Daily report not found');
    return report;
  }

  async adminCreateDailyReport(
    adminId: string,
    data: {
      projectId: string;
      reportDate: string;
      siteLabel?: string;
      weatherNote?: string;
      notes?: string;
      lines: {
        costCode: string;
        description: string;
        personName?: string;
        quantity: number;
        unit: import('@prisma/client').UnitOfMeasure;
        unitRate: number;
        rateEntryId?: string;
        employeeId?: string;
        notes?: string;
      }[];
    },
  ) {
    const project = await this.prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.dailyReport.create({
      data: {
        projectId: data.projectId,
        createdById: adminId,
        reportDate: new Date(data.reportDate),
        siteLabel: data.siteLabel,
        weatherNote: data.weatherNote,
        notes: data.notes,
        status: 'DRAFT',
        lines: {
          create: data.lines.map((l) => ({
            costCode: l.costCode as import('@prisma/client').CostCode,
            description: l.description,
            personName: l.personName,
            quantity: l.quantity,
            unit: l.unit,
            unitRate: l.unitRate,
            total: l.quantity * l.unitRate,
            rateEntryId: l.rateEntryId ?? null,
            employeeId: l.employeeId ?? null,
            notes: l.notes,
          })),
        },
      },
      include: {
        lines: true,
        project: { select: { id: true, name: true } },
      },
    });
  }

  async adminUpdateDailyReport(
    id: string,
    adminId: string,
    data: {
      siteLabel?: string;
      weatherNote?: string;
      notes?: string;
      status?: string;
    },
  ) {
    const existing = await this.prisma.dailyReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Daily report not found');

    const { status, ...rest } = data;
    const updateData: import('@prisma/client').Prisma.DailyReportUpdateInput = {
      ...rest,
      ...(status ? { status: status as import('@prisma/client').DailyReportStatus } : {}),
    };
    if (status === 'APPROVED') {
      updateData.approvedBy = { connect: { id: adminId } };
    }

    return this.prisma.dailyReport.update({
      where: { id },
      data: updateData,
      include: { lines: true, project: { select: { id: true, name: true } } },
    });
  }

  async adminDeleteDailyReport(id: string) {
    const existing = await this.prisma.dailyReport.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Daily report not found');
    await this.prisma.dailyReport.delete({ where: { id } });
  }

  // ── Construction Employee Roster ────────────────────────────────────────────

  async adminGetEmployees(params: { activeOnly?: boolean; page?: number; limit?: number }) {
    const { activeOnly = false, page = 1, limit = 200 } = params;
    const skip = (page - 1) * limit;
    const where: import('@prisma/client').Prisma.ConstructionEmployeeWhereInput = activeOnly
      ? { active: true }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.constructionEmployee.findMany({
        where,
        include: { defaultRateEntry: { select: { id: true, name: true, unit: true, pricePerUnit: true } } },
        orderBy: [{ active: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.constructionEmployee.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adminCreateEmployee(data: {
    firstName: string;
    lastName: string;
    role: string;
    personalCode?: string;
    phone?: string;
    email?: string;
    notes?: string;
    defaultRateEntryId?: string;
  }) {
    return this.prisma.constructionEmployee.create({ data });
  }

  async adminUpdateEmployee(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      role?: string;
      personalCode?: string;
      phone?: string;
      email?: string;
      notes?: string;
      defaultRateEntryId?: string | null;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.constructionEmployee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    return this.prisma.constructionEmployee.update({ where: { id }, data });
  }

  async adminDeleteEmployee(id: string) {
    const existing = await this.prisma.constructionEmployee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employee not found');
    // Soft-delete: keep record for DPR history integrity
    return this.prisma.constructionEmployee.update({ where: { id }, data: { active: false } });
  }

  async adminGetEmployeeHours(id: string) {
    const employee = await this.prisma.constructionEmployee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    const lines = await this.prisma.dailyReportLine.findMany({
      where: { employeeId: id },
      include: {
        report: { select: { id: true, reportDate: true, project: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const totalQuantity = lines.reduce((s, l) => s + l.quantity, 0);
    return { employee, lines, totalQuantity };
  }

  /**
   * GET /admin/b3-construction/profitability
   *
   * Per-project profitability summary using DPR line totals as self-cost.
   * contractValue = what the client pays (invoiced revenue)
   * dprCost       = sum of all APPROVED DPR line totals (actual self-cost)
   * grossMargin   = contractValue - dprCost
   *
   * Optional filters: projectId, from (YYYY-MM-DD), to (YYYY-MM-DD)
   */
  async adminGetConstructionProfitability(params: {
    projectId?: string;
    from?: string;
    to?: string;
  }) {
    const { projectId, from, to } = params;

    // Build date filter for DPR lines (via report.reportDate)
    const dateFilter =
      from || to
        ? {
            report: {
              reportDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            },
          }
        : {};

    // Aggregate DPR totals per project × costCode
    const lineAggs = await this.prisma.dailyReportLine.groupBy({
      by: ['costCode'],
      where: {
        ...(projectId ? { report: { projectId } } : {}),
        ...dateFilter,
        report: {
          ...(projectId ? { projectId } : {}),
          ...(from || to
            ? {
                reportDate: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
      },
      _sum: { total: true },
    });

    // Per-project aggregation
    const projectAggs = await this.prisma.dailyReportLine.groupBy({
      by: ['reportId'],
      where: {
        ...(from || to
          ? {
              report: {
                ...(projectId ? { projectId } : {}),
                reportDate: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              },
            }
          : projectId
            ? { report: { projectId } }
            : {}),
      },
      _sum: { total: true },
    });

    // Get all reports to resolve projectIds
    const reportIds = projectAggs.map((a) => a.reportId);
    const reports = await this.prisma.dailyReport.findMany({
      where: { id: { in: reportIds } },
      select: { id: true, projectId: true },
    });
    const reportProjectMap = new Map(reports.map((r) => [r.id, r.projectId]));

    // Sum DPR cost per project
    const dprCostByProject = new Map<string, number>();
    for (const agg of projectAggs) {
      const pid = reportProjectMap.get(agg.reportId);
      if (!pid) continue;
      dprCostByProject.set(pid, (dprCostByProject.get(pid) ?? 0) + (agg._sum.total ?? 0));
    }

    // Monthly breakdown (last 12 months)
    const monthlyLines = await this.prisma.dailyReportLine.findMany({
      where: {
        ...(from || to
          ? {
              report: {
                ...(projectId ? { projectId } : {}),
                reportDate: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              },
            }
          : projectId
            ? { report: { projectId } }
            : { report: { reportDate: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } }),
      },
      select: {
        total: true,
        costCode: true,
        report: { select: { reportDate: true } },
      },
    });

    // Group by YYYY-MM
    const monthMap = new Map<string, number>();
    for (const l of monthlyLines) {
      const month = l.report.reportDate.toISOString().slice(0, 7);
      monthMap.set(month, (monthMap.get(month) ?? 0) + (l.total ?? 0));
    }
    const monthlyCosts = Array.from(monthMap.entries())
      .map(([month, cost]) => ({ month, cost }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Fetch relevant projects
    const projectIds = projectId ? [projectId] : Array.from(dprCostByProject.keys());
    const projects = await this.prisma.project.findMany({
      where: projectIds.length ? { id: { in: projectIds } } : undefined,
      select: {
        id: true,
        name: true,
        clientName: true,
        status: true,
        contractValue: true,
        budgetAmount: true,
        startDate: true,
        endDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch per-cost-code budget lines for all relevant projects
    const allBudgetLines = await this.prisma.projectBudgetLine.findMany({
      where: projectIds.length ? { projectId: { in: projectIds } } : {},
      select: { projectId: true, costCode: true, budgetAmount: true },
    });
    const budgetLinesByProject = new Map<string, Record<string, number>>();
    for (const bl of allBudgetLines) {
      if (!budgetLinesByProject.has(bl.projectId)) budgetLinesByProject.set(bl.projectId, {});
      budgetLinesByProject.get(bl.projectId)![bl.costCode] = bl.budgetAmount;
    }

    // Per-project cost breakdown (DPR totals by cost code)
    const perProjectCostBreakdown = new Map<string, Record<string, number>>();

    // We need per-project × costCode breakdown
    const lineAggsPerProject = await this.prisma.dailyReportLine.groupBy({
      by: ['costCode', 'reportId'],
      where: {
        ...(from || to
          ? {
              report: {
                ...(projectId ? { projectId } : {}),
                reportDate: {
                  ...(from ? { gte: new Date(from) } : {}),
                  ...(to ? { lte: new Date(to) } : {}),
                },
              },
            }
          : projectId
            ? { report: { projectId } }
            : {}),
      },
      _sum: { total: true },
    });

    for (const agg of lineAggsPerProject) {
      const pid = reportProjectMap.get(agg.reportId);
      if (!pid) continue;
      if (!perProjectCostBreakdown.has(pid)) perProjectCostBreakdown.set(pid, {});
      const entry = perProjectCostBreakdown.get(pid)!;
      entry[agg.costCode] = (entry[agg.costCode] ?? 0) + (agg._sum.total ?? 0);
    }

    // Cost breakdown by costCode (totals across filter)
    const costBreakdown: Record<string, number> = {};
    for (const agg of lineAggs) {
      costBreakdown[agg.costCode] = agg._sum.total ?? 0;
    }
    const totalDprCost = Object.values(costBreakdown).reduce((s, v) => s + v, 0);

    // Per-project summary
    const projectSummaries = projects.map((p) => {
      const dprCost = dprCostByProject.get(p.id) ?? 0;
      const grossMargin = p.contractValue - dprCost;
      const marginPct = p.contractValue > 0 ? (grossMargin / p.contractValue) * 100 : 0;
      const budgetUsedPct =
        p.budgetAmount && p.budgetAmount > 0 ? (dprCost / p.budgetAmount) * 100 : null;
      const costByCode = perProjectCostBreakdown.get(p.id) ?? {};
      const budgetByCode = budgetLinesByProject.get(p.id) ?? {};
      return {
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        status: p.status,
        contractValue: p.contractValue,
        budgetAmount: p.budgetAmount,
        startDate: p.startDate,
        endDate: p.endDate,
        dprCost,
        grossMargin,
        marginPct,
        budgetUsedPct,
        costByCode,
        budgetByCode,
      };
    });

    const totalContractValue = projectSummaries.reduce((s, p) => s + p.contractValue, 0);

    return {
      projects: projectSummaries,
      totals: {
        contractValue: totalContractValue,
        dprCost: totalDprCost,
        grossMargin: totalContractValue - totalDprCost,
        marginPct:
          totalContractValue > 0
            ? ((totalContractValue - totalDprCost) / totalContractValue) * 100
            : 0,
      },
      costBreakdown,
      monthlyCosts,
    };
  }

  // ── DPR Templates ─────────────────────────────────────────────────────────

  async adminGetDprTemplates(params: { projectId?: string; includeGlobal?: boolean } = {}) {
    const { projectId, includeGlobal = true } = params;

    const where: any = { active: true };
    if (projectId && includeGlobal) {
      where.OR = [{ projectId }, { projectId: null }];
    } else if (projectId) {
      where.projectId = projectId;
    }
    // if neither, return all active templates

    return this.prisma.dprTemplate.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: {
            rateEntry: { select: { id: true, name: true, unit: true, pricePerUnit: true } },
            employee: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
      orderBy: [{ projectId: 'asc' }, { name: 'asc' }],
    });
  }

  async adminCreateDprTemplate(data: {
    name: string;
    description?: string;
    projectId?: string;
    lines: Array<{
      costCode: string;
      description: string;
      quantity: number;
      unit: string;
      unitRate: number;
      rateEntryId?: string;
      employeeId?: string;
      notes?: string;
      sortOrder?: number;
    }>;
  }) {
    const { lines, ...header } = data;
    return this.prisma.dprTemplate.create({
      data: {
        ...header,
        lines: {
          create: lines.map((l, idx) => ({
            costCode: l.costCode as any,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit as any,
            unitRate: l.unitRate,
            rateEntryId: l.rateEntryId || null,
            employeeId: l.employeeId || null,
            notes: l.notes || null,
            sortOrder: l.sortOrder ?? idx,
          })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async adminUpdateDprTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      projectId?: string | null;
      lines?: Array<{
        costCode: string;
        description: string;
        quantity: number;
        unit: string;
        unitRate: number;
        rateEntryId?: string;
        employeeId?: string;
        notes?: string;
        sortOrder?: number;
      }>;
    },
  ) {
    const { lines, ...header } = data;

    // Rebuild lines if provided (delete + recreate is the simplest approach)
    if (lines !== undefined) {
      await this.prisma.dprTemplateLine.deleteMany({ where: { templateId: id } });
      await this.prisma.dprTemplateLine.createMany({
        data: lines.map((l, idx) => ({
          templateId: id,
          costCode: l.costCode as any,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit as any,
          unitRate: l.unitRate,
          rateEntryId: l.rateEntryId || null,
          employeeId: l.employeeId || null,
          notes: l.notes || null,
          sortOrder: l.sortOrder ?? idx,
        })),
      });
    }

    return this.prisma.dprTemplate.update({
      where: { id },
      data: header,
      include: {
        project: { select: { id: true, name: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async adminDeleteDprTemplate(id: string) {
    // Soft-delete
    return this.prisma.dprTemplate.update({ where: { id }, data: { active: false } });
  }

  // ── Project Sub-Budgets ───────────────────────────────────────────────────

  async adminGetProjectBudgetLines(projectId: string) {
    return this.prisma.projectBudgetLine.findMany({
      where: { projectId },
      orderBy: { costCode: 'asc' },
    });
  }

  async adminSetProjectBudgetLines(
    projectId: string,
    lines: Array<{ costCode: string; budgetAmount: number; notes?: string }>,
  ) {
    // Upsert each cost-code line; remove any not in the new set
    await this.prisma.$transaction(async (tx) => {
      const costCodes = lines.map((l) => l.costCode as any);

      // Delete removed cost codes
      await tx.projectBudgetLine.deleteMany({
        where: { projectId, costCode: { notIn: costCodes } },
      });

      // Upsert each line
      for (const line of lines) {
        await tx.projectBudgetLine.upsert({
          where: { projectId_costCode: { projectId, costCode: line.costCode as any } },
          create: {
            projectId,
            costCode: line.costCode as any,
            budgetAmount: line.budgetAmount,
            notes: line.notes ?? null,
          },
          update: {
            budgetAmount: line.budgetAmount,
            notes: line.notes ?? null,
          },
        });
      }
    });

    return this.adminGetProjectBudgetLines(projectId);
  }

  // ── Subcontractor Register ─────────────────────────────────────────────────

  async adminGetSubcontractors(params: { active?: boolean; limit?: number; skip?: number }) {
    const { active, limit = 100, skip = 0 } = params;
    const where = active != null ? { active } : {};
    const [data, total] = await Promise.all([
      this.prisma.constructionSubcontractor.findMany({
        where,
        include: { engagements: { include: { project: { select: { id: true, name: true } } } } },
        orderBy: { name: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.constructionSubcontractor.count({ where }),
    ]);
    return { data, total };
  }

  async adminCreateSubcontractor(body: {
    name: string;
    registrationNo?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    speciality?: string;
    notes?: string;
  }) {
    return this.prisma.constructionSubcontractor.create({ data: body });
  }

  async adminUpdateSubcontractor(id: string, body: Partial<{
    name: string;
    registrationNo: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    speciality: string | null;
    notes: string | null;
    active: boolean;
  }>) {
    return this.prisma.constructionSubcontractor.update({ where: { id }, data: body });
  }

  async adminDeleteSubcontractor(id: string) {
    return this.prisma.constructionSubcontractor.update({ where: { id }, data: { active: false } });
  }

  async adminGetSubcontractorEngagements(projectId?: string) {
    return this.prisma.subcontractorEngagement.findMany({
      where: projectId ? { projectId } : {},
      include: {
        subcontractor: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminCreateEngagement(body: {
    subcontractorId: string;
    projectId: string;
    description: string;
    agreedAmount: number;
    invoicedAmount?: number;
    paidAmount?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    notes?: string;
  }) {
    const { startDate, endDate, status, ...rest } = body;
    return this.prisma.subcontractorEngagement.create({
      data: {
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { subcontractor: true, project: { select: { id: true, name: true } } },
    });
  }

  async adminUpdateEngagement(id: string, body: Partial<{
    description: string;
    agreedAmount: number;
    invoicedAmount: number | null;
    paidAmount: number | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
    notes: string | null;
  }>) {
    const { startDate, endDate, status, ...rest } = body;
    return this.prisma.subcontractorEngagement.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { subcontractor: true, project: { select: { id: true, name: true } } },
    });
  }

  async adminDeleteEngagement(id: string) {
    return this.prisma.subcontractorEngagement.delete({ where: { id } });
  }

  // ── Construction Client Invoices ───────────────────────────────────────────

  async adminGetClientInvoices(params: { projectId?: string; status?: string; limit?: number; skip?: number }) {
    const { projectId, status, limit = 100, skip = 0 } = params;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.constructionClientInvoice.findMany({
        where,
        include: { project: { select: { id: true, name: true, clientName: true } } },
        orderBy: { issueDate: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.constructionClientInvoice.count({ where }),
    ]);
    return { data, total };
  }

  async adminCreateClientInvoice(body: {
    projectId: string;
    invoiceNo: string;
    issueDate: string;
    dueDate?: string;
    amount: number;
    vatAmount?: number;
    description?: string;
    status?: string;
    notes?: string;
  }) {
    const { issueDate, dueDate, status, ...rest } = body;
    return this.prisma.constructionClientInvoice.create({
      data: {
        ...rest,
        issueDate: new Date(issueDate),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async adminUpdateClientInvoice(id: string, body: Partial<{
    invoiceNo: string;
    issueDate: string;
    dueDate: string | null;
    amount: number;
    vatAmount: number | null;
    description: string | null;
    status: string;
    paidAt: string | null;
    paidAmount: number | null;
    notes: string | null;
  }>) {
    const { issueDate, dueDate, paidAt, status, ...rest } = body;
    return this.prisma.constructionClientInvoice.update({
      where: { id },
      data: {
        ...rest,
        ...(issueDate ? { issueDate: new Date(issueDate) } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async adminDeleteClientInvoice(id: string) {
    return this.prisma.constructionClientInvoice.delete({ where: { id } });
  }
}

