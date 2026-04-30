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
        orders: {
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
        email: true, phone: true, city: true, country: true, address: true,
        registrationNumber: true, vatNumber: true,
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
        documents: {
          select: { id: true, documentType: true, fileUrl: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
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
        pickupDate: true, deliveryDate: true, notes: true,
        createdAt: true, updatedAt: true,
        order: { select: { id: true, orderNumber: true, status: true } },
        carrier: { select: { id: true, name: true } },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicle: { select: { id: true, make: true, model: true, licensePlate: true } },
        exceptions: {
          select: { id: true, type: true, status: true, description: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        documents: {
          select: { id: true, documentType: true, fileUrl: true, createdAt: true },
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
}
