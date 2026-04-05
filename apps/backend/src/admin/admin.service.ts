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

  async getOrders() {
    return this.prisma.order.findMany({
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
      take: 500,
    });
  }

  async getTransportJobs() {
    return this.prisma.transportJob.findMany({
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
      take: 500,
    });
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
    const [totalUsers, totalOrders, pendingApplications, activeJobs, totalCompanies] =
      await Promise.all([
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
      ]);
    return { totalUsers, totalOrders, pendingApplications, activeJobs, totalCompanies };
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
}
