/**
 * Admin service.
 * Platform-level operations: list/approve/suspend users, view all orders,
 * review provider applications, and retrieve aggregated statistics.
 * All methods are restricted to ADMIN userType.
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  async getUsers() {
    return this.prisma.user.findMany({
      select: this.userSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(id: string, data: UpdateUserDto, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, status: true, userType: true,
        canSell: true, canTransport: true, canSkipHire: true,
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
      this.logAdminAction(adminId, 'UPDATE_USER', 'User', id, user, data).catch(() => null);
      return result;
    }

    this.logAdminAction(adminId, 'UPDATE_USER', 'User', id, user, data).catch(() => null);
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
          vehicle: { select: { id: true, make: true, model: true, licensePlate: true } },
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
    data: { verified?: boolean; commissionRate?: number; payoutEnabled?: boolean },
    adminId: string,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true, verified: true, commissionRate: true, payoutEnabled: true },
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
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
    });
    this.logAdminAction(adminId, 'UPDATE_COMPANY', 'Company', id, company, data).catch(() => null);
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

    const gmvAllTime = Math.round((gmvAllTimeResult._sum.total ?? 0) * 100) / 100;
    const gmv30d = Math.round((gmv30dResult._sum.total ?? 0) * 100) / 100;
    // Platform commission estimate at default 10% rate
    const commissionEst30d = Math.round(gmv30d * 0.1 * 100) / 100;

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
    };
  }

  /** GET /admin/audit-logs — recent admin actions for compliance review */
  async getAuditLogs(limit = 100) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        admin: { select: { id: true, firstName: true, lastName: true, email: true } },
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
      select: { id: true, jobNumber: true, status: true, rate: true, pricePerTonne: true },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
      throw new BadRequestException(
        `Cannot override rate on a ${job.status} job — payout may have already occurred`,
      );
    }

    const updateData: { rate?: number; pricePerTonne?: number } = {};
    if (data.rate !== undefined) updateData.rate = data.rate;
    if (data.pricePerTonne !== undefined) updateData.pricePerTonne = data.pricePerTonne;

    const updated = await this.prisma.transportJob.update({
      where: { id: jobId },
      data: updateData,
      select: { id: true, jobNumber: true, rate: true, pricePerTonne: true, status: true },
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
        stripePaymentId: true,
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
}
