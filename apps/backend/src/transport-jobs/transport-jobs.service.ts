/**
 * Transport jobs service.
 * Bulk-material haulage jobs: creation by buyers, acceptance by carriers,
 * real-time GPS tracking, delivery-proof photo uploads, and status transitions
 * (open → assigned → in_progress → completed).
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocumentType,
  TransportExceptionStatus,
  TransportJobStatus,
  OrderStatus,
} from '@prisma/client';
import {
  UpdateStatusDto,
  ALLOWED_DRIVER_STATUSES,
} from './dto/update-status.dto';
import { CreateTransportJobDto } from './dto/create-transport-job.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SubmitDeliveryProofDto } from './dto/submit-delivery-proof.dto';
import { AssignDispatchDto } from './dto/assign-dispatch.dto';
import {
  ReportTransportExceptionDto,
  ResolveTransportExceptionDto,
} from './dto/report-exception.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { DocumentsService } from '../documents/documents.service';
import { UpdatesGateway } from '../updates/updates.gateway';
import { EmailService } from '../email/email.service';
import type { RequestingUser } from '../common/types/requesting-user.interface';

// Valid next-state transitions for a driver
const NEXT_STATUS: Partial<Record<TransportJobStatus, TransportJobStatus>> = {
  [TransportJobStatus.ACCEPTED]: TransportJobStatus.EN_ROUTE_PICKUP,
  [TransportJobStatus.EN_ROUTE_PICKUP]: TransportJobStatus.AT_PICKUP,
  [TransportJobStatus.AT_PICKUP]: TransportJobStatus.LOADED,
  [TransportJobStatus.LOADED]: TransportJobStatus.EN_ROUTE_DELIVERY,
  [TransportJobStatus.EN_ROUTE_DELIVERY]: TransportJobStatus.AT_DELIVERY,
  [TransportJobStatus.AT_DELIVERY]: TransportJobStatus.DELIVERED,
};

const PICKUP_SLA_BUFFER_MIN = 30;
const DELIVERY_SLA_BUFFER_MIN = 30;

@Injectable()
export class TransportJobsService {
  private readonly logger = new Logger(TransportJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly documents: DocumentsService,
    private readonly updates: UpdatesGateway,
    private readonly email: EmailService,
  ) {}

  private isDispatcher(user: RequestingUser): boolean {
    return (
      user.userType === 'ADMIN' ||
      user.companyRole === 'OWNER' ||
      user.companyRole === 'MANAGER' ||
      !!user.permManageOrders ||
      // Allow canTransport company users with no companyRole yet
      // (e.g. first company account before member roles are assigned).
      // DRIVER and MEMBER are field workers, not dispatchers.
      (user.canTransport && user.isCompany && !user.companyRole)
    );
  }

  private async getJobAccessContext(id: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        driverId: true,
        requestedById: true,
        pickupCity: true,
        deliveryCity: true,
        order: {
          select: {
            id: true,
            createdById: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    return job;
  }

  private canAccessExceptions(
    job: Awaited<ReturnType<TransportJobsService['getJobAccessContext']>>,
    user: RequestingUser,
  ): boolean {
    return (
      this.isDispatcher(user) ||
      job.driverId === user.userId ||
      job.requestedById === user.userId ||
      job.order?.createdById === user.userId
    );
  }

  private jobSelect = {
    id: true,
    jobNumber: true,
    jobType: true,
    requiredVehicleType: true,
    requiredVehicleEnum: true,
    cargoType: true,
    cargoWeight: true,
    pickupAddress: true,
    pickupCity: true,
    pickupLat: true,
    pickupLng: true,
    pickupDate: true,
    pickupWindow: true,
    deliveryAddress: true,
    deliveryCity: true,
    deliveryLat: true,
    deliveryLng: true,
    deliveryDate: true,
    deliveryWindow: true,
    distanceKm: true,
    rate: true,
    pricePerTonne: true,
    currency: true,
    status: true,
    actualWeightKg: true,
    pickupPhotoUrl: true,
    driverId: true,
    driver: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
      },
    },
    vehicle: {
      select: { id: true, licensePlate: true, vehicleType: true },
    },
    order: {
      select: {
        id: true,
        orderNumber: true,
        buyerId: true,
        siteContactName: true,
        siteContactPhone: true,
      },
    },
  } as const;

  private statusSortOrder: Record<TransportJobStatus, number> = {
    AVAILABLE: 0,
    ASSIGNED: 1,
    ACCEPTED: 2,
    EN_ROUTE_PICKUP: 3,
    AT_PICKUP: 4,
    LOADED: 5,
    EN_ROUTE_DELIVERY: 6,
    AT_DELIVERY: 7,
    DELIVERED: 8,
    CANCELLED: 9,
  };

  private getSlaState(job: {
    status: TransportJobStatus;
    pickupDate: Date;
    deliveryDate: Date;
  }) {
    const now = Date.now();
    if (
      job.status === TransportJobStatus.DELIVERED ||
      job.status === TransportJobStatus.CANCELLED
    ) {
      return {
        stage: null as null | 'PICKUP_DELAY' | 'DELIVERY_DELAY',
        overdueMinutes: 0,
      };
    }

    const pickupDeadline =
      new Date(job.pickupDate).getTime() + PICKUP_SLA_BUFFER_MIN * 60_000;
    const deliveryDeadline =
      new Date(job.deliveryDate).getTime() + DELIVERY_SLA_BUFFER_MIN * 60_000;

    const preLoaded =
      this.statusSortOrder[job.status] <
      this.statusSortOrder[TransportJobStatus.LOADED];

    if (preLoaded && now > pickupDeadline) {
      return {
        stage: 'PICKUP_DELAY' as const,
        overdueMinutes: Math.floor((now - pickupDeadline) / 60_000),
      };
    }

    if (!preLoaded && now > deliveryDeadline) {
      return {
        stage: 'DELIVERY_DELAY' as const,
        overdueMinutes: Math.floor((now - deliveryDeadline) / 60_000),
      };
    }

    return {
      stage: null as null | 'PICKUP_DELAY' | 'DELIVERY_DELAY',
      overdueMinutes: 0,
    };
  }

  private async evaluateAndEscalateSla(jobId: string) {
    // Compatibility mode: some environments have not yet applied SLA columns.
    // Keep endpoints functional by skipping persistent SLA escalation writes.
    return;
  }

  private mapWithSla<
    T extends {
      status: TransportJobStatus;
      pickupDate: Date;
      deliveryDate: Date;
    },
  >(job: T) {
    const sla = this.getSlaState(job);
    return {
      ...job,
      sla: {
        stage: sla.stage,
        overdueMinutes: sla.overdueMinutes,
        isOverdue: !!sla.stage,
      },
    };
  }

  // ── Create a new transport job ────────────────────────────────
  async createAsUser(dto: CreateTransportJobDto, user: RequestingUser) {
    if (!this.isDispatcher(user)) {
      throw new ForbiddenException(
        'You do not have permission to create transport jobs',
      );
    }
    return this.create(dto);
  }

  async create(dto: CreateTransportJobDto) {
    const jobNumber = this.generateJobNumber();
    const job = await this.prisma.transportJob.create({
      data: {
        jobNumber,
        jobType: dto.jobType,
        pickupAddress: dto.pickupAddress,
        pickupCity: dto.pickupCity,
        pickupState: dto.pickupState ?? '',
        pickupPostal: dto.pickupPostal ?? '',
        pickupDate: new Date(dto.pickupDate),
        pickupWindow: dto.pickupWindow,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        deliveryAddress: dto.deliveryAddress,
        deliveryCity: dto.deliveryCity,
        deliveryState: dto.deliveryState ?? '',
        deliveryPostal: dto.deliveryPostal ?? '',
        deliveryDate: new Date(dto.deliveryDate),
        deliveryWindow: dto.deliveryWindow,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        cargoType: dto.cargoType,
        cargoWeight: dto.cargoWeight,
        cargoVolume: dto.cargoVolume,
        specialRequirements: dto.specialRequirements,
        requiredVehicleType: dto.requiredVehicleType,
        requiredVehicleEnum: dto.requiredVehicleEnum,
        distanceKm: dto.distanceKm,
        rate: dto.rate,
        pricePerTonne: dto.pricePerTonne,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
        ...(dto.orderId ? { order: { connect: { id: dto.orderId } } } : {}),
      },
      select: this.jobSelect,
    });

    // Notify all active drivers about the new job (fire-and-forget)
    this.notifyAllDrivers(
      `🚚 Jauns darbs: ${dto.pickupCity} → ${dto.deliveryCity}`,
      `${dto.cargoType}${dto.cargoWeight ? ` • ${dto.cargoWeight}t` : ''} • ${dto.distanceKm ? `${Math.round(dto.distanceKm ?? 0)} km` : 'attālums nav norādīts'}`,
    ).catch(() => {});

    this.logger.log(
      `Transport job ${job.jobNumber} created (${dto.pickupCity} → ${dto.deliveryCity})`,
    );
    return job;
  }

  private async notifyAllDrivers(title: string, message: string) {
    const drivers = await this.prisma.user.findMany({
      where: { canTransport: true, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifications.createForMany(
      drivers.map((d) => d.id),
      { type: NotificationType.SYSTEM_ALERT, title, message },
    );
  }

  private generateJobNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const ms = (Date.now() % 100_000).toString().padStart(5, '0');
    const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `TRJ${year}${month}${ms}${rand}`;
  }

  /**
   * When the driver submits an actual weight at LOADED, compare it against the
   * ordered quantity. If there is a material difference (>1%), update the linked
   * invoice and order totals to reflect the actual delivered weight and notify
   * the buyer of the adjustment.
   *
   * @param orderId  The order linked to this transport job
   * @param actualWeightKg  Weigh-bridge reading in kg
   */
  private async reconcileInvoiceWeight(
    orderId: string,
    actualWeightKg: number,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { quantity: true, unit: true, unitPrice: true } },
        invoices: { select: { id: true, paymentStatus: true } },
      },
    });

    if (!order || order.items.length === 0) return;

    // Only reconcile PENDING invoices — do not touch paid invoices
    const invoice = order.invoices.find(
      (inv) => inv.paymentStatus === 'PENDING',
    );
    if (!invoice) return;

    // Convert actual weight to tonnes (same unit as order quantity)
    const actualTonnes = actualWeightKg / 1000;
    const orderedTonnes = Number(order.items[0].quantity);

    // Skip if within 1% tolerance
    const diff = Math.abs(actualTonnes - orderedTonnes);
    if (orderedTonnes === 0 || diff / orderedTonnes < 0.01) return;

    // Recalculate totals based on actual weight
    const unitPrice = Number(order.items[0].unitPrice);
    const actualSubtotal = Math.round(actualTonnes * unitPrice * 100) / 100;
    const actualTax = Math.round(actualSubtotal * 0.21 * 100) / 100;
    const actualTotal = actualSubtotal + actualTax;
    const deliveryFee = Number(order.deliveryFee ?? 0);

    await this.prisma.$transaction([
      // Update invoice
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: actualSubtotal,
          tax: actualTax,
          total: actualTotal + deliveryFee,
        },
      }),
      // Update order totals
      this.prisma.order.update({
        where: { id: orderId },
        data: {
          subtotal: actualSubtotal,
          tax: actualTax,
          total: actualTotal + deliveryFee,
        },
      }),
    ]);

    // Notify buyer of the adjustment
    const direction =
      actualTonnes > orderedTonnes ? 'palielināts' : 'samazināts';
    const delta = Math.abs(actualTonnes - orderedTonnes).toFixed(2);
    this.notifications
      .create({
        userId: order.createdById,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Rēķins precizēts',
        message: `Pasūtījums #${order.orderNumber}: faktiskais svars ${actualTonnes.toFixed(2)} t (pasūtīts ${orderedTonnes.toFixed(2)} t, starpība ${delta} t). Rēķins ${direction}. Jauna summa: €${(actualTotal + deliveryFee).toFixed(2)}.`,
        data: { orderId, invoiceId: invoice.id },
      })
      .catch(() => null);

    this.logger.log(
      `Invoice ${invoice.id} reconciled for order ${orderId}: ${orderedTonnes}t ordered → ${actualTonnes.toFixed(3)}t actual (€${order.total} → €${(actualTotal + deliveryFee).toFixed(2)})`,
    );
  }

  // ── All jobs (dispatcher fleet view) ─────────────────────────
  async findAllAsUser(user: RequestingUser) {
    if (!this.isDispatcher(user)) {
      throw new ForbiddenException(
        'You do not have permission to view fleet jobs',
      );
    }
    return this.findAll();
  }

  async findAll() {
    const jobs = await this.prisma.transportJob.findMany({
      select: this.jobSelect,
      orderBy: { pickupDate: 'asc' },
    });

    await Promise.all(jobs.map((j) => this.evaluateAndEscalateSla(j.id)));
    return jobs.map((j) => this.mapWithSla(j));
  }

  // ── Available jobs (job board) ─────────────────────────────────
  async findAvailable(limit: number = 20, skip: number = 0) {
    const [jobs, total] = await Promise.all([
      this.prisma.transportJob.findMany({
        where: { status: TransportJobStatus.AVAILABLE },
        select: this.jobSelect,
        orderBy: { pickupDate: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.transportJob.count({
        where: { status: TransportJobStatus.AVAILABLE },
      }),
    ]);

    return {
      data: jobs.map((j) => this.mapWithSla(j)),
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    };
  }

  // ── My active job (in-progress job for the logged-in driver) ──
  async findMyActiveJob(driverId: string) {
    const activeStatuses: TransportJobStatus[] = [
      TransportJobStatus.ACCEPTED,
      TransportJobStatus.EN_ROUTE_PICKUP,
      TransportJobStatus.AT_PICKUP,
      TransportJobStatus.LOADED,
      TransportJobStatus.EN_ROUTE_DELIVERY,
      TransportJobStatus.AT_DELIVERY,
    ];

    const job = await this.prisma.transportJob.findFirst({
      where: { driverId, status: { in: activeStatuses } },
      select: this.jobSelect,
      orderBy: { updatedAt: 'desc' },
    });

    if (!job) return null;
    await this.evaluateAndEscalateSla(job.id);
    return this.mapWithSla(job);
  }

  // ── My completed/all jobs ─────────────────────────────────────
  async findMyJobs(driverId: string, limit: number = 20, skip: number = 0) {
    const [jobs, total] = await Promise.all([
      this.prisma.transportJob.findMany({
        where: { driverId },
        select: this.jobSelect,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.transportJob.count({
        where: { driverId },
      }),
    ]);

    return {
      data: jobs.map((j) => this.mapWithSla(j)),
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    };
  }

  /**
   * Returns all WASTE_COLLECTION and TRANSPORT jobs that the given user
   * originally requested (via the disposal or freight booking wizard) with pagination.
   */
  async findMyRequests(userId: string, limit: number = 20, skip: number = 0) {
    const [jobs, total] = await Promise.all([
      this.prisma.transportJob.findMany({
        where: {
          requestedById: userId,
          jobType: { in: ['WASTE_COLLECTION', 'TRANSPORT'] },
        },
        select: this.jobSelect,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.transportJob.count({
        where: {
          requestedById: userId,
          jobType: { in: ['WASTE_COLLECTION', 'TRANSPORT'] },
        },
      }),
    ]);

    return {
      data: jobs.map((j) => this.mapWithSla(j)),
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    };
  }

  // ── Single job ────────────────────────────────────────────────
  async findOneAsUser(id: string, user: RequestingUser) {
    const job = await this.getJobAccessContext(id);

    if (!this.isDispatcher(user)) {
      const isDirectParticipant =
        job.driverId === user.userId ||
        job.requestedById === user.userId ||
        job.order?.createdById === user.userId;

      let isSupplierParticipant = false;
      if (
        !isDirectParticipant &&
        job.order?.id &&
        user.companyId &&
        (user.canSell || user.permManageOrders)
      ) {
        const count = await this.prisma.orderItem.count({
          where: {
            orderId: job.order.id,
            material: { supplierId: user.companyId },
          },
        });
        isSupplierParticipant = count > 0;
      }

      if (!isDirectParticipant && !isSupplierParticipant) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.findOne(id);
  }

  async findOne(id: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: this.jobSelect,
    });
    if (!job) throw new NotFoundException('Transport job not found');
    await this.evaluateAndEscalateSla(job.id);
    return this.mapWithSla(job);
  }

  async findSlaOverdue() {
    const jobs = await this.prisma.transportJob.findMany({
      where: {
        status: {
          in: [
            TransportJobStatus.AVAILABLE,
            TransportJobStatus.ACCEPTED,
            TransportJobStatus.EN_ROUTE_PICKUP,
            TransportJobStatus.AT_PICKUP,
            TransportJobStatus.LOADED,
            TransportJobStatus.EN_ROUTE_DELIVERY,
            TransportJobStatus.AT_DELIVERY,
          ],
        },
      },
      select: this.jobSelect,
      orderBy: { pickupDate: 'asc' },
    });

    await Promise.all(jobs.map((j) => this.evaluateAndEscalateSla(j.id)));
    return jobs
      .map((j) => this.mapWithSla(j))
      .filter((j) => j.sla.isOverdue)
      .sort((a, b) => b.sla.overdueMinutes - a.sla.overdueMinutes);
  }

  async findOpenExceptions() {
    return this.prisma.transportJobException.findMany({
      where: { status: TransportExceptionStatus.OPEN },
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        transportJob: {
          select: {
            id: true,
            jobNumber: true,
            status: true,
            pickupCity: true,
            deliveryCity: true,
            driver: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
  }

  async getDocumentReadiness(id: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        jobType: true,
        orderId: true,
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');

    const requiresWeighingSlip =
      job.jobType === 'MATERIAL_DELIVERY' || job.jobType === 'WASTE_COLLECTION';
    const requiresDeliveryProof = true;

    const [deliveryProof, weighingSlip, deliveryNote] = await Promise.all([
      this.prisma.deliveryProof.findUnique({
        where: { transportJobId: id },
        select: { id: true },
      }),
      job.orderId
        ? this.prisma.document.findFirst({
            where: {
              orderId: job.orderId,
              type: DocumentType.WEIGHING_SLIP,
              status: { not: 'ARCHIVED' },
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.document.findFirst({
        where: {
          transportJobId: id,
          type: DocumentType.DELIVERY_NOTE,
          status: { not: 'ARCHIVED' },
        },
        select: { id: true },
      }),
    ]);

    const hasDeliveryProof = !!deliveryProof;
    const hasWeighingSlip = !!weighingSlip;
    const hasDeliveryNote = !!deliveryNote;

    const missing: string[] = [];
    if (requiresDeliveryProof && !hasDeliveryProof)
      missing.push('DELIVERY_PROOF');
    if (requiresWeighingSlip && !hasWeighingSlip) missing.push('WEIGHING_SLIP');

    return {
      transportJobId: id,
      status: job.status,
      requires: {
        deliveryProof: requiresDeliveryProof,
        weighingSlip: requiresWeighingSlip,
      },
      has: {
        deliveryProof: hasDeliveryProof,
        weighingSlip: hasWeighingSlip,
        deliveryNote: hasDeliveryNote,
      },
      canMarkDelivered: missing.length === 0,
      missing,
    };
  }

  // ── Accept a job ──────────────────────────────────────────────
  async accept(id: string, driverId: string) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.status !== TransportJobStatus.AVAILABLE) {
      throw new BadRequestException('Job is no longer available');
    }

    // Ensure driver has no other active job
    const activeJob = await this.findMyActiveJob(driverId);
    if (activeJob) {
      throw new BadRequestException(
        'You already have an active job. Complete it first.',
      );
    }

    const updatedJob = await this.prisma.transportJob.update({
      where: { id },
      data: {
        status: TransportJobStatus.ACCEPTED,
        driverId,
      },
      select: this.jobSelect,
    });

    // Notify buyer if job has an order
    const buyerId = updatedJob.order?.buyerId ?? undefined;
    if (buyerId) {
      this.notifications
        .create({
          userId: buyerId,
          type: NotificationType.TRANSPORT_ASSIGNED,
          title: '🚚 Šoferis pieņēmis darbu',
          message: `${updatedJob.jobNumber} • ${updatedJob.pickupCity} → ${updatedJob.deliveryCity}`,
          data: { jobId: updatedJob.id },
        })
        .catch(() => {});
    }

    return updatedJob;
  }

  // ── Avoid Empty Runs — return trip suggestions ────────────
  // Returns AVAILABLE jobs whose pickup location is within `radiusKm`
  // of the given coords (typically the driver's delivery destination).
  async findReturnTrips(lat: number, lng: number, radiusKm: number) {
    const available = await this.prisma.transportJob.findMany({
      where: { status: TransportJobStatus.AVAILABLE },
      select: this.jobSelect,
      orderBy: { pickupDate: 'asc' },
    });

    return available
      .filter((job) => {
        if (job.pickupLat == null || job.pickupLng == null) return false;
        return (
          this.haversineKm(lat, lng, job.pickupLat, job.pickupLng) <= radiusKm
        );
      })
      .map((job) => ({
        ...job,
        returnDistanceKm: Math.round(
          this.haversineKm(lat, lng, job.pickupLat!, job.pickupLng!),
        ),
      }))
      .sort((a, b) => a.returnDistanceKm - b.returnDistanceKm);
  }

  private haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── List drivers (canTransport users) ──────────────────────────
  async findDriversAsUser(user: RequestingUser) {
    if (!this.isDispatcher(user)) {
      throw new ForbiddenException(
        'You do not have permission to view drivers',
      );
    }
    return this.findDrivers();
  }

  async findDrivers() {
    return this.prisma.user.findMany({
      where: { canTransport: true },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { firstName: 'asc' },
    });
  }

  // ── Dispatcher: assign vehicle + driver to a job ──────────────
  async assign(id: string, body: AssignDispatchDto) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.status !== TransportJobStatus.AVAILABLE) {
      throw new BadRequestException(
        'Job is no longer available for assignment',
      );
    }

    return this.applyAssignment(id, body.driverId, body.vehicleId);
  }

  // ── Dispatcher: reassign pre-dispatch job ─────────────────────
  async reassign(id: string, body: AssignDispatchDto) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.status !== TransportJobStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only ACCEPTED jobs can be reassigned. In-progress jobs must be handled as exceptions.',
      );
    }

    const updated = await this.applyAssignment(
      id,
      body.driverId,
      body.vehicleId,
    );

    if (job.driverId && job.driverId !== body.driverId) {
      this.notifications
        .create({
          userId: job.driverId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'ℹ️ Darbs pārdalīts',
          message: `Darbs ${updated.jobNumber} tika pārdalīts citam šoferim`,
          data: { jobId: updated.id },
        })
        .catch(() => {});
    }

    return updated;
  }

  // ── Dispatcher: unassign pre-dispatch job ─────────────────────
  async unassign(id: string, reason?: string) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.status === TransportJobStatus.AVAILABLE) {
      return this.findOne(id);
    }

    if (job.status !== TransportJobStatus.ACCEPTED) {
      throw new BadRequestException(
        'Only ACCEPTED jobs can be unassigned. In-progress jobs must be handled as exceptions.',
      );
    }

    const updated = await this.prisma.transportJob.update({
      where: { id },
      data: {
        status: TransportJobStatus.AVAILABLE,
        driverId: null,
        vehicleId: null,
      },
      select: this.jobSelect,
    });

    if (job.driverId) {
      this.notifications
        .create({
          userId: job.driverId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'ℹ️ Darbs noņemts',
          message: `Darbs ${updated.jobNumber} ir noņemts no jūsu saraksta${reason ? `: ${reason}` : ''}`,
          data: { jobId: updated.id },
        })
        .catch(() => {});
    }

    return updated;
  }

  private async applyAssignment(
    id: string,
    driverId: string,
    vehicleId?: string,
  ) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, firstName: true, lastName: true, email: true, canTransport: true },
    });
    if (!driver || !driver.canTransport) {
      throw new BadRequestException('User is not a valid driver');
    }

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
    }

    const updated = await this.prisma.transportJob.update({
      where: { id },
      data: {
        driverId,
        vehicleId: vehicleId ?? null,
        status: TransportJobStatus.ACCEPTED,
      },
      select: this.jobSelect,
    });

    this.notifications
      .create({
        userId: driverId,
        type: NotificationType.TRANSPORT_ASSIGNED,
        title: '🚚 Jums piešķirts darbs',
        message: `${updated.jobNumber} • ${updated.pickupCity} → ${updated.deliveryCity}`,
        data: { jobId: updated.id },
      })
      .catch(() => {});

    if (driver.email) {
      const driverName = `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim();
      this.email
        .sendDriverJobAssigned(driver.email, driverName, {
          jobNumber: updated.jobNumber,
          pickupCity: updated.pickupCity,
          deliveryCity: updated.deliveryCity,
          scheduledDate: updated.pickupDate,
        })
        .catch(() => {});
    }

    return updated;
  }

  // ── Update status ─────────────────────────────────────────────
  async updateStatus(id: string, driverId: string, dto: UpdateStatusDto) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.driverId !== driverId) {
      throw new ForbiddenException('This is not your job');
    }

    if (!ALLOWED_DRIVER_STATUSES.includes(dto.status)) {
      throw new BadRequestException(`Cannot set status to ${dto.status}`);
    }

    const expectedNext = NEXT_STATUS[job.status];
    if (expectedNext !== dto.status) {
      throw new BadRequestException(
        `Invalid transition: ${job.status} → ${dto.status}. Expected → ${expectedNext}`,
      );
    }

    // Weight ticket required when loading
    if (dto.status === TransportJobStatus.LOADED && !dto.weightKg) {
      throw new BadRequestException(
        'Weight ticket reading (weightKg) is required when marking job as LOADED',
      );
    }

    if (dto.status === TransportJobStatus.DELIVERED) {
      const readiness = await this.getDocumentReadiness(id);
      if (!readiness.canMarkDelivered) {
        throw new BadRequestException(
          `Cannot mark DELIVERED: missing required documents (${readiness.missing.join(', ')}). Submit delivery proof first.`,
        );
      }
    }

    const updatedJob = await this.prisma.transportJob.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === TransportJobStatus.LOADED && dto.weightKg
          ? { actualWeightKg: dto.weightKg }
          : {}),
        ...(dto.status === TransportJobStatus.LOADED && dto.pickupPhotoUrl
          ? { pickupPhotoUrl: dto.pickupPhotoUrl }
          : {}),
      },
      select: this.jobSelect,
    });

    // Auto-generate documents on key transitions
    const orderId = updatedJob.order?.id;

    if (dto.status === TransportJobStatus.LOADED && orderId) {
      // Fetch order owner (createdById = buyer user)
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { createdById: true },
      });
      if (order?.createdById) {
        const weight = dto.weightKg ?? updatedJob.cargoWeight;
        this.documents
          .generateWeighingSlip(orderId, order.createdById, weight ?? 0, 't')
          .catch(() => {});
      }

      // Reconcile invoice if actual weight differs from the ordered quantity
      if (dto.weightKg) {
        this.reconcileInvoiceWeight(orderId, dto.weightKg).catch(() => null);
      }
    }

    // Notify relevant parties on key transitions
    if (orderId) {
      const orderForNotify = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { createdById: true, orderNumber: true },
      });
      const buyerId = orderForNotify?.createdById;
      if (buyerId) {
        const orderNum = orderForNotify?.orderNumber ?? updatedJob.jobNumber;
        const driverName = updatedJob.driver
          ? `${updatedJob.driver.firstName} ${updatedJob.driver.lastName}`
          : 'Šoferis';

        if (dto.status === TransportJobStatus.EN_ROUTE_PICKUP) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.SYSTEM_ALERT,
              title: '🚚 Šoferis dodas uz iekraušanu',
              message: `${driverName} dodas uz iekraušanas vietu • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch(() => {});
        } else if (dto.status === TransportJobStatus.LOADED) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.SYSTEM_ALERT,
              title: '📦 Krava iekrauta',
              message: `Krava iekrauta, šoferis dodas uz Jums • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch(() => {});
        } else if (dto.status === TransportJobStatus.EN_ROUTE_DELIVERY) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.SYSTEM_ALERT,
              title: '🚛 Piegāde ceļā',
              message: `${driverName} dodas uz piegādes vietu • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch(() => {});
        } else if (dto.status === TransportJobStatus.AT_DELIVERY) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.SYSTEM_ALERT,
              title: '📍 Šoferis ieradies',
              message: `${driverName} ir ieradies piegādes vietā • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch(() => {});
        } else if (dto.status === TransportJobStatus.DELIVERED) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.ORDER_DELIVERED,
              title: '✅ Piegāde pabeigta',
              message: `Pasūtījums ${orderNum} ir veiksmīgi piegādāts.`,
              data: { jobId: updatedJob.id },
            })
            .catch(() => {});
        }
      }
    }

    if (dto.status === TransportJobStatus.DELIVERED && orderId) {
      const order2 = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { createdById: true },
      });
      if (order2?.createdById) {
        const driver = updatedJob.driver;
        this.documents
          .generateDeliveryNote({
            orderId,
            transportJobId: updatedJob.id,
            ownerId: order2.createdById,
            jobNumber: updatedJob.jobNumber,
            pickupCity: updatedJob.pickupCity,
            deliveryCity: updatedJob.deliveryCity,
            driverName: driver
              ? `${driver.firstName} ${driver.lastName}`
              : undefined,
          })
          .catch(() => {});
      }
    }

    // Broadcast real-time status change to subscribed clients (fire-and-forget)
    this.updates.broadcastJobStatus({
      jobId: updatedJob.id,
      status: dto.status,
      orderId: orderId ?? undefined,
    });

    return updatedJob;
  }

  // ── Driver: update GPS location ─────────────────────────
  async updateLocation(id: string, driverId: string, dto: UpdateLocationDto) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');
    if (job.driverId !== driverId)
      throw new ForbiddenException('This is not your job');

    const location = {
      lat: dto.lat,
      lng: dto.lng,
      updatedAt: new Date().toISOString(),
    };

    // Update job's currentLocation
    await this.prisma.transportJob.update({
      where: { id },
      data: { currentLocation: location },
    });

    // Also update the driver profile's currentLocation if it exists
    await this.prisma.driverProfile.updateMany({
      where: { userId: driverId },
      data: { currentLocation: location },
    });

    // Broadcast real-time location to subscribed clients (fire-and-forget)
    this.updates.broadcastJobLocation({ jobId: id, lat: dto.lat, lng: dto.lng });

    return location;
  }

  // ── Get current GPS location for a job ───────────────────────
  async getLocationAsUser(id: string, user: RequestingUser) {
    await this.findOneAsUser(id, user);
    return this.getLocation(id);
  }

  async getLocation(id: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        currentLocation: true,
        pickupLat: true,
        pickupLng: true,
        pickupAddress: true,
        deliveryLat: true,
        deliveryLng: true,
        deliveryAddress: true,
        estimatedArrival: true,
      },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    return job;
  }

  // ── Submit delivery proof (transitions job → DELIVERED) ──────
  async submitDeliveryProof(
    id: string,
    driverId: string,
    dto: SubmitDeliveryProofDto,
  ) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');
    if (job.driverId !== driverId)
      throw new ForbiddenException('This is not your job');
    if (job.status !== TransportJobStatus.AT_DELIVERY) {
      throw new BadRequestException('Job must be AT_DELIVERY to submit proof');
    }

    const readiness = await this.getDocumentReadiness(id);
    const blockingMissing = readiness.missing.filter(
      (doc) => doc !== 'DELIVERY_PROOF',
    );
    if (blockingMissing.length > 0) {
      throw new BadRequestException(
        `Cannot submit delivery proof: missing required documents (${blockingMissing.join(', ')}).`,
      );
    }

    await this.prisma.deliveryProof.create({
      data: {
        transportJobId: id,
        recipientName: dto.recipientName?.trim() || 'Confirmed',
        recipientSignature: 'CONFIRMED',
        driverSignature: 'CONFIRMED',
        photos: dto.photos ?? [],
        notes: dto.notes,
        deliveredAt: new Date(),
      },
    });

    const delivered = await this.prisma.transportJob.update({
      where: { id },
      data: {
        status: TransportJobStatus.DELIVERED,
      },
      select: this.jobSelect,
    });

    // Auto-generate DELIVERY_NOTE (CMR) for the buyer and mark the linked order as DELIVERED
    if (job.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: job.orderId },
        select: { createdById: true, status: true },
      });
      if (order?.createdById) {
        const driver = delivered.driver;
        this.documents
          .generateDeliveryNote({
            orderId: job.orderId,
            transportJobId: id,
            ownerId: order.createdById,
            jobNumber: delivered.jobNumber,
            pickupAddress: delivered.pickupAddress ?? undefined,
            pickupCity: delivered.pickupCity,
            deliveryAddress: delivered.deliveryAddress ?? undefined,
            deliveryCity: delivered.deliveryCity,
            driverName: driver
              ? `${driver.firstName} ${driver.lastName}`
              : undefined,
            driverPhone: driver?.phone ?? undefined,
            vehiclePlate: delivered.vehicle?.licensePlate ?? undefined,
            cargoType: delivered.cargoType ?? undefined,
            cargoWeightKg: delivered.cargoWeight
              ? Number(delivered.cargoWeight)
              : undefined,
            actualWeightKg: delivered.actualWeightKg ?? undefined,
            orderNumber: delivered.order?.orderNumber ?? undefined,
            siteContactName: delivered.order?.siteContactName ?? undefined,
            deliveredAt: new Date(),
          })
          .catch(() => {});

        // Advance the linked order to DELIVERED if it's not already in a terminal state
        if (
          order.status !== OrderStatus.DELIVERED &&
          order.status !== OrderStatus.COMPLETED &&
          order.status !== OrderStatus.CANCELLED
        ) {
          await this.prisma.order
            .update({
              where: { id: job.orderId },
              data: { status: OrderStatus.DELIVERED },
            })
            .catch((err) =>
              this.logger.error(
                `Failed to auto-advance order ${job.orderId} to DELIVERED after delivery proof`,
                err,
              ),
            );
        }
      }
    }

    return delivered;
  }

  // ── LoadingDock — seller confirms driver loaded ───────────────
  // Called from the seller's LoadingDock screen when the driver arrives
  // at the pickup yard. Seller enters weight and confirms loading.
  // Transitions AT_PICKUP → LOADED and auto-generates WEIGHING_SLIP.
  async loadingDockAsUser(id: string, user: RequestingUser, weightKg?: number) {
    if (user.userType === 'ADMIN') {
      return this.loadingDock(id, weightKg);
    }

    const canManageSupplierOrders =
      !!user.companyId &&
      (user.canSell ||
        user.companyRole === 'OWNER' ||
        user.companyRole === 'MANAGER' ||
        user.permManageOrders);

    if (!canManageSupplierOrders) {
      throw new ForbiddenException(
        'Only supplier operators can confirm loading dock actions',
      );
    }

    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: { orderId: true },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    if (!job.orderId) {
      throw new ForbiddenException(
        'Loading dock is only available for order-linked jobs',
      );
    }

    const supplierMatchCount = await this.prisma.orderItem.count({
      where: {
        orderId: job.orderId,
        material: { supplierId: user.companyId },
      },
    });
    if (supplierMatchCount === 0) {
      throw new ForbiddenException(
        'This transport job is not linked to your supplier company',
      );
    }

    return this.loadingDock(id, weightKg);
  }

  async loadingDock(id: string, weightKg?: number) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.status !== TransportJobStatus.AT_PICKUP) {
      // Be lenient: if already LOADED, return current state (driver got there first)
      if (job.status === TransportJobStatus.LOADED) {
        return this.findOne(id);
      }
      throw new BadRequestException(
        `LoadingDock requires job to be AT_PICKUP (current: ${job.status})`,
      );
    }

    const updatedJob = await this.prisma.transportJob.update({
      where: { id },
      data: {
        status: TransportJobStatus.LOADED,
        ...(weightKg != null ? { actualWeightKg: weightKg } : {}),
      },
      select: this.jobSelect,
    });

    // Auto-generate WEIGHING_SLIP document for the buyer
    if (job.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: job.orderId },
        select: { createdById: true },
      });
      if (order?.createdById) {
        const weight = weightKg ?? job.cargoWeight;
        this.documents
          .generateWeighingSlip(
            job.orderId,
            order.createdById,
            weight ?? 0,
            't',
          )
          .catch(() => {});
      }
    }

    // Notify driver they are cleared to depart
    if (job.driverId) {
      this.notifications
        .create({
          userId: job.driverId,
          type: NotificationType.SYSTEM_ALERT,
          title: '✅ Iekraušana apstiprināta',
          message: `Darbs ${updatedJob.jobNumber} — varat doties uz piegādes vietu`,
        })
        .catch(() => {});
    }

    return updatedJob;
  }

  // ── Exception flows ──────────────────────────────────────────
  async listExceptions(id: string, user: RequestingUser) {
    const job = await this.getJobAccessContext(id);
    if (!this.canAccessExceptions(job, user)) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.transportJobException.findMany({
      where: { transportJobId: id },
      include: {
        reportedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reportException(
    id: string,
    user: RequestingUser,
    dto: ReportTransportExceptionDto,
  ) {
    const job = await this.getJobAccessContext(id);
    if (!this.canAccessExceptions(job, user)) {
      throw new ForbiddenException('Access denied');
    }

    const ex = await this.prisma.transportJobException.create({
      data: {
        transportJobId: id,
        type: dto.type,
        notes: dto.notes,
        photoUrls: dto.photoUrls ?? [],
        reportedById: user.userId,
      },
      include: {
        reportedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const actorName =
      user.email?.trim() ||
      (user.companyId
        ? `Lietotājs (${user.companyId})`
        : `Lietotājs ${user.userId}`);
    const msg = `Darbs ${job.jobNumber} • ${dto.type} • ${job.pickupCity} → ${job.deliveryCity}`;

    const notifyIds = new Set<string>();
    if (job.driverId && job.driverId !== user.userId)
      notifyIds.add(job.driverId);
    if (job.requestedById && job.requestedById !== user.userId)
      notifyIds.add(job.requestedById);
    if (job.order?.createdById && job.order.createdById !== user.userId)
      notifyIds.add(job.order.createdById);

    if (notifyIds.size > 0) {
      this.notifications
        .createForMany(Array.from(notifyIds), {
          type: NotificationType.SYSTEM_ALERT,
          title: '⚠️ Ziņots izņēmuma gadījums',
          message: `${msg} • Ziņoja: ${actorName}`,
          data: { jobId: id, exceptionId: ex.id },
        })
        .catch(() => {});
    }

    return ex;
  }

  async resolveException(
    id: string,
    exceptionId: string,
    resolverUserId: string,
    dto: ResolveTransportExceptionDto,
  ) {
    const job = await this.getJobAccessContext(id);

    const ex = await this.prisma.transportJobException.findFirst({
      where: { id: exceptionId, transportJobId: id },
      select: { id: true, status: true, reportedById: true },
    });
    if (!ex) throw new NotFoundException('Transport exception not found');
    if (ex.status === TransportExceptionStatus.RESOLVED) {
      throw new BadRequestException('Exception is already resolved');
    }

    const resolved = await this.prisma.transportJobException.update({
      where: { id: exceptionId },
      data: {
        status: TransportExceptionStatus.RESOLVED,
        resolvedById: resolverUserId,
        resolvedAt: new Date(),
        resolution: dto.resolution,
      },
      include: {
        reportedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        resolvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const notifyIds = new Set<string>();
    if (job.driverId) notifyIds.add(job.driverId);
    if (job.requestedById) notifyIds.add(job.requestedById);
    if (job.order?.createdById) notifyIds.add(job.order.createdById);
    notifyIds.delete(resolverUserId);

    if (notifyIds.size > 0) {
      this.notifications
        .createForMany(Array.from(notifyIds), {
          type: NotificationType.SYSTEM_ALERT,
          title: '✅ Izņēmums atrisināts',
          message: `Darbs ${job.jobNumber} • ${dto.resolution}`,
          data: { jobId: id, exceptionId: resolved.id },
        })
        .catch(() => {});
    }

    return resolved;
  }
}
