import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { FrameworkContractStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, companyId?: string) {
    const projects = await this.prisma.project.findMany({
      where: { buyerId: companyId ?? '__never__' },
      include: {
        frameworkContracts: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            totalAgreedQty: true,
            totalConsumedQty: true,
            _count: { select: { positions: true, callOffJobs: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((p) => this.format(p));
  }

  async findOne(id: string, userId: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        frameworkContracts: {
          include: {
            positions: {
              include: {
                callOffs: {
                  select: {
                    id: true,
                    jobNumber: true,
                    cargoWeight: true,
                    status: true,
                    pickupDate: true,
                    deliveryDate: true,
                    pickupCity: true,
                    deliveryCity: true,
                  },
                  orderBy: { createdAt: 'desc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { callOffJobs: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.buyerId !== companyId) {
      throw new ForbiddenException('Access denied');
    }

    return this.format(project);
  }

  async create(dto: CreateProjectDto, userId: string, companyId?: string) {
    if (!companyId) {
      throw new ForbiddenException('A company account is required to create a project');
    }

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        notes: dto.notes,
        buyerId: companyId,
        createdById: userId,
      },
      include: {
        frameworkContracts: true,
      },
    });

    return this.format(project);
  }

  async update(id: string, dto: UpdateProjectDto, userId: string, companyId?: string) {
    await this.assertOwner(id, companyId);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: { frameworkContracts: true },
    });

    return this.format(updated);
  }

  async remove(id: string, userId: string, companyId?: string) {
    await this.assertOwner(id, companyId);
    // Unlink contracts (set projectId = null) before deleting
    await this.prisma.frameworkContract.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });
    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertOwner(id: string, companyId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { buyerId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.buyerId !== companyId) throw new ForbiddenException('Access denied');
  }

  private format(project: any) {
    const contracts = (project.frameworkContracts ?? []).map((c: any) => {
      const agreedQty = c.totalAgreedQty ?? 0;
      const consumedQty = c.totalConsumedQty ?? 0;
      const positions: any[] = c.positions ?? [];

      // Compute progress from positions if available
      let computedAgreed = agreedQty;
      let computedConsumed = consumedQty;
      if (positions.length > 0) {
        computedAgreed = positions.reduce((sum: number, p: any) => sum + (p.agreedQty ?? 0), 0);
        computedConsumed = positions.reduce((sum: number, p: any) => {
          const delivered = (p.callOffs ?? [])
            .filter((co: any) => co.status === 'DELIVERED' || co.status === 'COMPLETED')
            .reduce((s: number, co: any) => s + (co.cargoWeight ?? 0), 0);
          return sum + delivered;
        }, 0);
      }

      return {
        id: c.id,
        contractNumber: c.contractNumber,
        title: c.title,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate ?? null,
        totalAgreedQty: computedAgreed,
        totalConsumedQty: computedConsumed,
        totalProgressPct:
          computedAgreed > 0 ? Math.round((computedConsumed / computedAgreed) * 100) : 0,
        positionCount: c._count?.positions ?? positions.length,
        callOffCount: c._count?.callOffJobs ?? 0,
        positions: positions.length > 0 ? positions : undefined,
      };
    });

    const totalAgreed = contracts.reduce((s: number, c: any) => s + c.totalAgreedQty, 0);
    const totalConsumed = contracts.reduce((s: number, c: any) => s + c.totalConsumedQty, 0);

    return {
      id: project.id,
      title: project.title,
      address: project.address ?? null,
      lat: project.lat ?? null,
      lng: project.lng ?? null,
      notes: project.notes ?? null,
      buyerId: project.buyerId,
      contractCount: contracts.length,
      totalAgreedQty: totalAgreed,
      totalConsumedQty: totalConsumed,
      totalProgressPct: totalAgreed > 0 ? Math.round((totalConsumed / totalAgreed) * 100) : 0,
      contracts,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
