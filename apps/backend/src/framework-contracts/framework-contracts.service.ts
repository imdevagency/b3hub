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
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
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
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class FrameworkContractsService {
  private readonly logger = new Logger(FrameworkContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * Runs nightly. Finds ACTIVE contracts whose endDate has passed and marks
   * them EXPIRED. Notifies the buyer and supplier so they know to renew.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireContracts(): Promise<void> {
    await withCronLock(this.prisma, 'expireContracts', async () => {
    const now = new Date();
    const expired = await this.prisma.frameworkContract.findMany({
      where: {
        status: FrameworkContractStatus.ACTIVE,
        endDate: { lt: now },
      },
      select: {
        id: true,
        contractNumber: true,
        createdById: true,
        buyerId: true,
        supplierId: true,
      },
    });

    if (expired.length === 0) return;

    await this.prisma.frameworkContract.updateMany({
      where: {
        id: { in: expired.map((c) => c.id) },
        status: FrameworkContractStatus.ACTIVE,
      },
      data: { status: FrameworkContractStatus.EXPIRED },
    });

    this.logger.log(`expireContracts: expired ${expired.length} contract(s)`);

    // Notify owners and supplier company members
    for (const contract of expired) {
      const recipientIds = new Set<string>();
      if (contract.createdById) recipientIds.add(contract.createdById);

      // Also notify any managers/owners in the buyer and supplier companies
      const companyIds = [
        contract.buyerId,
        contract.supplierId,
      ].filter(Boolean) as string[];

      if (companyIds.length > 0) {
        const members = await this.prisma.user.findMany({
          where: { companyId: { in: companyIds } },
          select: { id: true },
        });
        members.forEach((m) => recipientIds.add(m.id));
      }

      if (recipientIds.size > 0) {
        this.notifications
          .createForMany(Array.from(recipientIds), {
            type: NotificationType.SYSTEM_ALERT,
            title: 'Ietvarlīgums ir beidzies',
            message: `Ietvarlīgums ${contract.contractNumber} ir beidzies. Lūdzu, atjauniniet vai noslēdziet jaunu līgumu.`,
            data: { contractId: contract.id },
          })
          .catch((err) => this.logger.warn('Notification (contract expired) failed', (err as Error).message));
      }
    }
    }, this.logger);
  }

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
        projectId: dto.projectId ?? null,
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
    const ownership = await this.assertOwner(id, userId, companyId);

    // Only the buyer side may change contract status
    if (dto.status !== undefined) {
      const isBuyer =
        ownership.buyerId === companyId || ownership.createdById === userId;
      if (!isBuyer) {
        throw new ForbiddenException('Only the buyer can change contract status');
      }
    }

    const contract = await this.prisma.frameworkContract.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
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
    const ownership = await this.assertOwner(contractId, userId, companyId);
    // Only the buyer side can add positions
    const isBuyer =
      ownership.buyerId === companyId || ownership.createdById === userId;
    if (!isBuyer) {
      throw new ForbiddenException('Only the buyer can add positions to a contract');
    }

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
    const ownership = await this.assertOwner(contractId, userId, companyId);
    // Only the buyer side can remove positions
    const isBuyer =
      ownership.buyerId === companyId || ownership.createdById === userId;
    if (!isBuyer) {
      throw new ForbiddenException('Only the buyer can remove positions from a contract');
    }
    // Positions cannot be removed once the contract is active
    if (ownership.status !== FrameworkContractStatus.DRAFT) {
      throw new BadRequestException(
        'Positions can only be removed while the contract is in DRAFT status',
      );
    }

    const position = await this.prisma.frameworkPosition.findFirst({
      where: { id: positionId, contractId },
    });
    if (!position) throw new NotFoundException('Position not found');

    await this.prisma.frameworkPosition.delete({ where: { id: positionId } });
    return { success: true, id: positionId };
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

    // Ensure the contract is active and not past its end date before releasing a call-off
    const parentContract = await this.prisma.frameworkContract.findUnique({
      where: { id: contractId },
      select: { status: true, endDate: true },
    });
    if (parentContract?.status !== FrameworkContractStatus.ACTIVE) {
      throw new BadRequestException(
        'Call-offs can only be created on an ACTIVE contract',
      );
    }
    if (parentContract.endDate && parentContract.endDate < new Date()) {
      throw new BadRequestException(
        'This framework contract has passed its end date. Renew the contract before releasing further call-offs.',
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
          pickupLat: dto.pickupLat ?? null,
          pickupLng: dto.pickupLng ?? null,
          deliveryAddress: dto.deliveryAddress ?? position.deliveryAddress ?? '',
          deliveryCity: dto.deliveryCity ?? position.deliveryCity ?? '',
          deliveryState: '',
          deliveryPostal: '',
          deliveryDate: new Date(dto.deliveryDate),
          deliveryLat: dto.deliveryLat ?? null,
          deliveryLng: dto.deliveryLng ?? null,
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

    // Create an invoice for this call-off if the position has a unitPrice.
    // Framework buyers are billed per call-off via Stripe Payment Link / NET terms.
    if (job.id) {
      const pos = await this.prisma.frameworkPosition.findFirst({
        where: { id: positionId, contractId },
        select: { unitPrice: true },
      });
      if (pos?.unitPrice) {
        this.invoices
          .createForCallOff({
            id: job.id,
            jobNumber: job.jobNumber,
            rate: pos.unitPrice * (dto.quantity ?? 1),
            currency: 'EUR',
            requestedById: userId,
          })
          .catch((err) =>
            this.logger.warn(
              `Failed to create invoice for call-off job ${job.id}: ${(err as Error).message}`,
            ),
          );
      }
    }

    // After the call-off is created, check if the position is now fully consumed.
    // If so, notify both parties so they know to set up a contract amendment.
    (async () => {
      try {
        const pos = await this.prisma.frameworkPosition.findFirst({
          where: { id: positionId },
          include: { callOffs: { select: { cargoWeight: true, status: true } } },
        });
        if (!pos) return;

        const newConsumed = pos.callOffs
          .filter((j) => j.status !== 'CANCELLED')
          .reduce((s, j) => s + (j.cargoWeight ?? 0), 0);
        const remainingQty = pos.agreedQty - newConsumed;
        const isExhausted = remainingQty <= 0;
        const isNearlyExhausted = !isExhausted && remainingQty / pos.agreedQty <= 0.1; // < 10% left

        if (!isExhausted && !isNearlyExhausted) return;

        const contract = await this.prisma.frameworkContract.findUnique({
          where: { id: contractId },
          select: {
            contractNumber: true,
            buyer: { select: { id: true } },
            supplier: { select: { id: true } },
          },
        });
        if (!contract) return;

        const notifyIds = new Set<string>();
        const buyerUsers = await this.prisma.user.findMany({
          where: { companyId: contract.buyer.id },
          select: { id: true },
        });
        const supplierUsers = contract.supplier
          ? await this.prisma.user.findMany({
              where: { companyId: contract.supplier.id },
              select: { id: true },
            })
          : [];
        buyerUsers.forEach((u) => notifyIds.add(u.id));
        supplierUsers.forEach((u) => notifyIds.add(u.id));

        if (notifyIds.size > 0) {
          const title = isExhausted
            ? '📋 Līguma pozīcija pilnībā izlietota'
            : '⚠️ Līguma pozīcija gandrīz izlietota (<10%)';
          const message = isExhausted
            ? `Ietvarlīguma #${contract.contractNumber} pozīcija "${pos.description}" ir pilnībā izlietota (${pos.agreedQty} ${pos.unit}). Nepieciešams līguma grozījums, lai turpinātu.`
            : `Ietvarlīguma #${contract.contractNumber} pozīcijai "${pos.description}" atlikušas tikai ${remainingQty.toFixed(2)} ${pos.unit} (${((remainingQty / pos.agreedQty) * 100).toFixed(1)}%).`;
          await this.notifications.createForMany(Array.from(notifyIds), {
            type: NotificationType.SYSTEM_ALERT,
            title,
            message,
            data: { contractId, positionId, isExhausted, remainingQty },
          });
        }

        if (isExhausted) {
          this.logger.log(
            `createCallOff: position ${positionId} (${pos.description}) on contract ${contractId} fully exhausted`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `createCallOff: post-calloff position check failed: ${(err as Error).message}`,
        );
      }
    })();

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
      projectId: (c as unknown as { projectId?: string | null }).projectId ?? null,
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

  /**
   * Returns all advance invoices for a field contract (buyer view).
   */
  async getAdvanceInvoices(contractId: string, companyId: string) {
    const contract = await this.prisma.frameworkContract.findUnique({
      where: { id: contractId },
      select: { id: true, buyerId: true, isFieldContract: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.buyerId !== companyId) throw new ForbiddenException('Access denied');
    if (!contract.isFieldContract) throw new BadRequestException('Not a field contract');

    return this.prisma.invoice.findMany({
      where: { advanceForContractId: contractId },
      select: {
        id: true,
        invoiceNumber: true,
        subtotal: true,
        tax: true,
        total: true,
        paymentStatus: true,
        dueDate: true,
        paidDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── B3 Fields: advance invoice ────────────────────────────────────────────

  /**
   * Creates an advance invoice for a field contract.
   * When the invoice is paid, admin manually calls markAdvancePaid() to top up the balance.
   */
  async createAdvanceInvoice(
    contractId: string,
    amount: number,
    notes: string | undefined,
    requestingUserId: string,
    companyId: string,
  ) {
    const contract = await this.prisma.frameworkContract.findUnique({
      where: { id: contractId },
      select: { id: true, contractNumber: true, title: true, buyerId: true, status: true, isFieldContract: true },
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!contract.isFieldContract) {
      throw new BadRequestException('Only field contracts support advance invoices');
    }
    if (contract.buyerId !== companyId) {
      throw new ForbiddenException('Contract does not belong to your company');
    }
    if (contract.status !== FrameworkContractStatus.ACTIVE) {
      throw new BadRequestException('Contract must be ACTIVE');
    }

    const TAX_RATE = 0.21;
    const subtotal = Math.round(amount * 100) / 100;
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count();
    const invoiceNumber = `ADV-${year}-${String(count + 1).padStart(5, '0')}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // net 14 days

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        advanceForContractId: contractId,
        buyerCompanyId: companyId,
        subtotal,
        tax,
        total,
        currency: 'EUR',
        dueDate,
        paymentStatus: 'PENDING',
        // Notes stored in pdfUrl field temporarily until we add a notes field to Invoice
      },
    });

    this.logger.log(
      `Advance invoice ${invoiceNumber} created for contract ${contract.contractNumber} — €${total}`,
    );

    return invoice;
  }

  /**
   * Admin-only: marks an advance invoice as paid and increments the contract prepaidBalance.
   */
  async markAdvancePaid(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, subtotal: true, paymentStatus: true, advanceForContractId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.advanceForContractId) {
      throw new BadRequestException('Not an advance invoice');
    }
    if (invoice.paymentStatus === 'PAID') {
      throw new BadRequestException('Invoice already paid');
    }

    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { paymentStatus: 'PAID', paidDate: new Date() },
      }),
      this.prisma.frameworkContract.update({
        where: { id: invoice.advanceForContractId },
        data: { prepaidBalance: { increment: invoice.subtotal } },
      }),
    ]);

    return { success: true, credited: invoice.subtotal };
  }
}
