import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FrameworkContractStatus, TransportJobStatus, TransportJobType } from '@prisma/client';
import { CreateFrameworkContractDto, CreatePositionDto } from './dto/create-contract.dto';
import { UpdateFrameworkContractDto } from './dto/update-contract.dto';
import { CreateCallOffDto } from './dto/create-calloff.dto';

@Injectable()
export class FrameworkContractsService {
  private readonly logger = new Logger(FrameworkContractsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(2);
    const count = await this.prisma.frameworkContract.count();
    return `FC${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async generateJobNumber(): Promise<string> {
    const count = await this.prisma.transportJob.count();
    return `TJ-${String(count + 1).padStart(6, '0')}`;
  }

  private async assertOwner(contractId: string, userId: string, companyId?: string) {
    const contract = await this.prisma.frameworkContract.findUnique({
      where: { id: contractId },
      select: { buyerId: true, createdById: true },
    });
    if (!contract) throw new NotFoundException('Framework contract not found');
    if (contract.createdById !== userId && contract.buyerId !== companyId) {
      throw new ForbiddenException('Access denied');
    }
    return contract;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(userId: string, companyId?: string) {
    const contracts = await this.prisma.frameworkContract.findMany({
      where: {
        OR: [
          { createdById: userId },
          ...(companyId ? [{ buyerId: companyId }] : []),
        ],
      },
      include: {
        positions: {
          include: {
            callOffs: {
              select: { id: true, cargoWeight: true, status: true },
            },
          },
        },
        _count: { select: { callOffJobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contracts.map((c) => this.formatContract(c));
  }

  async findOne(id: string, userId: string, companyId?: string) {
    await this.assertOwner(id, userId, companyId);

    const contract = await this.prisma.frameworkContract.findUnique({
      where: { id },
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
                driver: { select: { id: true, firstName: true, lastName: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        callOffJobs: {
          select: {
            id: true,
            jobNumber: true,
            cargoWeight: true,
            status: true,
            pickupDate: true,
            deliveryCity: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        buyer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!contract) throw new NotFoundException('Framework contract not found');
    return this.formatContract(contract);
  }

  async create(dto: CreateFrameworkContractDto, userId: string, companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('A company account is required to create a framework contract');
    }

    const contractNumber = await this.generateContractNumber();

    const contract = await this.prisma.frameworkContract.create({
      data: {
        contractNumber,
        title: dto.title,
        buyerId: companyId,
        createdById: userId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes,
        status: FrameworkContractStatus.ACTIVE,
        positions: dto.positions?.length
          ? {
              create: dto.positions.map((p) => ({
                positionType: p.positionType,
                description: p.description,
                agreedQty: p.agreedQty,
                unit: p.unit ?? 't',
                unitPrice: p.unitPrice,
                pickupAddress: p.pickupAddress,
                pickupCity: p.pickupCity,
                deliveryAddress: p.deliveryAddress,
                deliveryCity: p.deliveryCity,
              })),
            }
          : undefined,
      },
      include: {
        positions: { include: { callOffs: { select: { id: true, cargoWeight: true, status: true } } } },
        _count: { select: { callOffJobs: true } },
      },
    });

    return this.formatContract(contract);
  }

  async update(id: string, dto: UpdateFrameworkContractDto, userId: string, companyId?: string) {
    await this.assertOwner(id, userId, companyId);

    const contract = await this.prisma.frameworkContract.update({
      where: { id },
      data: {
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      include: {
        positions: { include: { callOffs: { select: { id: true, cargoWeight: true, status: true } } } },
        _count: { select: { callOffJobs: true } },
      },
    });

    return this.formatContract(contract);
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  async addPosition(contractId: string, dto: CreatePositionDto, userId: string, companyId?: string) {
    await this.assertOwner(contractId, userId, companyId);

    return this.prisma.frameworkPosition.create({
      data: {
        contractId,
        positionType: dto.positionType,
        description: dto.description,
        agreedQty: dto.agreedQty,
        unit: dto.unit ?? 't',
        unitPrice: dto.unitPrice,
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
      },
    });
  }

  async removePosition(contractId: string, positionId: string, userId: string, companyId?: string) {
    await this.assertOwner(contractId, userId, companyId);

    const position = await this.prisma.frameworkPosition.findFirst({
      where: { id: positionId, contractId },
    });
    if (!position) throw new NotFoundException('Position not found');

    await this.prisma.frameworkPosition.delete({ where: { id: positionId } });
    return { success: true };
  }

  // ── Call-offs ─────────────────────────────────────────────────────────────

  async createCallOff(
    contractId: string,
    positionId: string,
    dto: CreateCallOffDto,
    userId: string,
    companyId?: string,
  ) {
    await this.assertOwner(contractId, userId, companyId);

    const position = await this.prisma.frameworkPosition.findFirst({
      where: { id: positionId, contractId },
      include: {
        callOffs: { select: { cargoWeight: true, status: true } },
      },
    });
    if (!position) throw new NotFoundException('Position not found');

    // Check contingent: sum delivered + in-progress call-offs
    const consumed = position.callOffs
      .filter((j) => j.status !== 'CANCELLED')
      .reduce((sum, j) => sum + (j.cargoWeight ?? 0), 0);

    if (consumed + dto.quantity > position.agreedQty) {
      throw new BadRequestException(
        `Exceeds agreed quantity. Remaining: ${(position.agreedQty - consumed).toFixed(2)} ${position.unit}`,
      );
    }

    const jobNumber = await this.generateJobNumber();

    const jobTypeMap: Record<string, TransportJobType> = {
      MATERIAL_DELIVERY: TransportJobType.MATERIAL_DELIVERY,
      WASTE_DISPOSAL: TransportJobType.WASTE_COLLECTION,
      FREIGHT_TRANSPORT: TransportJobType.TRANSPORT,
    };

    const job = await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType: jobTypeMap[position.positionType] ?? TransportJobType.TRANSPORT,
        frameworkContractId: contractId,
        frameworkPositionId: positionId,
        requestedById: userId,
        cargoType: position.description,
        cargoWeight: dto.quantity,
        pickupAddress: dto.pickupAddress ?? position.pickupAddress ?? '',
        pickupCity: dto.pickupCity ?? position.pickupCity ?? '',
        pickupState: '',
        pickupPostal: '',
        pickupDate: new Date(dto.pickupDate),
        deliveryAddress: dto.deliveryAddress ?? position.deliveryAddress ?? '',
        deliveryCity: dto.deliveryCity ?? position.deliveryCity ?? '',
        deliveryState: '',
        deliveryPostal: '',
        deliveryDate: new Date(dto.deliveryDate),
        rate: position.unitPrice ?? 0,
        pricePerTonne: position.unitPrice,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
      },
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
    });

    return job;
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  private formatContract(c: any) {
    const positions = (c.positions ?? []).map((p: any) => {
      const callOffs = p.callOffs ?? [];
      const consumed = callOffs
        .filter((j: any) => j.status !== 'CANCELLED')
        .reduce((s: number, j: any) => s + (j.cargoWeight ?? 0), 0);
      return {
        id: p.id,
        positionType: p.positionType,
        description: p.description,
        agreedQty: p.agreedQty,
        unit: p.unit,
        unitPrice: p.unitPrice,
        pickupAddress: p.pickupAddress,
        pickupCity: p.pickupCity,
        deliveryAddress: p.deliveryAddress,
        deliveryCity: p.deliveryCity,
        consumedQty: consumed,
        remainingQty: Math.max(0, p.agreedQty - consumed),
        progressPct: p.agreedQty > 0 ? Math.min(100, (consumed / p.agreedQty) * 100) : 0,
        callOffs: p.callOffs ?? [],
      };
    });

    const totalAgreed = positions.reduce((s: number, p: any) => s + p.agreedQty, 0);
    const totalConsumed = positions.reduce((s: number, p: any) => s + p.consumedQty, 0);

    return {
      id: c.id,
      contractNumber: c.contractNumber,
      title: c.title,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      notes: c.notes,
      buyer: c.buyer,
      createdBy: c.createdBy,
      totalCallOffs: c._count?.callOffJobs ?? 0,
      totalAgreedQty: totalAgreed,
      totalConsumedQty: totalConsumed,
      totalProgressPct: totalAgreed > 0 ? Math.min(100, (totalConsumed / totalAgreed) * 100) : 0,
      positions,
      recentCallOffs: c.callOffJobs ?? [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
