/**
 * Framework contracts service.
 * Long-term supply agreements between buyers and suppliers.
 * Manages contract creation, line-item positions, call-off (partial order) releases,
 * and the full contract status lifecycle (draft → active → closed).
 */
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FrameworkContractStatus,
  TransportJobStatus,
  TransportJobType,
} from '@prisma/client';

// ── Local shape types for formatContract ─────────────────────────────────────
export interface RawCallOff {
  status: string;
  cargoWeight?: number | null;
}

export interface RawPosition {
  id: string;
  positionType: string;
  description?: string | null;
  agreedQty: number;
  unit?: string | null;
  unitPrice?: number | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  callOffs?: RawCallOff[];
}

export interface RawContract {
  id: string;
  contractNumber: string;
  title: string;
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  notes?: string | null;
  buyer?: unknown;
  supplier?: unknown;
  createdBy?: unknown;
  _count?: { callOffJobs?: number };
  callOffJobs?: unknown[];
  positions?: RawPosition[];
  createdAt: Date;
  updatedAt: Date;
}

import {
  CreateFrameworkContractDto,
  CreatePositionDto,
} from './dto/create-contract.dto';
import { UpdateFrameworkContractDto } from './dto/update-contract.dto';
import { CreateCallOffDto } from './dto/create-calloff.dto';

@Injectable()
export class FrameworkContractsService {
  private readonly logger = new Logger(FrameworkContractsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private generateContractNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `FC${year}${month}${ms}${rand}`;
  }

  private generateJobNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `TRJ${year}${month}${ms}${rand}`;
  }

  private async assertOwner(
    contractId: string,
    userId: string,
    companyId?: string,
  ) {
    const contract = await this.prisma.frameworkContract.findUnique({
      where: { id: contractId },
      select: { buyerId: true, createdById: true, supplierId: true, status: true },
    });
    if (!contract) throw new NotFoundException('Framework contract not found');
    const isBuyer =
      contract.createdById === userId || contract.buyerId === companyId;
    const isSupplier = companyId && contract.supplierId === companyId;
    if (!isBuyer && !isSupplier) {
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
          ...(companyId ? [{ supplierId: companyId }] : []),
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

    return contracts.map((c) =>
      this.formatContract(c as unknown as RawContract),
    );
  }

  async activate(contractId: string, userId: string, companyId?: string) {
    const contract = await this.assertOwner(contractId, userId, companyId);
    // Only the buyer side can activate; supplier can view but not activate
    if (contract.buyerId !== companyId && contract.createdById !== userId) {
      throw new ForbiddenException('Only the buyer can activate a contract');
    }
    if (contract.status !== FrameworkContractStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot activate a contract that is already ${contract.status}`,
      );
    }
    const updated = await this.prisma.frameworkContract.update({
      where: { id: contractId },
      data: { status: FrameworkContractStatus.ACTIVE },
      include: {
        positions: {
          include: {
            callOffs: { select: { id: true, cargoWeight: true, status: true } },
          },
        },
        _count: { select: { callOffJobs: true } },
      },
    });
    return this.formatContract(updated as unknown as RawContract);
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
                driver: {
                  select: { id: true, firstName: true, lastName: true },
                },
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
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!contract) throw new NotFoundException('Framework contract not found');
    return this.formatContract(contract as unknown as RawContract);
  }

  async create(
    dto: CreateFrameworkContractDto,
    userId: string,
    companyId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException(
        'A company account is required to create a framework contract',
      );
    }

    const contractNumber = this.generateContractNumber();

    const contract = await this.prisma.frameworkContract.create({
      data: {
        contractNumber,
        title: dto.title,
        buyerId: companyId,
        createdById: userId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        notes: dto.notes,
        status: FrameworkContractStatus.DRAFT,
        supplierId: dto.supplierId ?? null,
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
        positions: {
          include: {
            callOffs: { select: { id: true, cargoWeight: true, status: true } },
          },
        },
        _count: { select: { callOffJobs: true } },
      },
    });

    return this.formatContract(contract as unknown as RawContract);
  }

  async update(
    id: string,
    dto: UpdateFrameworkContractDto,
    userId: string,
    companyId?: string,
  ) {
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
        positions: {
          include: {
            callOffs: { select: { id: true, cargoWeight: true, status: true } },
          },
        },
        _count: { select: { callOffJobs: true } },
      },
    });

    return this.formatContract(contract as unknown as RawContract);
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  async addPosition(
    contractId: string,
    dto: CreatePositionDto,
    userId: string,
    companyId?: string,
  ) {
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

  async removePosition(
    contractId: string,
    positionId: string,
    userId: string,
    companyId?: string,
  ) {
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

    // Ensure the contract is active before releasing a call-off
    const parentContract = await this.prisma.frameworkContract.findUnique({
      where: { id: contractId },
      select: { status: true },
    });
    if (parentContract?.status !== FrameworkContractStatus.ACTIVE) {
      throw new BadRequestException(
        'Call-offs can only be created on an ACTIVE contract',
      );
    }

    const jobNumber = this.generateJobNumber();

    const jobTypeMap: Record<string, TransportJobType> = {
      MATERIAL_DELIVERY: TransportJobType.MATERIAL_DELIVERY,
      WASTE_DISPOSAL: TransportJobType.WASTE_COLLECTION,
      FREIGHT_TRANSPORT: TransportJobType.TRANSPORT,
    };

    // Use a transaction with a row-level lock on the position to prevent
    // concurrent call-offs from simultaneously exceeding agreedQty (TOCTOU).
    const job = await this.prisma.$transaction(async (tx) => {
      // Lock the position row for the duration of this transaction
      await tx.$executeRaw`SELECT id FROM framework_positions WHERE id = ${positionId} FOR UPDATE`;

      const position = await tx.frameworkPosition.findFirst({
        where: { id: positionId, contractId },
        include: {
          callOffs: { select: { cargoWeight: true, status: true } },
        },
      });
      if (!position) throw new NotFoundException('Position not found');

      // Check contingent: sum all non-cancelled call-offs
      const consumed = position.callOffs
        .filter((j) => j.status !== 'CANCELLED')
        .reduce((sum, j) => sum + (j.cargoWeight ?? 0), 0);

      if (consumed + dto.quantity > position.agreedQty) {
        throw new BadRequestException(
          `Exceeds agreed quantity. Remaining: ${(position.agreedQty - consumed).toFixed(2)} ${position.unit}`,
        );
      }

      return tx.transportJob.create({
        data: {
          jobNumber,
          jobType:
            jobTypeMap[position.positionType] ?? TransportJobType.TRANSPORT,
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
    });

    return job;
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  private formatContract(c: RawContract) {
    const positions = (c.positions ?? []).map((p: RawPosition) => {
      const callOffs = p.callOffs ?? [];
      const consumed = callOffs
        .filter((j: RawCallOff) => j.status !== 'CANCELLED')
        .reduce((s: number, j: RawCallOff) => s + (j.cargoWeight ?? 0), 0);
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
        progressPct:
          p.agreedQty > 0 ? Math.min(100, (consumed / p.agreedQty) * 100) : 0,
        callOffs: p.callOffs ?? [],
      };
    });

    const totalAgreed = positions.reduce(
      (s: number, p: { agreedQty: number }) => s + p.agreedQty,
      0,
    );
    const totalConsumed = positions.reduce(
      (s: number, p: { consumedQty: number }) => s + p.consumedQty,
      0,
    );

    return {
      id: c.id,
      contractNumber: c.contractNumber,
      title: c.title,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      notes: c.notes,
      buyer: c.buyer,
      supplier: c.supplier,
      createdBy: c.createdBy,
      totalCallOffs: c._count?.callOffJobs ?? 0,
      totalAgreedQty: totalAgreed,
      totalConsumedQty: totalConsumed,
      totalProgressPct:
        totalAgreed > 0
          ? Math.min(100, (totalConsumed / totalAgreed) * 100)
          : 0,
      positions,
      recentCallOffs: c.callOffJobs ?? [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
