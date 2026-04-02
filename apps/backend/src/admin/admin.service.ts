/**
 * Admin service.
 * Platform-level operations: list/approve/suspend users, view all orders,
 * review provider applications, and retrieve aggregated statistics.
 * All methods are restricted to ADMIN userType.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  async updateUser(id: string, data: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    this.logger.log(`Admin updated user ${id}`);
    const hasCreditUpdate =
      data.creditLimit !== undefined || data.paymentTerms !== undefined;

    const capabilityChanged =
      data.canSell !== undefined ||
      data.canTransport !== undefined ||
      data.canSkipHire !== undefined ||
      data.userType !== undefined;

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
      return this.prisma.user.findUnique({
        where: { id },
        select: this.userSelect,
      });
    }

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
          select: { id: true, firstName: true, lastName: true, email: true, company: { select: { id: true, name: true } } },
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
  ) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    this.logger.log(`Admin updated company ${id}`);
    return this.prisma.company.update({
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
}
