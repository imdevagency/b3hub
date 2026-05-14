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
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TransportJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { PaymentsService } from '../payments/payments.service';
import { ApusService } from '../apus/apus.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly apus: ApusService,
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
    canRent: true,
    canRecycle: true,
    companyRole: true,
    emailVerified: true,
    createdAt: true,
    company: { select: { id: true, name: true } },
    buyerProfile: {
      select: { creditLimit: true, creditUsed: true, paymentTerms: true },
    },
  } as const;

  async createUser(dto: CreateAdminUserDto, adminId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new ConflictException('User with this email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const isCompany = dto.isCompany ?? !!dto.company;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName ?? '',
        userType: dto.userType ?? 'BUYER',
        isCompany,
        canSell: dto.canSell ?? false,
        canTransport: dto.canTransport ?? false,
        canSkipHire: dto.canSkipHire ?? false,
        canRent: dto.canRent ?? false,
        canRecycle: dto.canRecycle ?? false,
        emailVerified: true,
        termsAcceptedAt: new Date(),
        status: 'ACTIVE',
      },
      select: this.userSelect,
    });

    if (dto.company) {
      const company = await this.prisma.company.create({
        data: {
          name: dto.company.name,
          legalName: dto.company.name,
          registrationNum: dto.company.regNumber,
          companyType: dto.company.companyType,
          email: '',
          phone: '',
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'LV',
        },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          companyRole: 'OWNER',
          permCreateContracts: true,
          permReleaseCallOffs: true,
          permManageOrders: true,
          permViewFinancials: true,
          permManageTeam: true,
        },
      });
      const full = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: this.userSelect,
      });
      this.logAdminAction(
        adminId,
        'CREATE_USER',
        'User',
        user.id,
        {},
        dto,
      ).catch((err) => this.logger.warn(`createUser: audit log failed: ${(err as Error).message}`));
      return full;
    }

    this.logAdminAction(adminId, 'CREATE_USER', 'User', user.id, {}, dto).catch(
      (err) => this.logger.warn(`createUser: audit log failed: ${(err as Error).message}`),
    );
    return user;
  }

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
            id: true,
            name: true,
            legalName: true,
            companyType: true,
            verified: true,
            payoutEnabled: true,
            commissionRate: true,
          },
        },
        ordersCreated: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            currency: true,
            createdAt: true,
          },
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
        id: true,
        name: true,
        legalName: true,
        companyType: true,
        email: true,
        phone: true,
        city: true,
        country: true,
        street: true,
        registrationNum: true,
        taxId: true,
        verified: true,
        payoutEnabled: true,
        commissionRate: true,
        features: true,
        createdAt: true,
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            companyRole: true,
            status: true,
            canSell: true,
            canTransport: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            currency: true,
            createdAt: true,
          },
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
        id: true,
        orderNumber: true,
        orderType: true,
        status: true,
        paymentStatus: true,
        total: true,
        currency: true,
        deliveryAddress: true,
        deliveryCity: true,
        deliveryDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            unit: true,
            material: { select: { id: true, name: true, category: true } },
          },
        },
        transportJobs: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            jobType: true,
            pickupDate: true,
            deliveryDate: true,
            rate: true,
            currency: true,
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
        id: true,
        jobNumber: true,
        jobType: true,
        status: true,
        cargoType: true,
        cargoWeight: true,
        rate: true,
        pricePerTonne: true,
        currency: true,
        pickupAddress: true,
        pickupCity: true,
        deliveryAddress: true,
        deliveryCity: true,
        pickupDate: true,
        deliveryDate: true,
        specialRequirements: true,
        createdAt: true,
        updatedAt: true,
        order: { select: { id: true, orderNumber: true, status: true } },
        carrier: { select: { id: true, name: true } },
        driver: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        vehicle: {
          select: { id: true, make: true, model: true, licensePlate: true },
        },
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
        canRent: true,
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
      data.canRent !== undefined ||
      data.userType !== undefined ||
      data.companyId !== undefined ||
      data.companyRole !== undefined ||
      data.status !== undefined; // status change (suspend/deactivate) must also invalidate JWTs

    // Validate companyId if provided (non-null)
    if (data.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: data.companyId },
        select: { id: true },
      });
      if (!company) throw new NotFoundException('Company not found');
    }

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
        ...(data.canRent !== undefined && {
          canRent: data.canRent,
        }),
        ...(data.canRecycle !== undefined && {
          canRecycle: data.canRecycle,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.userType !== undefined && {
          userType: data.userType,
        }),
        ...(data.companyId !== undefined && { companyId: data.companyId }),
        ...(data.companyRole !== undefined && {
          companyRole: data.companyRole,
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
        isFirstParty: true,
        createdAt: true,
        _count: { select: { users: true, orders: true } },
      },
      orderBy: [{ isFirstParty: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async adminCreateCompany(
    data: {
      name: string;
      legalName: string;
      companyType: string;
      email: string;
      phone: string;
      registrationNum?: string;
      taxId?: string;
      street?: string;
      city?: string;
      postalCode?: string;
      country?: string;
      verified?: boolean;
      features?: string[];
    },
    adminId: string,
  ) {
    this.logger.log(
      `Admin ${adminId} creating company ${data.name} (${data.companyType})`,
    );
    const autoFeatures =
      data.companyType === 'RECYCLER' || data.companyType === 'HYBRID'
        ? ['RECYCLING_MANAGEMENT']
        : [];
    const features = [...new Set([...(data.features ?? []), ...autoFeatures])];
    return this.prisma.company.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        companyType: data.companyType as any,
        email: data.email,
        phone: data.phone,
        registrationNum: data.registrationNum,
        taxId: data.taxId,
        street: data.street ?? '',
        city: data.city ?? '',
        state: '',
        postalCode: data.postalCode ?? '',
        country: data.country ?? 'LV',
        verified: data.verified ?? false,
        features: { set: features as any[] },
      },
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
        features: true,
        createdAt: true,
      },
    });
  }

  async updateCompany(
    id: string,
    data: {
      verified?: boolean;
      commissionRate?: number;
      carrierCommissionRate?: number;
      payoutEnabled?: boolean;
      features?: string[];
      companyType?: string;
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
        features: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    this.logger.log(`Admin ${adminId} updated company ${id}`);
    // Strip features and companyType from the Prisma update payload so we can handle them separately
    // (Prisma scalar-list assignment uses `set:`; companyType must be cast to its enum)
    const { features, companyType, ...scalarData } = data;

    // When reclassifying, auto-adjust RECYCLING_MANAGEMENT
    let resolvedFeatures = features;
    if (companyType !== undefined) {
      const current: string[] = company.features ?? [];
      const needsRecycling =
        companyType === 'RECYCLER' || companyType === 'HYBRID';
      const base = resolvedFeatures ?? current;
      if (needsRecycling && !base.includes('RECYCLING_MANAGEMENT')) {
        resolvedFeatures = [...base, 'RECYCLING_MANAGEMENT'];
      } else if (!needsRecycling) {
        resolvedFeatures = (resolvedFeatures ?? current).filter(
          (f) => f !== 'RECYCLING_MANAGEMENT',
        );
      }
    }

    const result = await this.prisma.company.update({
      where: { id },
      data: {
        ...scalarData,
        ...(companyType !== undefined
          ? { companyType: companyType as any }
          : {}),
        ...(resolvedFeatures !== undefined
          ? { features: { set: resolvedFeatures as any[] } }
          : {}),
      },
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
        features: true,
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
        where: {
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED'] },
        },
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
      PENDING: 0,
      CONFIRMED: 0,
      IN_PROGRESS: 0,
      DELIVERED: 0,
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
      (pendingSupplierPayouts._count.id ?? 0) +
      (pendingCarrierPayouts._count.id ?? 0);
    const pendingPayoutsTotal =
      Math.round(
        ((pendingSupplierPayouts._sum.amount ?? 0) +
          (pendingCarrierPayouts._sum.amount ?? 0)) *
          100,
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
        featured: true,
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

  /**
   * PATCH /admin/materials/:id/details
   * Admin override: edit name, category, price, unit, stock, featured flag.
   * Suppliers own their listings; admin can correct data quality issues.
   */
  async adminUpdateMaterialDetails(
    id: string,
    dto: {
      name?: string;
      category?: string;
      subCategory?: string;
      basePrice?: number;
      unit?: string;
      inStock?: boolean;
      stockQty?: number;
      featured?: boolean;
    },
    adminId: string,
  ) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        category: true,
        subCategory: true,
        basePrice: true,
        unit: true,
        inStock: true,
        stockQty: true,
        featured: true,
      },
    });
    if (!material) throw new NotFoundException('Material not found');

    const updated = await this.prisma.material.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category as any }),
        ...(dto.subCategory !== undefined && { subCategory: dto.subCategory }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.unit !== undefined && { unit: dto.unit as any }),
        ...(dto.inStock !== undefined && { inStock: dto.inStock }),
        ...(dto.stockQty !== undefined && { stockQty: dto.stockQty }),
        ...(dto.featured !== undefined && { featured: dto.featured }),
      },
      select: {
        id: true,
        name: true,
        category: true,
        subCategory: true,
        basePrice: true,
        unit: true,
        inStock: true,
        stockQty: true,
        active: true,
        featured: true,
        supplier: { select: { id: true, name: true, verified: true } },
        _count: { select: { orderItems: true } },
      },
    });

    await this.logAdminAction(
      adminId,
      'MATERIAL_UPDATED',
      'Material',
      id,
      material,
      dto,
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
      where: { companyType: { in: ['SUPPLIER', 'RECYCLER'] } },
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

  /**
   * GET /admin/demand-gaps
   * Unfulfilled demand (expired/cancelled RFQs) + dormant supplier/carrier churn signals.
   * "Dormant" = had activity 30–90 days ago but nothing in the last 30 days.
   */
  async getDemandGaps() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // ── 1. Unfulfilled RFQs ──────────────────────────────────────────────────
    const unfulfilledRfqs = await this.prisma.quoteRequest.findMany({
      where: {
        status: { in: ['EXPIRED', 'CANCELLED'] },
        createdAt: { gte: ninetyDaysAgo },
      },
      select: {
        id: true,
        requestNumber: true,
        materialCategory: true,
        materialName: true,
        quantity: true,
        unit: true,
        deliveryCity: true,
        status: true,
        createdAt: true,
        buyer: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // ── 2. Dormant suppliers ─────────────────────────────────────────────────
    const [recentOrderItems, historicOrderItems] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: thirtyDaysAgo } } },
        select: { material: { select: { supplierId: true } } },
      }),
      this.prisma.orderItem.findMany({
        where: {
          order: { createdAt: { gte: ninetyDaysAgo, lt: thirtyDaysAgo } },
        },
        select: {
          material: { select: { supplierId: true } },
          order: { select: { createdAt: true } },
        },
      }),
    ]);

    const activeSupplierIds = new Set(
      recentOrderItems.map((oi) => oi.material.supplierId),
    );
    const supplierLastOrderMap = new Map<string, Date>();
    for (const oi of historicOrderItems) {
      const sid = oi.material.supplierId;
      const curr = supplierLastOrderMap.get(sid);
      if (!curr || oi.order.createdAt > curr)
        supplierLastOrderMap.set(sid, oi.order.createdAt);
    }
    const dormantSupplierIds = [...supplierLastOrderMap.keys()].filter(
      (id) => !activeSupplierIds.has(id),
    );

    const dormantSupplierDetails =
      dormantSupplierIds.length > 0
        ? await this.prisma.company.findMany({
            where: { id: { in: dormantSupplierIds } },
            select: {
              id: true,
              name: true,
              _count: { select: { materials: { where: { active: true } } } },
            },
          })
        : [];

    const dormantSuppliers = dormantSupplierDetails
      .map((c) => {
        const lastDate = supplierLastOrderMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          activeListings: c._count.materials,
          lastOrderAt: lastDate?.toISOString() ?? null,
          daysSinceLastOrder: lastDate
            ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
            : null,
        };
      })
      .sort(
        (a, b) => (b.daysSinceLastOrder ?? 0) - (a.daysSinceLastOrder ?? 0),
      );

    // ── 3. Dormant carriers ──────────────────────────────────────────────────
    const [recentJobs, historicJobs] = await Promise.all([
      this.prisma.transportJob.findMany({
        where: {
          carrierId: { not: null },
          updatedAt: { gte: thirtyDaysAgo },
          status: { not: 'AVAILABLE' },
        },
        select: { carrierId: true },
      }),
      this.prisma.transportJob.findMany({
        where: {
          carrierId: { not: null },
          updatedAt: { gte: ninetyDaysAgo, lt: thirtyDaysAgo },
          status: { not: 'AVAILABLE' },
        },
        select: { carrierId: true, updatedAt: true },
      }),
    ]);

    const activeCarrierIds = new Set(recentJobs.map((j) => j.carrierId!));
    const carrierLastJobMap = new Map<string, Date>();
    for (const j of historicJobs) {
      if (!j.carrierId) continue;
      const curr = carrierLastJobMap.get(j.carrierId);
      if (!curr || j.updatedAt > curr)
        carrierLastJobMap.set(j.carrierId, j.updatedAt);
    }
    const dormantCarrierIds = [...carrierLastJobMap.keys()].filter(
      (id) => !activeCarrierIds.has(id),
    );

    const dormantCarrierDetails =
      dormantCarrierIds.length > 0
        ? await this.prisma.company.findMany({
            where: { id: { in: dormantCarrierIds }, companyType: 'CARRIER' },
            select: { id: true, name: true },
          })
        : [];

    const dormantCarriers = dormantCarrierDetails
      .map((c) => {
        const lastDate = carrierLastJobMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          lastJobAt: lastDate?.toISOString() ?? null,
          daysSinceLastJob: lastDate
            ? Math.floor((Date.now() - lastDate.getTime()) / 86_400_000)
            : null,
        };
      })
      .sort((a, b) => (b.daysSinceLastJob ?? 0) - (a.daysSinceLastJob ?? 0));

    return {
      unfulfilledRfqs: unfulfilledRfqs.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        materialCategory: r.materialCategory,
        materialName: r.materialName,
        quantity: r.quantity,
        unit: r.unit,
        deliveryCity: r.deliveryCity,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        buyerName:
          `${r.buyer.firstName} ${r.buyer.lastName}`.trim() ||
          (r.buyer.email ?? 'Nav zināms'),
      })),
      dormantSuppliers,
      dormantCarriers,
      summary: {
        unfulfilledRfqCount: unfulfilledRfqs.length,
        dormantSupplierCount: dormantSuppliers.length,
        dormantCarrierCount: dormantCarriers.length,
      },
    };
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
      select: {
        id: true,
        jobNumber: true,
        status: true,
        statusUpdatedAt: true,
      },
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
      throw new BadRequestException(`Cannot reassign a ${job.status} job`);

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
      throw new BadRequestException(
        'User does not have canTransport capability',
      );

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

  async getToiletCabinOrders(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.toiletCabinOrder.findMany({
        select: {
          id: true,
          orderNumber: true,
          address: true,
          city: true,
          lat: true,
          lng: true,
          cabinCount: true,
          hireDays: true,
          deliveryDate: true,
          deliveryWindow: true,
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
      this.prisma.toiletCabinOrder.count(),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * GET /admin/exceptions — all open transport job exceptions (paginated)
   */
  async getExceptions(page = 1, limit = 50, statusFilter?: string) {
    const skip = (page - 1) * limit;
    const where =
      statusFilter && statusFilter !== 'ALL'
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

  async setExceptionInReview(exceptionId: string, adminId: string) {
    const exception = await this.prisma.transportJobException.findUnique({
      where: { id: exceptionId },
      select: { id: true, status: true },
    });
    if (!exception) throw new NotFoundException('Exception not found');
    if (exception.status === 'RESOLVED')
      throw new BadRequestException('Exception is already resolved');

    const updated = await this.prisma.transportJobException.update({
      where: { id: exceptionId },
      data: { status: 'IN_REVIEW' },
      select: { id: true, type: true, status: true },
    });

    await this.logAdminAction(
      adminId,
      'EXCEPTION_SET_IN_REVIEW',
      'TransportJobException',
      exceptionId,
      { status: exception.status },
      { status: 'IN_REVIEW' },
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
          positions: {
            select: { id: true, agreedQty: true, unitPrice: true, unit: true },
          },
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
    if (audience === 'BUYERS')
      where = { userType: 'BUYER', canSell: false, canTransport: false };
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
      for (let i = 0; i < tokens.length; i += 100)
        chunks.push(tokens.slice(i, i + 100));
      for (const chunk of chunks) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(
            chunk.map((token) => ({
              to: token,
              sound: 'default',
              title,
              body: message,
            })),
          ),
        }).catch((err: Error) =>
          this.logger.warn(`Broadcast push chunk error: ${err.message}`),
        );
      }
    }

    await this.logAdminAction(
      adminId,
      'BROADCAST_NOTIFICATION',
      'Notification',
      'bulk',
      {},
      {
        title,
        message,
        audience,
        recipientCount: users.length,
      },
    );

    return { sent: users.length, audience };
  }

  // ── Platform settings ───────────────────────────────────────────────────────

  /** Returns all platform settings as a plain key→value object */
  // Keys whose values must be masked before sending to the client.
  // Values are stored in plaintext in PlatformSetting but NEVER returned as-is.
  private readonly SENSITIVE_SETTING_KEYS = new Set([
    'apus.apiKey',
    'paysera.projectSecret',
    'email.smtpPass',
    'maps.serverApiKey',
    'maps.mobileApiKey',
    'lursoft.apiKey',
    'bis.apiKey',
    'jumis.apiKey',
    'sms.apiKey',
    'sms.authToken',
  ]);

  async getSettings(): Promise<Record<string, string>> {
    const rows = await this.prisma.platformSetting.findMany();
    return Object.fromEntries(
      rows.map((r) => [
        r.key,
        this.SENSITIVE_SETTING_KEYS.has(r.key) && r.value
          ? '••••••••' // mask sensitive values
          : r.value,
      ]),
    );
  }

  /** Bulk-upsert settings. Sensitive keys with the mask placeholder are skipped. */
  async updateSettings(
    settings: Record<string, string>,
    adminId: string,
  ): Promise<Record<string, string>> {
    const entries = Object.entries(settings).filter(
      // Skip if the client sent back our own mask — key was not changed
      ([key, value]) => !(this.SENSITIVE_SETTING_KEYS.has(key) && value === '••••••••'),
    );
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
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.descriptionLv !== undefined && {
          descriptionLv: data.descriptionLv,
        }),
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

  // ── Catalogue CRUD — material categories ──────────────────────────────────

  async adminListMaterialCategories() {
    return this.prisma.materialCategoryDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminUpsertMaterialCategory(code: string, data: Record<string, unknown>) {
    return this.prisma.materialCategoryDefinition.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteMaterialCategory(code: string) {
    await this.prisma.materialCategoryDefinition.delete({ where: { code } });
  }

  // ── Catalogue CRUD — material fractions ───────────────────────────────────

  async adminListMaterialFractions() {
    return this.prisma.materialFractionDefinition.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async adminUpsertMaterialFraction(code: string, data: Record<string, unknown>) {
    return this.prisma.materialFractionDefinition.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, category: (data.category as string) ?? 'OTHER', ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteMaterialFraction(code: string) {
    await this.prisma.materialFractionDefinition.delete({ where: { code } });
  }

  // ── Catalogue CRUD — waste types ──────────────────────────────────────────

  async adminListWasteTypes() {
    return this.prisma.wasteTypeDefinition.findMany({
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async adminUpsertWasteType(code: string, data: Record<string, unknown>) {
    return this.prisma.wasteTypeDefinition.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteWasteType(code: string) {
    await this.prisma.wasteTypeDefinition.delete({ where: { code } });
  }

  // ── Catalogue CRUD — vehicle service categories ───────────────────────────

  async adminListVehicleCategories() {
    return this.prisma.vehicleServiceCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminUpsertVehicleCategory(code: string, data: Record<string, unknown>) {
    return this.prisma.vehicleServiceCategory.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteVehicleCategory(code: string) {
    await this.prisma.vehicleServiceCategory.delete({ where: { code } });
  }

  // ── Catalogue CRUD — toilet cabin types ──────────────────────────────────

  async adminListToiletCabinTypes() {
    return this.prisma.toiletCabinDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminUpsertToiletCabinType(code: string, data: Record<string, unknown>) {
    return this.prisma.toiletCabinDefinition.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteToiletCabinType(code: string) {
    await this.prisma.toiletCabinDefinition.delete({ where: { code } });
  }

  // ── Catalogue CRUD — rental service types ────────────────────────────────

  async adminListRentalServiceTypes() {
    return this.prisma.rentalServiceDefinition.findMany({
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async adminUpsertRentalServiceType(code: string, data: Record<string, unknown>) {
    return this.prisma.rentalServiceDefinition.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteRentalServiceType(code: string) {
    await this.prisma.rentalServiceDefinition.delete({ where: { code } });
  }

  // ── Catalogue CRUD — scrap materials ─────────────────────────────────────

  async adminListScrapMaterials() {
    return this.prisma.scrapMaterialDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async adminUpsertScrapMaterial(code: string, data: Record<string, unknown>) {
    return this.prisma.scrapMaterialDefinition.upsert({
      where: { code },
      create: { code, label: (data.label as string) ?? code, ...(data as any) },
      update: data as any,
    });
  }

  async adminDeleteScrapMaterial(code: string) {
    await this.prisma.scrapMaterialDefinition.delete({ where: { code } });
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
        where: { companyType: 'CARRIER' },
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
            select: {
              skipSize: true,
              price: true,
              currency: true,
              updatedAt: true,
            },
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
          buyer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
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

  /** POST /admin/recycling-centers — admin manually onboards a waste partner */
  async adminCreateRecyclingCenter(
    body: {
      companyId: string;
      name: string;
      address: string;
      city: string;
      state: string;
      postalCode: string;
      coordinates?: { lat: number; lng: number };
      acceptedWasteTypes: string[];
      capacity: number;
      certifications?: string[];
      operatingHours: Record<string, { open: string; close: string } | null>;
      licensed?: boolean;
      licenceNumber?: string;
      apusRegistrationId?: string;
    },
    adminId: string,
  ) {
    const center = await this.prisma.recyclingCenter.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        address: body.address,
        city: body.city,
        state: body.state,
        postalCode: body.postalCode,
        coordinates: body.coordinates ?? undefined,
        acceptedWasteTypes:
          body.acceptedWasteTypes as import('@prisma/client').WasteType[],
        capacity: body.capacity,
        certifications: body.certifications ?? [],
        operatingHours: body.operatingHours,
        licensed: body.licensed ?? false,
        licenceNumber: body.licenceNumber ?? null,
        apusRegistrationId: body.apusRegistrationId ?? null,
        active: true,
      },
      include: {
        company: { select: { id: true, name: true, city: true } },
      },
    });

    await this.logAdminAction(
      adminId,
      'RECYCLING_CENTER_CREATED',
      'RecyclingCenter',
      center.id,
      null,
      { name: center.name, companyId: body.companyId },
    );

    return center;
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

  /** GET /admin/recycling-centers/:id/pricing-rules */
  async adminGetPricingRules(centerId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: centerId },
      select: { id: true },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    return this.prisma.recyclingCenterPricingRule.findMany({
      where: { recyclingCenterId: centerId },
      orderBy: { wasteType: 'asc' },
    });
  }

  /** POST /admin/recycling-centers/:id/pricing-rules — upsert a rule for one waste type */
  async adminUpsertPricingRule(
    centerId: string,
    dto: {
      wasteType: string;
      pricePerTonne: number;
      minimumWeight?: number;
      minimumFee?: number;
      maximumWeight?: number;
      accepted?: boolean;
      notes?: string;
    },
    adminId: string,
  ) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: centerId },
      select: { id: true },
    });
    if (!center) throw new NotFoundException('Recycling center not found');

    const rule = await this.prisma.recyclingCenterPricingRule.upsert({
      where: {
        recyclingCenterId_wasteType: {
          recyclingCenterId: centerId,
          wasteType: dto.wasteType as import('@prisma/client').WasteType,
        },
      },
      create: {
        recyclingCenterId: centerId,
        wasteType: dto.wasteType as import('@prisma/client').WasteType,
        pricePerTonne: dto.pricePerTonne,
        minimumWeight: dto.minimumWeight ?? null,
        minimumFee: dto.minimumFee ?? null,
        maximumWeight: dto.maximumWeight ?? null,
        accepted: dto.accepted ?? true,
        notes: dto.notes ?? null,
      },
      update: {
        pricePerTonne: dto.pricePerTonne,
        minimumWeight: dto.minimumWeight ?? null,
        minimumFee: dto.minimumFee ?? null,
        maximumWeight: dto.maximumWeight ?? null,
        accepted: dto.accepted ?? true,
        notes: dto.notes ?? null,
      },
    });

    await this.logAdminAction(
      adminId,
      'PRICING_RULE_UPSERTED',
      'RecyclingCenterPricingRule',
      rule.id,
      null,
      { centerId, ...dto },
    );

    return rule;
  }

  /** DELETE /admin/recycling-centers/:id/pricing-rules/:wasteType */
  async adminDeletePricingRule(
    centerId: string,
    wasteType: string,
    adminId: string,
  ) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: centerId },
      select: { id: true },
    });
    if (!center) throw new NotFoundException('Recycling center not found');

    await this.prisma.recyclingCenterPricingRule.deleteMany({
      where: {
        recyclingCenterId: centerId,
        wasteType: wasteType as import('@prisma/client').WasteType,
      },
    });

    await this.logAdminAction(
      adminId,
      'PRICING_RULE_DELETED',
      'RecyclingCenterPricingRule',
      `${centerId}_${wasteType}`,
      { wasteType },
      null,
    );

    return { ok: true };
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

    return {
      data: normalised,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * GET /admin/b3-recycling/waste-records
   * All WasteRecord entries, optionally scoped to a specific recycling center.
   * Used by the B3 Recycling waste log and certificates sections.
   */
  async adminGetRecyclingWasteRecords(page = 1, limit = 50, centerId?: string) {
    const skip = (page - 1) * limit;

    const where: import('@prisma/client').Prisma.WasteRecordWhereInput =
      centerId ? { recyclingCenterId: centerId } : {};

    const [data, total] = await Promise.all([
      this.prisma.wasteRecord.findMany({
        where,
        include: {
          recyclingCenter: { select: { id: true, name: true, city: true } },
          containerOrder: {
            select: {
              id: true,
              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  buyer: { select: { id: true, name: true } },
                },
              },
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
    if (order.orderType !== 'DISPOSAL')
      throw new NotFoundException('Order is not a disposal job');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        ...(data.status
          ? { status: data.status as import('@prisma/client').OrderStatus }
          : {}),
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
        processedDate: data.processedDate
          ? new Date(data.processedDate)
          : new Date(),
        recyclableWeight: data.recyclableWeight,
        recyclingRate: data.recyclingRate,
      },
      include: {
        recyclingCenter: { select: { id: true, name: true, city: true } },
      },
    });

    return record;
  }

  /**
   * POST /admin/b3-recycling/waste-records/:id/create-listing
   * Converts a processed WasteRecord into a marketplace Material listing.
   * Sets WasteRecord.producedMaterialId to close the circular economy loop.
   */
  async adminCreateListingFromWasteRecord(
    id: string,
    data: { basePrice: number; name?: string },
  ) {
    const record = await this.prisma.wasteRecord.findUnique({
      where: { id },
      include: {
        recyclingCenter: {
          select: { id: true, name: true, city: true, companyId: true },
        },
      },
    });
    if (!record) throw new NotFoundException('Waste record not found');
    if (record.producedMaterialId) {
      throw new BadRequestException(
        'A supply listing already exists for this waste record',
      );
    }
    if (!record.recyclableWeight || record.recyclableWeight <= 0) {
      throw new BadRequestException(
        'Cannot create a listing: recyclable weight is not set or is zero',
      );
    }

    // Map WasteType → MaterialCategory
    const CATEGORY_MAP: Record<
      string,
      import('@prisma/client').MaterialCategory
    > = {
      CONCRETE: 'RECYCLED_CONCRETE',
      BRICK: 'RECYCLED_CONCRETE',
      SOIL: 'RECYCLED_SOIL',
      WOOD: 'OTHER',
      METAL: 'OTHER',
      PLASTIC: 'OTHER',
      MIXED: 'OTHER',
      HAZARDOUS: 'OTHER',
    };
    const category = CATEGORY_MAP[record.wasteType] ?? 'OTHER';

    const defaultName =
      data.name?.trim() || `RC materiāls — ${record.recyclingCenter.name}`;

    const [material] = await this.prisma.$transaction([
      this.prisma.material.create({
        data: {
          name: defaultName,
          category,
          isRecycled: true,
          basePrice: data.basePrice,
          unit: 'TONNE',
          stockQty: record.recyclableWeight,
          inStock: true,
          supplierId: record.recyclingCenter.companyId,
          certificates: [],
          images: [],
          // Circular economy provenance
          wasteRecordId: record.id,
          recoveryRate: record.recyclingRate ?? null,
          provenanceFacility: record.recyclingCenter.name,
        },
      }),
    ]);

    const updated = await this.prisma.wasteRecord.update({
      where: { id },
      data: { producedMaterialId: material.id },
      include: {
        recyclingCenter: { select: { id: true, name: true, city: true } },
        containerOrder: {
          select: {
            id: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                buyer: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return { wasteRecord: updated, material };
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

    const data = docs.map((d) => ({
      ...d,
      owner: ownerMap[d.ownerId] ?? null,
    }));

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
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        isGenerated: true,
      },
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
              driverProfile: {
                select: { isOnline: true, currentLocation: true, rating: true },
              },
            },
          },
          vehicle: {
            select: { id: true, make: true, model: true, licensePlate: true },
          },
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
        where: { companyType: 'CARRIER', verified: true },
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
        carrierJobMap.set(
          j.carrier.id,
          (carrierJobMap.get(j.carrier.id) ?? 0) + 1,
        );
      }
    }
    for (const d of onlineDrivers) {
      const companyId = d.user.company?.id;
      if (companyId) {
        carrierOnlineMap.set(
          companyId,
          (carrierOnlineMap.get(companyId) ?? 0) + 1,
        );
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

  // ─── B3Hub Platform Finance Stats ─────────────────────────────────────────

  async adminGetFinanceStats() {
    const now = new Date();

    // Month boundaries
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const nonCancelled = { status: { notIn: ['CANCELLED', 'DRAFT'] as any[] } };

    const [
      gmvAllTime,
      gmvThisMonth,
      gmvLastMonth,
      commissionAllTime,
      commissionThisMonth,
      commissionLastMonth,
      orderCountThisMonth,
      orderCountLastMonth,
      byTypeRaw,
      monthlyRaw,
      pendingSupplier,
      pendingCarrier,
      skipGmvThisMonth,
      monthlyPaymentsRaw,
    ] = await Promise.all([
      // GMV all-time
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: nonCancelled,
      }),
      // GMV this month
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { ...nonCancelled, createdAt: { gte: thisMonthStart } },
      }),
      // GMV last month
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          ...nonCancelled,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      // Commission all-time (sum of platformFee on payments)
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: { status: { in: ['RELEASED', 'PAID', 'CAPTURED'] } },
      }),
      // Commission this month
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: {
          status: { in: ['RELEASED', 'PAID', 'CAPTURED'] },
          createdAt: { gte: thisMonthStart },
        },
      }),
      // Commission last month
      this.prisma.payment.aggregate({
        _sum: { platformFee: true },
        where: {
          status: { in: ['RELEASED', 'PAID', 'CAPTURED'] },
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      // Order count this month
      this.prisma.order.count({
        where: { ...nonCancelled, createdAt: { gte: thisMonthStart } },
      }),
      // Order count last month
      this.prisma.order.count({
        where: {
          ...nonCancelled,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      // GMV by order type (all-time)
      this.prisma.order.groupBy({
        by: ['orderType'],
        where: nonCancelled,
        _sum: { total: true },
        _count: { id: true },
      }),
      // Last 12 months of raw orders for GMV trend
      this.prisma.order.findMany({
        where: { ...nonCancelled, createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Pending supplier payouts
      this.prisma.supplierPayout.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'PENDING' },
      }),
      // Pending carrier payouts
      this.prisma.carrierPayout.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: { status: 'PENDING' },
      }),
      // Skip hire GMV this month
      this.prisma.skipHireOrder.aggregate({
        _sum: { price: true },
        _count: { id: true },
        where: {
          status: { not: 'CANCELLED' as any },
          createdAt: { gte: thisMonthStart },
        },
      }),
      // Last 12 months of payments for commission trend
      this.prisma.payment.findMany({
        where: {
          status: { in: ['RELEASED', 'PAID', 'CAPTURED'] },
          createdAt: { gte: twelveMonthsAgo },
        },
        select: { createdAt: true, platformFee: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Build 12-month trend
    const monthMap: Record<
      string,
      { gmv: number; commission: number; orders: number }
    > = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = { gmv: 0, commission: 0, orders: 0 };
    }
    for (const order of monthlyRaw) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[key]) {
        monthMap[key].gmv += order.total;
        monthMap[key].orders++;
      }
    }
    for (const payment of monthlyPaymentsRaw) {
      const d = new Date(payment.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[key]) {
        monthMap[key].commission += payment.platformFee ?? 0;
      }
    }
    const monthlyTrend = Object.entries(monthMap).map(([month, v]) => ({
      month,
      gmv: Math.round(v.gmv * 100) / 100,
      commission: Math.round(v.commission * 100) / 100,
      orders: v.orders,
    }));

    const r = (n: number | null | undefined) =>
      Math.round((n ?? 0) * 100) / 100;

    return {
      gmv: {
        allTime: r(gmvAllTime._sum.total),
        thisMonth: r(gmvThisMonth._sum.total),
        lastMonth: r(gmvLastMonth._sum.total),
        skipThisMonth: r(skipGmvThisMonth._sum.price),
        skipCountThisMonth: skipGmvThisMonth._count.id,
      },
      commission: {
        allTime: r(commissionAllTime._sum.platformFee),
        thisMonth: r(commissionThisMonth._sum.platformFee),
        lastMonth: r(commissionLastMonth._sum.platformFee),
      },
      orders: {
        thisMonth: orderCountThisMonth,
        lastMonth: orderCountLastMonth,
      },
      pendingPayouts: {
        supplierAmount: r(pendingSupplier._sum.amount),
        supplierCount: pendingSupplier._count.id,
        carrierAmount: r(pendingCarrier._sum.amount),
        carrierCount: pendingCarrier._count.id,
        total: r(
          (pendingSupplier._sum.amount ?? 0) +
            (pendingCarrier._sum.amount ?? 0),
        ),
        totalCount: pendingSupplier._count.id + pendingCarrier._count.id,
      },
      byOrderType: byTypeRaw.map((row) => ({
        type: row.orderType,
        gmv: r(row._sum.total),
        count: row._count.id,
      })),
      monthlyTrend,
    };
  }

  // ── APUS (Atkritumu plūsmu uzskaites sistēma) ─────────────────────────────

  /**
   * GET /admin/b3-recycling/apus-stats
   * Dashboard stats: pending/submitted/accepted/rejected counts per center.
   */
  async adminGetApusStats(centerId?: string) {
    const where = centerId ? { recyclingCenterId: centerId } : {};
    const [pending, submitted, accepted, rejected, notRequired] =
      await Promise.all([
        this.prisma.wasteRecord.count({
          where: { ...where, apusStatus: 'PENDING' },
        }),
        this.prisma.wasteRecord.count({
          where: { ...where, apusStatus: 'SUBMITTED' },
        }),
        this.prisma.wasteRecord.count({
          where: { ...where, apusStatus: 'ACCEPTED' },
        }),
        this.prisma.wasteRecord.count({
          where: { ...where, apusStatus: 'REJECTED' },
        }),
        this.prisma.wasteRecord.count({
          where: { ...where, apusStatus: 'NOT_REQUIRED' },
        }),
      ]);
    return {
      pending,
      submitted,
      accepted,
      rejected,
      notRequired,
      total: pending + submitted + accepted + rejected + notRequired,
    };
  }

  /**
   * GET /admin/b3-recycling/apus-records
   * Paginated WasteRecord list with APUS status fields.
   */
  async adminGetApusRecords(
    page = 1,
    limit = 50,
    centerId?: string,
    status?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (centerId) where.recyclingCenterId = centerId;
    if (status) where.apusStatus = status;
    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      this.prisma.wasteRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          wasteType: true,
          weight: true,
          volume: true,
          processedDate: true,
          apusStatus: true,
          apusSubmissionId: true,
          apusSubmittedAt: true,
          apusNote: true,
          bisNumber: true,
          certificateUrl: true,
          createdAt: true,
          recyclingCenter: {
            select: { id: true, name: true, city: true, licensed: true },
          },
          order: { select: { id: true, orderNumber: true } },
          containerOrder: {
            select: {
              id: true,
              order: { select: { id: true, orderNumber: true } },
            },
          },
        },
      }),
      this.prisma.wasteRecord.count({ where }),
    ]);
    return {
      data: records,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * POST /admin/b3-recycling/waste-records/:id/apus-submit
   * Manually submit a single WasteRecord to APUS.
   * Actual VVD API call is stubbed — replace with real HTTP call once API access is obtained.
   */
  async adminApusSubmitRecord(wasteRecordId: string, adminId: string) {
    const record = await this.prisma.wasteRecord.findUniqueOrThrow({
      where: { id: wasteRecordId },
      include: { recyclingCenter: true },
    });
    if (!record.recyclingCenter.licensed) {
      // Non-licensed facility — mark as NOT_REQUIRED
      return this.prisma.wasteRecord.update({
        where: { id: wasteRecordId },
        data: { apusStatus: 'NOT_REQUIRED' },
      });
    }
    if (record.apusStatus === 'ACCEPTED') {
      return { message: 'Already accepted', record };
    }

    // Delegate to the ApusService which handles simulation vs real VVD API call.
    await this.apus.submitWasteRecord(wasteRecordId);

    return this.prisma.wasteRecord.findUniqueOrThrow({
      where: { id: wasteRecordId },
    });
  }

  /**
   * POST /admin/b3-recycling/apus-bulk-submit
   * Submit all PENDING records for a given recycling center.
   */
  async adminApusBulkSubmit(centerId: string, _adminId: string) {
    return this.apus.bulkSubmitForCenter(centerId);
  }

  /**
   * PATCH /admin/b3-recycling/waste-records/:id/apus-status
   * Manually override APUS status (e.g. mark as ACCEPTED after manual VVD portal check,
   * or REJECTED with a reason note).
   */
  async adminApusSetStatus(
    wasteRecordId: string,
    status: string,
    note: string | undefined,
    adminId: string,
  ) {
    return this.prisma.wasteRecord.update({
      where: { id: wasteRecordId },
      data: {
        apusStatus: status as any,
        apusNote: note ?? null,
      },
    });
  }

  // ── Circular Economy Stats ────────────────────────────────────────────────

  /**
   * GET /admin/b3-recycling/circular-economy-stats
   * Platform-wide circular economy KPIs:
   *   waste in → recycled → converted to marketplace listing → sold
   */
  async adminGetCircularEconomyStats() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Pull all waste records
    const allRecords = await this.prisma.wasteRecord.findMany({
      select: {
        id: true,
        weight: true,
        recyclableWeight: true,
        recyclingRate: true,
        producedMaterialId: true,
        processedDate: true,
        createdAt: true,
      },
    });

    const totalWasteInTonnes = allRecords.reduce(
      (s, r) => s + (r.weight ?? 0),
      0,
    );
    const totalRecyclableTonnes = allRecords.reduce(
      (s, r) => s + (r.recyclableWeight ?? 0),
      0,
    );

    const rated = allRecords.filter((r) => r.recyclingRate != null);
    const avgRecoveryRate =
      rated.length > 0
        ? rated.reduce((s, r) => s + (r.recyclingRate ?? 0), 0) / rated.length
        : 0;

    const converted = allRecords.filter((r) => r.producedMaterialId != null);
    const totalConvertedCount = converted.length;
    const totalConvertedTonnes = converted.reduce(
      (s, r) => s + (r.recyclableWeight ?? 0),
      0,
    );

    const pendingConversions = allRecords.filter(
      (r) =>
        r.producedMaterialId == null &&
        (r.recyclableWeight ?? 0) > 0 &&
        r.processedDate != null,
    );
    const pendingConversionCount = pendingConversions.length;
    const pendingConversionTonnes = pendingConversions.reduce(
      (s, r) => s + (r.recyclableWeight ?? 0),
      0,
    );

    const co2SavedTonnes = parseFloat((totalConvertedTonnes * 0.35).toFixed(2));

    // Recycled material listings
    const [activeMaterialListings, soldFromRecycled] = await Promise.all([
      this.prisma.material.count({ where: { isRecycled: true, active: true } }),
      this.prisma.orderItem.aggregate({
        where: {
          material: { isRecycled: true },
          order: { status: 'COMPLETED' },
        },
        _sum: { total: true, quantity: true },
      }),
    ]);

    const revenueFromRecycledMaterials = parseFloat(
      Number(soldFromRecycled._sum.total ?? 0).toFixed(2),
    );
    const quantitySoldTonnes = parseFloat(
      Number(soldFromRecycled._sum.quantity ?? 0).toFixed(2),
    );

    // Monthly trend — last 6 months
    const monthlyMap: Record<
      string,
      { wasteIn: number; recycled: number; converted: number }
    > = {};
    for (let i = 0; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = { wasteIn: 0, recycled: 0, converted: 0 };
    }
    for (const r of allRecords) {
      const ref = r.processedDate ?? r.createdAt;
      if (ref < sixMonthsAgo) continue;
      const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) continue;
      monthlyMap[key].wasteIn += r.weight ?? 0;
      monthlyMap[key].recycled += r.recyclableWeight ?? 0;
      if (r.producedMaterialId)
        monthlyMap[key].converted += r.recyclableWeight ?? 0;
    }
    const monthlyTrend = Object.entries(monthlyMap).map(([month, v]) => ({
      month,
      ...v,
    }));

    return {
      totalWasteInTonnes: parseFloat(totalWasteInTonnes.toFixed(2)),
      totalRecyclableTonnes: parseFloat(totalRecyclableTonnes.toFixed(2)),
      avgRecoveryRate: parseFloat(avgRecoveryRate.toFixed(1)),
      totalConvertedCount,
      totalConvertedTonnes: parseFloat(totalConvertedTonnes.toFixed(2)),
      pendingConversionCount,
      pendingConversionTonnes: parseFloat(pendingConversionTonnes.toFixed(2)),
      co2SavedTonnes,
      activeMaterialListings,
      revenueFromRecycledMaterials,
      quantitySoldTonnes,
      monthlyTrend,
    };
  }

  // ── Market Health ─────────────────────────────────────────────────────────

  /**
   * GET /admin/projects
   * Platform-wide view of all construction projects across all companies,
   * including waste declarations (supply signals) and material needs (demand signals).
   */
  async adminGetAllProjects() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        siteAddress: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        company: { select: { id: true, name: true, city: true } },
        wasteDeclarations: {
          select: {
            id: true,
            wasteType: true,
            estimatedTonnes: true,
            availableFrom: true,
            availableTo: true,
            willingToSell: true,
            notes: true,
          },
          orderBy: { availableFrom: 'asc' },
        },
        materialNeeds: {
          select: {
            id: true,
            materialCategory: true,
            estimatedTonnes: true,
            neededFrom: true,
            neededTo: true,
            notes: true,
          },
          orderBy: { neededFrom: 'asc' },
        },
        _count: { select: { orders: true } },
      },
    });
  }

  /**
   * GET /admin/waste-signals
   * Temporal supply-demand matching:
   *   - For each WasteType: tonnes declared available per month (from ProjectWasteDeclarations)
   *   - RecyclingCenter accepted waste types + monthly capacity (capacityTpd × working days)
   *   - Gap/surplus/match status per type per month
   */
  async adminGetWasteSignals() {
    const now = new Date();
    // Build a 6-month forward window (current + 5 future months)
    const months: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      );
    }

    // ── Supply: project waste declarations ────────────────────────────────────
    const declarations = await this.prisma.projectWasteDeclaration.findMany({
      where: {
        availableTo: { gte: now }, // only future/current windows
      },
      select: {
        wasteType: true,
        estimatedTonnes: true,
        availableFrom: true,
        availableTo: true,
        willingToSell: true,
        project: { select: { company: { select: { name: true } } } },
      },
    });

    // ── Capacity: recycling centers ───────────────────────────────────────────
    const centers = await this.prisma.recyclingCenter.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        capacity: true,
        acceptedWasteTypes: true,
      },
    });

    // ── Demand: project material needs ────────────────────────────────────────
    const materialNeeds = await this.prisma.projectMaterialNeed.findMany({
      where: {
        neededTo: { gte: now },
      },
      select: {
        materialCategory: true,
        estimatedTonnes: true,
        neededFrom: true,
        neededTo: true,
      },
    });

    // ── Build monthly supply map by wasteType ─────────────────────────────────
    // Key: "wasteType:YYYY-MM" → tonnes
    const supplyMap = new Map<string, number>();
    const sellableMap = new Map<string, number>(); // willingToSell=true
    for (const d of declarations) {
      const from = new Date(d.availableFrom);
      const to = new Date(d.availableTo);
      // Distribute tonnes evenly across months in the window
      const windowMonths: string[] = [];
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cur <= to) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        if (months.includes(key)) windowMonths.push(key);
        cur.setMonth(cur.getMonth() + 1);
      }
      if (windowMonths.length === 0) continue;
      const perMonth = d.estimatedTonnes / windowMonths.length;
      for (const m of windowMonths) {
        const k = `${d.wasteType}:${m}`;
        supplyMap.set(k, (supplyMap.get(k) ?? 0) + perMonth);
        if (d.willingToSell) {
          sellableMap.set(k, (sellableMap.get(k) ?? 0) + perMonth);
        }
      }
    }

    // ── Build monthly capacity map by wasteType ───────────────────────────────
    const capacityMap = new Map<string, number>();
    const workingDaysPerMonth = 22;
    for (const center of centers) {
      const monthlyCapacity = (center.capacity ?? 0) * workingDaysPerMonth;
      if (monthlyCapacity === 0) continue;
      for (const wt of center.acceptedWasteTypes) {
        for (const m of months) {
          const k = `${wt}:${m}`;
          capacityMap.set(k, (capacityMap.get(k) ?? 0) + monthlyCapacity);
        }
      }
    }

    // ── Build monthly material demand map ─────────────────────────────────────
    const demandMap = new Map<string, number>();
    for (const n of materialNeeds) {
      const from = new Date(n.neededFrom);
      const to = new Date(n.neededTo);
      const windowMonths: string[] = [];
      const cur = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cur <= to) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
        if (months.includes(key)) windowMonths.push(key);
        cur.setMonth(cur.getMonth() + 1);
      }
      if (windowMonths.length === 0) continue;
      const perMonth = n.estimatedTonnes / windowMonths.length;
      for (const m of windowMonths) {
        const k = `${n.materialCategory}:${m}`;
        demandMap.set(k, (demandMap.get(k) ?? 0) + perMonth);
      }
    }

    // ── All waste types that have any signal ──────────────────────────────────
    const wasteTypes = new Set<string>();
    for (const k of supplyMap.keys()) wasteTypes.add(k.split(':')[0]);
    for (const k of capacityMap.keys()) wasteTypes.add(k.split(':')[0]);

    const wasteSignals = Array.from(wasteTypes)
      .sort()
      .map((wasteType) => {
        const monthlyData = months.map((month) => {
          const supplyTonnes =
            Math.round((supplyMap.get(`${wasteType}:${month}`) ?? 0) * 10) / 10;
          const capacityTonnes =
            Math.round((capacityMap.get(`${wasteType}:${month}`) ?? 0) * 10) /
            10;
          const sellableTonnes =
            Math.round((sellableMap.get(`${wasteType}:${month}`) ?? 0) * 10) /
            10;
          const gap = Math.round((capacityTonnes - supplyTonnes) * 10) / 10; // positive = spare capacity, negative = overflow
          let status: 'COVERED' | 'OVERCAPACITY' | 'GAP' | 'NO_DATA';
          if (supplyTonnes === 0 && capacityTonnes === 0) status = 'NO_DATA';
          else if (supplyTonnes === 0) status = 'OVERCAPACITY';
          else if (capacityTonnes === 0) status = 'GAP';
          else if (gap >= 0) status = 'COVERED';
          else status = 'GAP';
          return {
            month,
            supplyTonnes,
            capacityTonnes,
            sellableTonnes,
            gap,
            status,
          };
        });
        const totalSupply = monthlyData.reduce((s, m) => s + m.supplyTonnes, 0);
        const totalCapacity = monthlyData.reduce(
          (s, m) => s + m.capacityTonnes,
          0,
        );
        const totalSellable = monthlyData.reduce(
          (s, m) => s + m.sellableTonnes,
          0,
        );
        const hasGap = monthlyData.some((m) => m.status === 'GAP');
        return {
          wasteType,
          totalSupply,
          totalCapacity,
          totalSellable,
          hasGap,
          monthlyData,
        };
      });

    // ── All material categories that have demand ──────────────────────────────
    const materialCategories = new Set<string>();
    for (const k of demandMap.keys()) materialCategories.add(k.split(':')[0]);

    const materialSignals = Array.from(materialCategories)
      .sort()
      .map((cat) => {
        const monthlyDemand = months.map((month) => ({
          month,
          demandTonnes:
            Math.round((demandMap.get(`${cat}:${month}`) ?? 0) * 10) / 10,
        }));
        const totalDemand = monthlyDemand.reduce(
          (s, m) => s + m.demandTonnes,
          0,
        );
        return { materialCategory: cat, totalDemand, monthlyDemand };
      });

    return {
      months,
      wasteSignals,
      materialSignals,
      summary: {
        totalDeclarations: declarations.length,
        totalDeclarationTonnes:
          Math.round(
            declarations.reduce((s, d) => s + d.estimatedTonnes, 0) * 10,
          ) / 10,
        totalSellableTonnes:
          Math.round(
            declarations
              .filter((d) => d.willingToSell)
              .reduce((s, d) => s + d.estimatedTonnes, 0) * 10,
          ) / 10,
        totalMaterialNeedTonnes:
          Math.round(
            materialNeeds.reduce((s, n) => s + n.estimatedTonnes, 0) * 10,
          ) / 10,
        wasteTypesWithGap: wasteSignals
          .filter((w) => w.hasGap)
          .map((w) => w.wasteType),
        activeCenters: centers.length,
      },
    };
  }

  /**
   * GET /admin/market-health
   * Cross-side liquidity monitor: supply depth, demand signals, transport
   * coverage, and recycling capacity — all in one response.
   */
  async adminGetMarketHealth() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Supply ────────────────────────────────────────────────────────────────
    const allMaterials = await this.prisma.material.findMany({
      where: { active: true },
      select: { category: true, supplierId: true, isRecycled: true },
    });

    const catListings = new Map<string, number>();
    const catSuppliers = new Map<string, Set<string>>();
    let recycledListings = 0;
    for (const m of allMaterials) {
      catListings.set(m.category, (catListings.get(m.category) ?? 0) + 1);
      const s = catSuppliers.get(m.category) ?? new Set<string>();
      s.add(m.supplierId);
      catSuppliers.set(m.category, s);
      if (m.isRecycled) recycledListings++;
    }
    const categoryCoverage = Array.from(catListings.entries())
      .map(([category, listingCount]) => ({
        category,
        listingCount,
        supplierCount: catSuppliers.get(category)?.size ?? 0,
      }))
      .sort((a, b) => b.listingCount - a.listingCount);

    const thinCategories = categoryCoverage
      .filter((c) => c.supplierCount < 2)
      .map((c) => c.category);

    const [totalSuppliers, totalCarriers, totalRecyclers] = await Promise.all([
      this.prisma.company.count({
        where: { companyType: 'SUPPLIER', verified: true },
      }),
      this.prisma.company.count({
        where: { companyType: 'CARRIER', verified: true },
      }),
      this.prisma.company.count({
        where: { companyType: 'RECYCLER', verified: true },
      }),
    ]);

    // ── Demand ────────────────────────────────────────────────────────────────
    const [
      rfqTotal,
      rfqPending,
      rfqExpired,
      rfqAccepted,
      rfqCancelled,
      rfqByCategory,
    ] = await Promise.all([
      this.prisma.quoteRequest.count(),
      this.prisma.quoteRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.quoteRequest.count({ where: { status: 'EXPIRED' } }),
      this.prisma.quoteRequest.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.quoteRequest.count({ where: { status: 'CANCELLED' } }),
      this.prisma.quoteRequest.groupBy({
        by: ['materialCategory'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const matchDenominator = rfqAccepted + rfqCancelled + rfqExpired;
    const matchRate =
      matchDenominator > 0
        ? parseFloat(((rfqAccepted / matchDenominator) * 100).toFixed(1))
        : 0;

    // Orders last 30 days — how many had no suitable supplier?
    const ordersLast30d = await this.prisma.order.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    const cancelledLast30d = await this.prisma.order.count({
      where: {
        status: { in: ['CANCELLED'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // ── Transport ─────────────────────────────────────────────────────────────
    const [
      availableJobs,
      inProgressJobs,
      completedJobs30d,
      totalJobsCancelled,
    ] = await Promise.all([
      this.prisma.transportJob.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.transportJob.count({
        where: {
          status: {
            in: [
              'ASSIGNED',
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
      this.prisma.transportJob.count({
        where: { status: 'DELIVERED', updatedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.transportJob.count({ where: { status: 'CANCELLED' } }),
    ]);

    const totalJobsAssigned = await this.prisma.transportJob.count({
      where: { status: { not: 'AVAILABLE' } },
    });
    const jobAcceptanceRate =
      totalJobsAssigned > 0
        ? parseFloat(
            (
              ((totalJobsAssigned - totalJobsCancelled) / totalJobsAssigned) *
              100
            ).toFixed(1),
          )
        : 0;

    // ── Recycling ─────────────────────────────────────────────────────────────
    const pendingConversions = await this.prisma.wasteRecord.findMany({
      where: {
        producedMaterialId: null,
        recyclableWeight: { gt: 0 },
        processedDate: { not: null },
      },
      select: { recyclableWeight: true },
    });
    const pendingConversionCount = pendingConversions.length;
    const pendingConversionTonnes = parseFloat(
      pendingConversions
        .reduce((s, r) => s + (r.recyclableWeight ?? 0), 0)
        .toFixed(2),
    );

    const [recyclingCenterCount, totalCapacity] = await Promise.all([
      this.prisma.recyclingCenter.count({ where: { active: true } }),
      this.prisma.recyclingCenter.aggregate({ _sum: { capacity: true } }),
    ]);

    return {
      supply: {
        totalActiveListings: allMaterials.length,
        categoryCoverage,
        recycledListings,
        thinCategories,
        totalSuppliers,
        totalCarriers,
        totalRecyclers,
      },
      demand: {
        totalRfqs: rfqTotal,
        pendingRfqs: rfqPending,
        expiredRfqs: rfqExpired,
        matchRate,
        topRequestedCategories: rfqByCategory.map((r) => ({
          category: r.materialCategory as string,
          count: r._count.id,
        })),
        ordersLast30d,
        cancelledLast30d,
        cancelRate:
          ordersLast30d > 0
            ? parseFloat(((cancelledLast30d / ordersLast30d) * 100).toFixed(1))
            : 0,
      },
      transport: {
        availableJobs,
        inProgressJobs,
        completedJobs30d,
        totalCarriers,
        jobAcceptanceRate,
      },
      recycling: {
        pendingConversionCount,
        pendingConversionTonnes,
        totalRecyclingCenters: recyclingCenterCount,
        totalCapacityTpd: parseFloat(
          Number(totalCapacity._sum.capacity ?? 0).toFixed(1),
        ),
      },
    };
  }

  // ── Market Matching ───────────────────────────────────────────────────────

  /**
   * GET /admin/market-match
   * Per-category and per-waste-type coverage matrix:
   * for every option a buyer can select in a wizard, how many suppliers /
   * recycling centers actually back it up?
   * Status: COVERED (≥2), THIN (1), GAP (0).
   */
  async adminGetMarketMatch() {
    const MATERIAL_CATEGORIES = [
      'SAND',
      'GRAVEL',
      'STONE',
      'CONCRETE',
      'SOIL',
      'RECYCLED_CONCRETE',
      'RECYCLED_SOIL',
      'ASPHALT',
      'CLAY',
      'OTHER',
    ] as const;

    const WASTE_TYPES = [
      'CONCRETE',
      'BRICK',
      'WOOD',
      'METAL',
      'PLASTIC',
      'SOIL',
      'MIXED',
      'HAZARDOUS',
    ] as const;

    // ── 1. Material supply ─────────────────────────────────────────────────
    const activeMaterials = await this.prisma.material.findMany({
      where: { active: true },
      select: { category: true, supplierId: true },
    });

    // ── 2. RFQ demand per category ─────────────────────────────────────────
    const rfqByCategory = await this.prisma.quoteRequest.groupBy({
      by: ['materialCategory'],
      _count: { id: true },
    });

    const pendingRfqByCategory = await this.prisma.quoteRequest.groupBy({
      by: ['materialCategory'],
      where: { status: 'PENDING' },
      _count: { id: true },
    });

    // ── 3. Recycling center waste type coverage ────────────────────────────
    const activeCenters = await this.prisma.recyclingCenter.findMany({
      where: { active: true },
      select: { acceptedWasteTypes: true, capacity: true },
    });

    // ── Process material matching ──────────────────────────────────────────
    const matSuppliersByCat = new Map<string, Set<string>>();
    for (const m of activeMaterials) {
      if (!matSuppliersByCat.has(m.category))
        matSuppliersByCat.set(m.category, new Set());
      matSuppliersByCat.get(m.category)!.add(m.supplierId);
    }

    const rfqTotalMap = new Map<string, number>(
      rfqByCategory.map((r) => [r.materialCategory, r._count.id]),
    );
    const rfqPendingMap = new Map<string, number>(
      pendingRfqByCategory.map((r) => [r.materialCategory, r._count.id]),
    );

    const materialMatrix = MATERIAL_CATEGORIES.map((cat) => {
      const supplierSet = matSuppliersByCat.get(cat) ?? new Set<string>();
      const supplierCount = supplierSet.size;
      const listingCount = activeMaterials.filter(
        (m) => m.category === cat,
      ).length;
      const rfqTotal = rfqTotalMap.get(cat) ?? 0;
      const rfqPending = rfqPendingMap.get(cat) ?? 0;
      const status: 'COVERED' | 'THIN' | 'GAP' =
        supplierCount === 0 ? 'GAP' : supplierCount === 1 ? 'THIN' : 'COVERED';
      return {
        category: cat,
        supplierCount,
        listingCount,
        rfqTotal,
        rfqPending,
        status,
      };
    });

    // ── Process waste type matching ────────────────────────────────────────
    const wasteCoverageMap = new Map<
      string,
      { centerCount: number; capacityTpd: number }
    >(WASTE_TYPES.map((wt) => [wt, { centerCount: 0, capacityTpd: 0 }]));
    for (const center of activeCenters) {
      for (const wt of center.acceptedWasteTypes) {
        const entry = wasteCoverageMap.get(wt);
        if (entry) {
          entry.centerCount++;
          entry.capacityTpd += center.capacity ?? 0;
        }
      }
    }

    const wasteMatrix = WASTE_TYPES.map((wt) => {
      const { centerCount, capacityTpd } = wasteCoverageMap.get(wt)!;
      const status: 'COVERED' | 'THIN' | 'GAP' =
        centerCount === 0 ? 'GAP' : centerCount === 1 ? 'THIN' : 'COVERED';
      return {
        wasteType: wt,
        centerCount,
        capacityTpd: parseFloat(capacityTpd.toFixed(1)),
        status,
      };
    });

    // ── Summary ────────────────────────────────────────────────────────────
    const materialGaps = materialMatrix.filter(
      (m) => m.status === 'GAP',
    ).length;
    const wasteGaps = wasteMatrix.filter((w) => w.status === 'GAP').length;
    const total = MATERIAL_CATEGORIES.length + WASTE_TYPES.length;
    const covered =
      materialMatrix.filter((m) => m.status !== 'GAP').length +
      wasteMatrix.filter((w) => w.status !== 'GAP').length;

    return {
      materialMatrix,
      wasteMatrix,
      summary: {
        totalMaterialCategories: MATERIAL_CATEGORIES.length,
        coveredCategories: materialMatrix.filter((m) => m.status === 'COVERED')
          .length,
        thinCategories: materialMatrix.filter((m) => m.status === 'THIN')
          .length,
        gapCategories: materialGaps,
        totalWasteTypes: WASTE_TYPES.length,
        coveredWasteTypes: wasteMatrix.filter((w) => w.status === 'COVERED')
          .length,
        thinWasteTypes: wasteMatrix.filter((w) => w.status === 'THIN').length,
        gapWasteTypes: wasteGaps,
        matchScore: parseFloat(((covered / total) * 100).toFixed(1)),
      },
    };
  }
}
