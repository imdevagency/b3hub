import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus, UserType } from '@prisma/client';

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
  } as const;

  async getUsers() {
    return this.prisma.user.findMany({
      select: this.userSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(
    id: string,
    data: {
      canSell?: boolean;
      canTransport?: boolean;
      canSkipHire?: boolean;
      status?: string;
      userType?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    this.logger.log(`Admin updated user ${id}`);
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.canSell !== undefined && { canSell: data.canSell }),
        ...(data.canTransport !== undefined && {
          canTransport: data.canTransport,
        }),
        ...(data.canSkipHire !== undefined && {
          canSkipHire: data.canSkipHire,
        }),
        ...(data.status !== undefined && { status: data.status as UserStatus }),
        ...(data.userType !== undefined && {
          userType: data.userType as UserType,
        }),
      },
      select: this.userSelect,
    });
  }

  async getStats() {
    const [totalUsers, totalOrders, pendingApplications, activeJobs] =
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
      ]);
    return { totalUsers, totalOrders, pendingApplications, activeJobs };
  }
}
