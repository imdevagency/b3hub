/**
 * Projects service.
 * Construction project management — allows CONSTRUCTION companies to group
 * their material orders into projects, set contract values, and track P&L.
 */
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignOrdersDto } from './dto/assign-orders.dto';

/** Order statuses that count as committed material spend */
const COMMITTED_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.IN_PROGRESS,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

/** kg CO₂ emitted per km driven (laden, European HGV averages) */
const CO2_FACTORS: Record<string, number> = {
  DUMP_TRUCK: 1.1,
  FLATBED_TRUCK: 0.9,
  SEMI_TRAILER: 0.8,
  HOOK_LIFT: 1.0,
  SKIP_LOADER: 0.9,
  TANKER: 0.9,
  VAN: 0.25,
};

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Authorization helper ──────────────────────────────────────────────────

  private async assertMember(projectId: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (!companyId || project.companyId !== companyId) {
      throw new ForbiddenException('Access denied');
    }
    return project;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(companyId: string) {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: {
            total: true,
            status: true,
            transportJobs: {
              select: {
                distanceKm: true,
                vehicle: { select: { vehicleType: true } },
              },
            },
          },
        },
      },
    });

    return projects.map((p) => this.formatProject(p));
  }

  async findOne(id: string, companyId?: string) {
    await this.assertMember(id, companyId);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            orderType: true,
            total: true,
            deliveryAddress: true,
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
            transportJobs: {
              select: {
                distanceKm: true,
                vehicle: { select: { vehicleType: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    return this.formatProjectDetail(project);
  }

  async create(dto: CreateProjectDto, userId: string, companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('Projects require a company account');
    }

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        clientName: dto.clientName,
        siteAddress: dto.siteAddress,
        contractValue: dto.contractValue,
        budgetAmount: dto.budgetAmount,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        companyId,
        createdById: userId,
      },
    });

    this.logger.log(`Project created: ${project.id} for company ${companyId}`);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, companyId?: string) {
    await this.assertMember(id, companyId);

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.clientName !== undefined && { clientName: dto.clientName }),
        ...(dto.siteAddress !== undefined && { siteAddress: dto.siteAddress }),
        ...(dto.contractValue !== undefined && {
          contractValue: dto.contractValue,
        }),
        ...(dto.budgetAmount !== undefined && {
          budgetAmount: dto.budgetAmount,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && {
          startDate: new Date(dto.startDate),
        }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      },
    });
  }

  // ── Order assignment ──────────────────────────────────────────────────────

  async assignOrders(id: string, dto: AssignOrdersDto, companyId?: string) {
    await this.assertMember(id, companyId);

    // Verify all orders belong to this company
    const orders = await this.prisma.order.findMany({
      where: { id: { in: dto.orderIds } },
      select: { id: true, buyerId: true, projectId: true },
    });

    const unauthorized = orders.filter((o) => o.buyerId !== companyId);
    if (unauthorized.length > 0) {
      throw new ForbiddenException(
        'One or more orders do not belong to your company',
      );
    }

    if (orders.length !== dto.orderIds.length) {
      throw new NotFoundException('One or more orders not found');
    }

    // Warn if any orders are already assigned to a different project
    const alreadyAssigned = orders.filter(
      (o) => o.projectId !== null && o.projectId !== id,
    );
    if (alreadyAssigned.length > 0) {
      throw new BadRequestException(
        `${alreadyAssigned.length} order(s) are already assigned to a different project. Unassign them first.`,
      );
    }

    await this.prisma.order.updateMany({
      where: { id: { in: dto.orderIds } },
      data: { projectId: id },
    });

    return { assigned: orders.length };
  }

  async unassignOrder(id: string, orderId: string, companyId?: string) {
    await this.assertMember(id, companyId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { projectId: true, buyerId: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== companyId)
      throw new ForbiddenException('Access denied');
    if (order.projectId !== id) {
      throw new BadRequestException('Order is not assigned to this project');
    }

    await this.prisma.project.update({
      where: { id },
      data: { orders: { disconnect: { id: orderId } } },
    });

    return { unassigned: 1 };
  }

  // ── P&L financials ────────────────────────────────────────────────────────

  async getFinancials(id: string, companyId?: string) {
    await this.assertMember(id, companyId);

    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        contractValue: true,
        budgetAmount: true,
        orders: {
          select: {
            total: true,
            status: true,
            transportJobs: {
              select: {
                distanceKm: true,
                vehicle: { select: { vehicleType: true } },
              },
            },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const allJobs = project.orders.flatMap((o) => o.transportJobs);
    return this.computeFinancials(
      project.contractValue,
      project.budgetAmount,
      project.orders,
      allJobs,
    );
  }

  // ── Internal formatters ──────────────────────────────────────────────────

  private computeFinancials(
    contractValue: number,
    budgetAmount: number | null,
    orders: { total: number; status: string }[],
    transportJobs: { distanceKm: number | null; vehicle: { vehicleType: string } | null }[] = [],
  ) {
    const materialCosts = orders
      .filter((o) => COMMITTED_STATUSES.includes(o.status as OrderStatus))
      .reduce((sum, o) => sum + o.total, 0);

    const pendingCosts = orders
      .filter((o) => o.status === OrderStatus.PENDING)
      .reduce((sum, o) => sum + o.total, 0);

    const grossMargin = contractValue - materialCosts;
    const marginPct =
      contractValue > 0 ? (grossMargin / contractValue) * 100 : 0;
    const budgetUsedPct =
      budgetAmount && budgetAmount > 0
        ? (materialCosts / budgetAmount) * 100
        : null;

    const co2Kg = transportJobs.reduce((sum, j) => {
      if (!j.distanceKm) return sum;
      const factor = j.vehicle
        ? (CO2_FACTORS[j.vehicle.vehicleType] ?? 0.9)
        : 0.9;
      return sum + j.distanceKm * factor;
    }, 0);

    return {
      contractValue,
      budgetAmount,
      materialCosts,
      pendingCosts,
      grossMargin,
      marginPct: Math.round(marginPct * 10) / 10,
      budgetUsedPct:
        budgetUsedPct !== null ? Math.round(budgetUsedPct * 10) / 10 : null,
      co2Kg: Math.round(co2Kg * 10) / 10,
      co2Tonnes: Math.round(co2Kg / 100) / 10,
    };
  }

  private formatProject(p: {
    id: string;
    name: string;
    description: string | null;
    clientName: string | null;
    siteAddress: string | null;
    contractValue: number;
    budgetAmount: number | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    companyId: string;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    _count: { orders: number };
    orders: {
      total: number;
      status: string;
      transportJobs: { distanceKm: number | null; vehicle: { vehicleType: string } | null }[];
    }[];
  }) {
    const allJobs = p.orders.flatMap((o) => o.transportJobs);
    const financials = this.computeFinancials(
      p.contractValue,
      p.budgetAmount,
      p.orders,
      allJobs,
    );
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      clientName: p.clientName,
      siteAddress: p.siteAddress,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      orderCount: p._count.orders,
      ...financials,
    };
  }

  private formatProjectDetail(p: {
    id: string;
    name: string;
    description: string | null;
    clientName: string | null;
    siteAddress: string | null;
    contractValue: number;
    budgetAmount: number | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    companyId: string;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
    };
    orders: {
      id: string;
      orderNumber: string;
      status: string;
      orderType: string;
      total: number;
      deliveryAddress: string;
      deliveryDate: Date | null;
      createdAt: Date;
      items: {
        material: { name: string; category: string } | null;
        quantity: number;
        unit: string;
        unitPrice: number;
        total: number;
      }[];
      transportJobs: { distanceKm: number | null; vehicle: { vehicleType: string } | null }[];
    }[];
  }) {
    const allJobs = p.orders.flatMap((o) => o.transportJobs);
    const financials = this.computeFinancials(
      p.contractValue,
      p.budgetAmount,
      p.orders,
      allJobs,
    );
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      clientName: p.clientName,
      siteAddress: p.siteAddress,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      createdBy: p.createdBy,
      orders: p.orders.map(({ transportJobs: _tj, ...rest }) => rest),
      orderCount: p.orders.length,
      ...financials,
    };
  }
}
