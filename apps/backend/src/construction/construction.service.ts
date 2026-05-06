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
  DailyReportStatus,
  ClientInvoiceStatus,
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

  // ─── Project Documents ────────────────────────────────────────────────────────

  async getProjectDocuments(projectId: string, companyId: string) {
    await this.assertProjectOwnership(projectId, companyId);
    return this.prisma.projectDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProjectDocument(
    projectId: string,
    companyId: string,
    data: { title: string; fileUrl: string; documentType?: string },
  ) {
    await this.assertProjectOwnership(projectId, companyId);
    return this.prisma.projectDocument.create({
      data: { projectId, ...data },
    });
  }

  async deleteProjectDocument(projectId: string, docId: string, companyId: string) {
    await this.assertProjectOwnership(projectId, companyId);
    await this.prisma.projectDocument.delete({ where: { id: docId } });
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

  // ─── Daily Reports ────────────────────────────────────────────────────────────

  async getDailyReports(
    companyId: string,
    params: { projectId?: string; status?: string; page?: number; limit?: number } = {},
  ) {
    const { projectId, status, page = 1, limit = 100 } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.DailyReportWhereInput = {
      project: { companyId },
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as DailyReportStatus } : {}),
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

  async getDailyReportById(id: string, companyId: string) {
    const report = await this.prisma.dailyReport.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, companyId: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          orderBy: { createdAt: 'asc' },
          include: {
            rateEntry: { select: { id: true, name: true, unit: true, pricePerUnit: true } },
            employee: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Daily report not found');
    if (report.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    return report;
  }

  async createDailyReport(
    companyId: string,
    createdById: string,
    data: {
      projectId: string;
      reportDate: string;
      siteLabel?: string;
      weatherNote?: string;
      notes?: string;
      lines?: Array<{
        costCode: string;
        description: string;
        quantity: number;
        unit: string;
        unitRate: number;
        rateEntryId?: string;
        employeeId?: string;
      }>;
    },
  ) {
    await this.assertProjectOwnership(data.projectId, companyId);
    const { lines, reportDate, ...rest } = data;
    return this.prisma.dailyReport.create({
      data: {
        ...rest,
        reportDate: new Date(reportDate),
        createdById,
        lines: lines
          ? {
              create: lines.map((l) => ({
                costCode: l.costCode as any,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit as any,
                unitRate: l.unitRate,
                total: l.quantity * l.unitRate,
                rateEntryId: l.rateEntryId,
                employeeId: l.employeeId,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });
  }

  async updateDailyReport(
    id: string,
    companyId: string,
    data: { status?: string; notes?: string; weatherNote?: string; siteLabel?: string },
  ) {
    const report = await this.prisma.dailyReport.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    const { status, ...rest } = data;
    return this.prisma.dailyReport.update({
      where: { id },
      data: {
        ...rest,
        ...(status ? { status: status as DailyReportStatus } : {}),
      },
    });
  }

  async deleteDailyReport(id: string, companyId: string) {
    const report = await this.prisma.dailyReport.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    await this.prisma.dailyReport.delete({ where: { id } });
  }

  // ─── DPR Templates ────────────────────────────────────────────────────────────

  async getDprTemplates(companyId: string, params: { projectId?: string } = {}) {
    const { projectId } = params;
    // Templates owned by a project that belongs to this company, or company-level (no project)
    const where: Prisma.DprTemplateWhereInput = {
      active: true,
      OR: [
        { project: { companyId } },
        // include global (null projectId) templates only if no project filter
        ...(projectId ? [] : [{ projectId: null }]),
      ],
      ...(projectId ? { projectId } : {}),
    };
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

  async createDprTemplate(
    companyId: string,
    data: {
      name: string;
      description?: string;
      projectId?: string;
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
    if (data.projectId) await this.assertProjectOwnership(data.projectId, companyId);
    const { lines, ...rest } = data;
    return this.prisma.dprTemplate.create({
      data: {
        ...rest,
        lines: lines
          ? {
              create: lines.map((l, i) => ({
                costCode: l.costCode as any,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit as any,
                unitRate: l.unitRate,
                rateEntryId: l.rateEntryId,
                employeeId: l.employeeId,
                notes: l.notes,
                sortOrder: l.sortOrder ?? i,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });
  }

  async updateDprTemplate(
    id: string,
    companyId: string,
    data: { name?: string; description?: string; active?: boolean },
  ) {
    const tpl = await this.prisma.dprTemplate.findUnique({
      where: { id },
      select: { projectId: true, project: { select: { companyId: true } } },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.project && tpl.project.companyId !== companyId)
      throw new ForbiddenException('Access denied');
    return this.prisma.dprTemplate.update({ where: { id }, data });
  }

  async deleteDprTemplate(id: string, companyId: string) {
    const tpl = await this.prisma.dprTemplate.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.project && tpl.project.companyId !== companyId)
      throw new ForbiddenException('Access denied');
    await this.prisma.dprTemplate.update({ where: { id }, data: { active: false } });
  }

  // ─── Rate Entries ─────────────────────────────────────────────────────────────

  async getRateEntries(
    companyId: string,
    params: { category?: string; page?: number; limit?: number } = {},
  ) {
    const { category, page = 1, limit = 200 } = params;
    const skip = (page - 1) * limit;
    // Return company-owned rates + global (null companyId) rates
    const where: Prisma.MaterialRateEntryWhereInput = {
      OR: [{ companyId }, { companyId: null }],
      ...(category ? { category: category as any } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.materialRateEntry.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.materialRateEntry.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async createRateEntry(
    companyId: string,
    data: {
      name: string;
      unit: string;
      category: string;
      supplierName: string;
      supplierNote?: string;
      pricePerUnit: number;
      deliveryFee?: number;
      selfCostPerUnit?: number;
      densityCoeff?: number;
      notes?: string;
    },
  ) {
    return this.prisma.materialRateEntry.create({
      data: {
        name: data.name,
        unit: data.unit as any,
        category: data.category as any,
        supplierName: data.supplierName,
        supplierNote: data.supplierNote,
        pricePerUnit: data.pricePerUnit,
        deliveryFee: data.deliveryFee ?? 0,
        selfCostPerUnit: data.selfCostPerUnit,
        densityCoeff: data.densityCoeff,
        notes: data.notes,
        companyId,
      },
    });
  }

  async updateRateEntry(id: string, companyId: string, data: Partial<{
    name: string; pricePerUnit: number; deliveryFee: number; notes: string;
    selfCostPerUnit: number; densityCoeff: number; supplierNote: string;
  }>) {
    const entry = await this.prisma.materialRateEntry.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!entry) throw new NotFoundException('Rate entry not found');
    if (entry.companyId !== companyId) throw new ForbiddenException('Cannot edit shared rates');
    return this.prisma.materialRateEntry.update({ where: { id }, data });
  }

  async deleteRateEntry(id: string, companyId: string) {
    const entry = await this.prisma.materialRateEntry.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!entry) throw new NotFoundException('Rate entry not found');
    if (entry.companyId !== companyId) throw new ForbiddenException('Cannot delete shared rates');
    await this.prisma.materialRateEntry.delete({ where: { id } });
  }

  // ─── Employees ────────────────────────────────────────────────────────────────

  async getEmployees(
    companyId: string,
    params: { activeOnly?: boolean; page?: number; limit?: number } = {},
  ) {
    const { activeOnly = false, page = 1, limit = 200 } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ConstructionEmployeeWhereInput = {
      companyId,
      ...(activeOnly ? { active: true } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.constructionEmployee.findMany({
        where,
        include: { defaultRateEntry: { select: { id: true, name: true, unit: true } } },
        orderBy: [{ active: 'desc' }, { lastName: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.constructionEmployee.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async createEmployee(
    companyId: string,
    data: {
      firstName: string;
      lastName: string;
      role: string;
      personalCode?: string;
      phone?: string;
      email?: string;
      notes?: string;
      defaultRateEntryId?: string;
    },
  ) {
    return this.prisma.constructionEmployee.create({
      data: { ...data, companyId },
    });
  }

  async updateEmployee(
    id: string,
    companyId: string,
    data: Partial<{ firstName: string; lastName: string; role: string; phone: string; email: string; notes: string; active: boolean; defaultRateEntryId: string }>,
  ) {
    const emp = await this.prisma.constructionEmployee.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    if (emp.companyId !== companyId) throw new ForbiddenException('Access denied');
    return this.prisma.constructionEmployee.update({ where: { id }, data });
  }

  async deleteEmployee(id: string, companyId: string) {
    const emp = await this.prisma.constructionEmployee.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    if (emp.companyId !== companyId) throw new ForbiddenException('Access denied');
    await this.prisma.constructionEmployee.update({ where: { id }, data: { active: false } });
  }

  // ─── Subcontractors ───────────────────────────────────────────────────────────

  async getSubcontractors(
    companyId: string,
    params: { active?: boolean; page?: number; limit?: number } = {},
  ) {
    const { active, page = 1, limit = 200 } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.ConstructionSubcontractorWhereInput = {
      companyId,
      ...(active !== undefined ? { active } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.constructionSubcontractor.findMany({
        where,
        include: { _count: { select: { engagements: true } } },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.constructionSubcontractor.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async createSubcontractor(
    companyId: string,
    data: {
      name: string;
      registrationNo?: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      speciality?: string;
      notes?: string;
    },
  ) {
    return this.prisma.constructionSubcontractor.create({
      data: { ...data, companyId },
    });
  }

  async updateSubcontractor(
    id: string,
    companyId: string,
    data: Partial<{ name: string; registrationNo: string; contactPerson: string; phone: string; email: string; speciality: string; notes: string; active: boolean }>,
  ) {
    const sub = await this.prisma.constructionSubcontractor.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!sub) throw new NotFoundException('Subcontractor not found');
    if (sub.companyId !== companyId) throw new ForbiddenException('Access denied');
    return this.prisma.constructionSubcontractor.update({ where: { id }, data });
  }

  async deleteSubcontractor(id: string, companyId: string) {
    const sub = await this.prisma.constructionSubcontractor.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!sub) throw new NotFoundException('Subcontractor not found');
    if (sub.companyId !== companyId) throw new ForbiddenException('Access denied');
    await this.prisma.constructionSubcontractor.update({ where: { id }, data: { active: false } });
  }

  async getSubcontractorEngagements(projectId: string, companyId: string) {
    await this.assertProjectOwnership(projectId, companyId);
    return this.prisma.subcontractorEngagement.findMany({
      where: { projectId },
      include: { subcontractor: { select: { id: true, name: true, speciality: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubcontractorEngagement(
    projectId: string,
    companyId: string,
    data: { subcontractorId: string; description: string; agreedAmount: number; startDate?: string; endDate?: string; notes?: string },
  ) {
    await this.assertProjectOwnership(projectId, companyId);
    const { startDate, endDate, ...rest } = data;
    return this.prisma.subcontractorEngagement.create({
      data: {
        projectId,
        ...rest,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    });
  }

  async updateSubcontractorEngagement(
    id: string,
    companyId: string,
    data: Partial<{ description: string; agreedAmount: number; status: string; paidAmount: number; notes: string }>,
  ) {
    const eng = await this.prisma.subcontractorEngagement.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!eng) throw new NotFoundException('Engagement not found');
    if (eng.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    return this.prisma.subcontractorEngagement.update({ where: { id }, data: data as any });
  }

  async deleteSubcontractorEngagement(id: string, companyId: string) {
    const eng = await this.prisma.subcontractorEngagement.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!eng) throw new NotFoundException('Engagement not found');
    if (eng.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    await this.prisma.subcontractorEngagement.delete({ where: { id } });
  }

  // ─── Client Invoices ──────────────────────────────────────────────────────────

  async getClientInvoices(
    companyId: string,
    params: { projectId?: string; status?: string; limit?: number; skip?: number } = {},
  ) {
    const { projectId, status, limit = 100, skip = 0 } = params;
    const where: Prisma.ConstructionClientInvoiceWhereInput = {
      project: { companyId },
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as ClientInvoiceStatus } : {}),
    };
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

  async createClientInvoice(
    projectId: string,
    companyId: string,
    body: {
      invoiceNo: string;
      issueDate: string;
      dueDate?: string;
      amount: number;
      vatAmount?: number;
      description?: string;
      status?: string;
      notes?: string;
    },
  ) {
    await this.assertProjectOwnership(projectId, companyId);
    const { issueDate, dueDate, status, ...rest } = body;
    return this.prisma.constructionClientInvoice.create({
      data: {
        projectId,
        ...rest,
        issueDate: new Date(issueDate),
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(status ? { status: status as ClientInvoiceStatus } : {}),
      },
    });
  }

  async updateClientInvoice(
    id: string,
    companyId: string,
    data: Partial<{ status: string; paidAt: string; paidAmount: number; notes: string }>,
  ) {
    const inv = await this.prisma.constructionClientInvoice.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    const { status, paidAt, ...rest } = data;
    return this.prisma.constructionClientInvoice.update({
      where: { id },
      data: {
        ...rest,
        ...(status ? { status: status as ClientInvoiceStatus } : {}),
        ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
      },
    });
  }

  async deleteClientInvoice(id: string, companyId: string) {
    const inv = await this.prisma.constructionClientInvoice.findUnique({
      where: { id },
      select: { project: { select: { companyId: true } } },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.project.companyId !== companyId) throw new ForbiddenException('Access denied');
    await this.prisma.constructionClientInvoice.delete({ where: { id } });
  }

  // ─── Profitability ─────────────────────────────────────────────────────────────

  async getProfitability(
    companyId: string,
    params: { projectId?: string; from?: string; to?: string } = {},
  ) {
    const { projectId, from, to } = params;

    // Fetch company projects in scope
    const projectsWhere: Prisma.ProjectWhereInput = {
      companyId,
      ...(projectId ? { id: projectId } : {}),
    };
    const projects = await this.prisma.project.findMany({
      where: projectsWhere,
      select: {
        id: true,
        name: true,
        contractValue: true,
        budgetAmount: true,
        status: true,
        budgetLines: { select: { costCode: true, budgetAmount: true } },
      },
    });

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return { projects: [] };

    // DPR cost aggregation per project
    const dateFilter = from || to
      ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined }
      : undefined;

    const dprAggs = await this.prisma.dailyReportLine.groupBy({
      by: ['reportId'],
      where: {
        report: {
          projectId: { in: projectIds },
          ...(dateFilter ? { reportDate: dateFilter } : {}),
        },
      },
      _sum: { total: true },
    });

    const reportIds = dprAggs.map((r) => r.reportId);
    const reports = await this.prisma.dailyReport.findMany({
      where: { id: { in: reportIds } },
      select: { id: true, projectId: true },
    });
    const costByProject: Record<string, number> = {};
    for (const agg of dprAggs) {
      const report = reports.find((r) => r.id === agg.reportId);
      if (report) {
        costByProject[report.projectId] = (costByProject[report.projectId] ?? 0) + (agg._sum.total ?? 0);
      }
    }

    return {
      projects: projects.map((p) => ({
        ...p,
        dprCost: costByProject[p.id] ?? 0,
        margin: p.contractValue - (costByProject[p.id] ?? 0),
        marginPct: p.contractValue > 0
          ? Math.round(((p.contractValue - (costByProject[p.id] ?? 0)) / p.contractValue) * 100)
          : 0,
      })),
    };
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
