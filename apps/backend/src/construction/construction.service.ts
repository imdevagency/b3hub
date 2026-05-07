/**
 * ConstructionService — company-scoped ERP operations.
 *
 * All methods receive a `companyId` from the JWT and enforce ownership.
 * This service is the multi-tenant counterpart of the internal AdminService
 * construction methods. Each external construction company sees only their data.
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProjectStatus,
  ProjectSiteType,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ConstructionService {
  private readonly logger = new Logger(ConstructionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertProjectOwnership(projectId: string, companyId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.companyId !== companyId) throw new ForbiddenException('Access denied');
    return project;
  }

  // ─── Projects ────────────────────────────────────────────────────────────────

  async getProjects(
    companyId: string,
    params: { status?: string; page?: number; limit?: number } = {},
  ) {
    const { status, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ProjectWhereInput = {
      companyId,
      ...(status ? { status: status as ProjectStatus } : {}),
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
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { orders: true, dailyReports: true, clientInvoices: true } },
          orders: { select: { total: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getProjectById(id: string, companyId: string) {
    await this.assertProjectOwnership(id, companyId);
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        sites: true,
        budgetLines: { orderBy: { costCode: 'asc' } },
        _count: {
          select: {
            orders: true,
            dailyReports: true,
            clientInvoices: true,
            subcontractorEngagements: true,
          },
        },
      },
    });
    return project;
  }

  async createProject(
    companyId: string,
    createdById: string,
    data: {
      name: string;
      description?: string;
      clientName?: string;
      siteAddress?: string;
      status?: string;
      contractValue: number;
      budgetAmount?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        clientName: data.clientName,
        siteAddress: data.siteAddress,
        status: (data.status as ProjectStatus) ?? 'PLANNING',
        contractValue: data.contractValue,
        budgetAmount: data.budgetAmount,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        companyId,
        createdById,
      },
    });
  }

  async updateProject(
    id: string,
    companyId: string,
    data: Partial<{
      name: string;
      description: string;
      clientName: string;
      siteAddress: string;
      status: string;
      contractValue: number;
      budgetAmount: number;
      startDate: string;
      endDate: string;
    }>,
  ) {
    await this.assertProjectOwnership(id, companyId);
    const { startDate, endDate, status, ...rest } = data;
    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(status ? { status: status as ProjectStatus } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    });
  }

  // ─── Budget Lines ─────────────────────────────────────────────────────────────

  async getBudgetLines(projectId: string, companyId: string) {
    await this.assertProjectOwnership(projectId, companyId);
    return this.prisma.projectBudgetLine.findMany({
      where: { projectId },
      orderBy: { costCode: 'asc' },
    });
  }

  async setBudgetLines(
    projectId: string,
    companyId: string,
    lines: Array<{ costCode: string; budgetAmount: number; notes?: string }>,
  ) {
    await this.assertProjectOwnership(projectId, companyId);
    await this.prisma.projectBudgetLine.deleteMany({ where: { projectId } });
    return this.prisma.projectBudgetLine.createMany({
      data: lines.map((l) => ({ projectId, costCode: l.costCode as any, budgetAmount: l.budgetAmount, notes: l.notes })),
    });
  }

  // ─── Project Sites ────────────────────────────────────────────────────────────

  async getProjectSites(projectId: string, companyId: string) {
    await this.assertProjectOwnership(projectId, companyId);
    return this.prisma.projectSite.findMany({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createProjectSite(
    projectId: string,
    companyId: string,
    data: { label: string; address: string; lat?: number; lng?: number; type?: string; isDefault?: boolean },
  ) {
    await this.assertProjectOwnership(projectId, companyId);
    const { type, ...rest } = data;
    return this.prisma.projectSite.create({
      data: {
        projectId,
        ...rest,
        ...(type ? { type: type as ProjectSiteType } : {}),
      },
    });
  }

  async deleteProjectSite(siteId: string, projectId: string, companyId: string) {
    await this.assertProjectOwnership(projectId, companyId);
    const site = await this.prisma.projectSite.findUnique({
      where: { id: siteId },
      select: { projectId: true },
    });
    if (!site) throw new NotFoundException('Site not found');
    if (site.projectId !== projectId) throw new ForbiddenException('Access denied');
    await this.prisma.projectSite.delete({ where: { id: siteId } });
  }

  // ─── Clients (unique client names from projects) ──────────────────────────────

  async getClients(companyId: string) {
    const projects = await this.prisma.project.findMany({
      where: { companyId, clientName: { not: null } },
      select: { clientName: true },
      distinct: ['clientName'],
    });
    return projects.map((p) => ({ name: p.clientName! }));
  }
}
