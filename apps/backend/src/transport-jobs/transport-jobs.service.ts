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
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocumentType,
  SurchargeType,
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
import { VAT_RATE } from '../common/constants/tax';
import { UpdatesGateway } from '../updates/updates.gateway';
import { EmailService } from '../email/email.service';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { PaymentsService } from '../payments/payments.service';

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
    private readonly payments: PaymentsService,
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
    buyerOfferedRate: true,
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
        createdById: true,
        siteContactName: true,
        siteContactPhone: true,
        notes: true,
      },
    },
    truckIndex: true,
    truckCount: true,
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
        buyerOfferedRate: dto.buyerOfferedRate ?? null,
        currency: 'EUR',
        status: TransportJobStatus.AVAILABLE,
        ...(dto.orderId ? { order: { connect: { id: dto.orderId } } } : {}),
      },
      select: this.jobSelect,
    });

    // Notify eligible nearby drivers about the new job (fire-and-forget)
    this.notifyDriversNearPickup(
      `🚚 Jauns darbs: ${dto.pickupCity} → ${dto.deliveryCity}`,
      `${dto.cargoType}${dto.cargoWeight ? ` • ${dto.cargoWeight}t` : ''} • ${dto.distanceKm ? `${Math.round(dto.distanceKm ?? 0)} km` : 'attālums nav norādīts'}`,
      dto.pickupLat,
      dto.pickupLng,
      job.id,
    ).catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));

    this.logger.log(
      `Transport job ${job.jobNumber} created (${dto.pickupCity} → ${dto.deliveryCity})`,
    );
    return job;
  }

  /**
   * Notify eligible drivers about a new job. Filters by:
   * 1. notifJobAlerts = true preference
   * 2. If driver's company has coordinates, only notify drivers within
   *    their company's serviceRadiusKm (default 200 km) of the pickup.
   */
  private async notifyDriversNearPickup(
    title: string,
    message: string,
    pickupLat: number | null | undefined,
    pickupLng: number | null | undefined,
    jobId: string,
  ) {
    const drivers = await this.prisma.user.findMany({
      where: { canTransport: true, status: 'ACTIVE', notifJobAlerts: true },
      select: {
        id: true,
        company: { select: { lat: true, lng: true, serviceRadiusKm: true } },
        driverProfile: { select: { currentLocation: true } },
      },
    });

    const eligible: string[] = [];
    for (const driver of drivers) {
      if (!pickupLat || !pickupLng) {
        // No pickup coordinates — notify everyone who opted in
        eligible.push(driver.id);
        continue;
      }

      // Prefer live driver location, fall back to company base
      let driverLat: number | null = null;
      let driverLng: number | null = null;
      const loc = driver.driverProfile?.currentLocation as { lat?: number; lng?: number } | null;
      if (loc?.lat && loc?.lng) {
        driverLat = loc.lat;
        driverLng = loc.lng;
      } else if (driver.company?.lat && driver.company?.lng) {
        driverLat = driver.company.lat;
        driverLng = driver.company.lng;
      }

      if (driverLat === null || driverLng === null) {
        // No location on file — notify to avoid missing opportunities
        eligible.push(driver.id);
        continue;
      }

      const maxKm = driver.company?.serviceRadiusKm ?? 200;
      const distKm = this.haversineKm(driverLat, driverLng, pickupLat, pickupLng);
      if (distKm <= maxKm) {
        eligible.push(driver.id);
      }
    }

    if (eligible.length === 0) return;
    await this.notifications.createForMany(eligible, {
      type: NotificationType.JOB_ALERT,
      title,
      message,
      data: { jobId },
    });
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

    // Only reconcile tonne-based orders — weight cannot be converted to M3/PIECE/LOAD
    const firstItem = order.items[0];
    if (firstItem.unit !== 'TONNE') return;

    // Convert actual weight to tonnes (same unit as order quantity)
    const actualTonnes = actualWeightKg / 1000;
    const orderedTonnes = Number(firstItem.quantity);

    // Skip if within 1% tolerance
    const diff = Math.abs(actualTonnes - orderedTonnes);
    if (orderedTonnes === 0 || diff / orderedTonnes < 0.01) return;

    // Recalculate totals based on actual weight; derive tax rate from original order
    const unitPrice = Number(firstItem.unitPrice);
    const actualSubtotal = Math.round(actualTonnes * unitPrice * 100) / 100;
    const storedSubtotal = Number(order.subtotal);
    const taxRate =
      storedSubtotal > 0 ? Number(order.tax) / storedSubtotal : VAT_RATE;
    const actualTax = Math.round(actualSubtotal * taxRate * 100) / 100;
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
        type: NotificationType.INVOICE_ADJUSTED,
        title: 'Rēķins precizēts',
        message: `Pasūtījums #${order.orderNumber}: faktiskais svars ${actualTonnes.toFixed(2)} t (pasūtīts ${orderedTonnes.toFixed(2)} t, starpība ${delta} t). Rēķins ${direction}. Jauna summa: €${(actualTotal + deliveryFee).toFixed(2)}.`,
        data: { orderId, invoiceId: invoice.id },
      })
      .catch(() => null);

    // Sync Stripe PaymentIntent to the new total so the buyer is charged
    // the correct amount based on actual delivered weight.
    // Swallow errors gracefully — a captured/released payment cannot be adjusted
    // (Stripe will refuse), but the invoice + order totals are already corrected.
    this.payments.updatePaymentIntentAmount(orderId, actualTotal + deliveryFee).catch((err) => {
      this.logger.warn(
        `reconcileInvoiceWeight: could not update PaymentIntent for order ${orderId} — ${(err as Error).message}`,
      );
    });

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

    // Strip buyer contact details from the public job board.
    // Drivers only receive siteContactName/Phone after being assigned.
    const safeJobs = jobs.map((j) => {
      const { order, ...rest } = j;
      return {
        ...rest,
        order: order
          ? {
              id: order.id,
              orderNumber: order.orderNumber,
              buyerId: order.buyerId,
              createdById: order.createdById,
            }
          : null,
      };
    });

    return {
      data: safeJobs.map((j) => this.mapWithSla(j)),
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
      TransportJobStatus.ASSIGNED,
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
      requiresWeighingSlip
        ? job.orderId
          ? this.prisma.document.findFirst({
              where: {
                orderId: job.orderId,
                type: DocumentType.WEIGHING_SLIP,
                status: { not: 'ARCHIVED' },
              },
              select: { id: true },
            })
          : // Standalone disposal/freight job — weighing slip is linked to the job directly
            this.prisma.document.findFirst({
              where: {
                transportJobId: id,
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

    // Respect exclusive offer window: only the offered driver may accept while
    // the offer is still live. Once it expires any driver may accept again.
    if (
      job.offeredToDriverId &&
      job.offerExpiresAt &&
      job.offerExpiresAt > new Date() &&
      job.offeredToDriverId !== driverId
    ) {
      throw new BadRequestException(
        'Šis darbs pašlaik ir piedāvāts citam šoferim. Uzgaidiet, kamēr piedāvājums beidzas.',
      );
    }

    // Ensure driver has no other active job
    const activeJob = await this.findMyActiveJob(driverId);
    if (activeJob) {
      throw new BadRequestException(
        'You already have an active job. Complete it first.',
      );
    }

    // Compliance gate: driver license must not be expired
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { licenseExpiry: true },
    });
    if (driverProfile?.licenseExpiry && driverProfile.licenseExpiry < new Date()) {
      throw new BadRequestException(
        `Jūsu vadītāja apliecība ir beigusies (${driverProfile.licenseExpiry.toISOString().split('T')[0]}). Atjauniniet apliecību, lai pieņemtu darbus.`,
      );
    }

    // Atomic conditional update: only succeeds if job is still AVAILABLE.
    // Prevents two drivers racing to accept the same job (last-writer-wins race).
    const { count } = await this.prisma.transportJob.updateMany({
      where: { id, status: TransportJobStatus.AVAILABLE },
      data: { status: TransportJobStatus.ACCEPTED, driverId },
    });
    if (count === 0) {
      throw new BadRequestException('Job is no longer available');
    }

    const updatedJob = await this.prisma.transportJob.findUniqueOrThrow({
      where: { id },
      select: this.jobSelect,
    });

    // Notify buyer if job has an order
    const buyerUserId = updatedJob.order?.createdById ?? undefined;
    if (buyerUserId) {
      this.notifications
        .create({
          userId: buyerUserId,
          type: NotificationType.TRANSPORT_ASSIGNED,
          title: '🚚 Šoferis pieņēmis darbu',
          message: `${updatedJob.jobNumber} • ${updatedJob.pickupCity} → ${updatedJob.deliveryCity}`,
          data: { jobId: updatedJob.id },
        })
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
    }

    return updatedJob;
  }

  // ── Decline an offered job ────────────────────────────────────
  async declineOffer(jobId: string, driverId: string) {
    const job = await this.prisma.transportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.offeredToDriverId !== driverId) {
      throw new BadRequestException('Šis darbs nav piedāvāts jums');
    }

    const updated = await this.prisma.transportJob.update({
      where: { id: jobId },
      data: {
        offeredToDriverId: null,
        offerExpiresAt: null,
        declinedDriverIds: { push: driverId },
      },
    });

    // Immediately try to dispatch to the next eligible driver
    this.dispatchToNextDriver(updated).catch((err) =>
      this.logger.error(
        `Auto-dispatch after decline failed for job ${jobId}: ${(err as Error).message}`,
      ),
    );

    return { ok: true };
  }

  // ── Auto-dispatch cron — run every 30 s ───────────────────────
  @Cron('*/30 * * * * *')
  async runAutoDispatch() {
    const now = new Date();
    const jobs = await this.prisma.transportJob.findMany({
      where: {
        status: TransportJobStatus.AVAILABLE,
        OR: [
          { offeredToDriverId: null },
          { offerExpiresAt: { lt: now } },
        ],
      },
      select: {
        id: true,
        pickupLat: true,
        pickupLng: true,
        pickupCity: true,
        deliveryCity: true,
        cargoType: true,
        distanceKm: true,
        declinedDriverIds: true,
        offeredToDriverId: true,
        offerExpiresAt: true,
        requestedById: true,
        order: { select: { createdById: true } },
      },
    });

    for (const job of jobs) {
      await this.dispatchToNextDriver(job).catch((err) =>
        this.logger.error(
          `runAutoDispatch: failed for job ${job.id}: ${(err as Error).message}`,
        ),
      );
    }
  }

  private async dispatchToNextDriver(job: {
    id: string;
    pickupLat: number | null;
    pickupLng: number | null;
    pickupCity: string;
    deliveryCity: string;
    cargoType: string;
    distanceKm: number | null;
    declinedDriverIds: string[];
    offeredToDriverId?: string | null;
    offerExpiresAt?: Date | null;
    requestedById?: string | null;
    order?: { createdById: string } | null;
  }) {
    const now = new Date();
    // If the previous offer expired (driver did not respond), treat them as
    // declined so they are not re-offered the same job indefinitely.
    const expiredDriverId =
      job.offeredToDriverId &&
      job.offerExpiresAt &&
      job.offerExpiresAt < now
        ? job.offeredToDriverId
        : null;

    const effectiveDeclined = expiredDriverId
      ? [...new Set([...job.declinedDriverIds, expiredDriverId])]
      : job.declinedDriverIds;

    // Never offer a job back to the user who created it (buyer-driver dual role)
    const creatorUserId = job.requestedById ?? job.order?.createdById ?? null;
    const excludedIds = creatorUserId
      ? [...new Set([...effectiveDeclined, creatorUserId])]
      : effectiveDeclined;

    const candidates = await this.prisma.user.findMany({
      where: {
        canTransport: true,
        status: 'ACTIVE',
        notifJobAlerts: true,
        id: { notIn: excludedIds },
      },
      select: {
        id: true,
        company: { select: { lat: true, lng: true, serviceRadiusKm: true } },
        driverProfile: { select: { currentLocation: true } },
      },
    });

    const scored: { id: string; distKm: number }[] = [];

    for (const driver of candidates) {
      // Skip drivers who already have an active job
      const active = await this.findMyActiveJob(driver.id);
      if (active) continue;

      if (!job.pickupLat || !job.pickupLng) {
        scored.push({ id: driver.id, distKm: 9999 });
        continue;
      }

      const loc = driver.driverProfile?.currentLocation as { lat?: number; lng?: number } | null;
      const driverLat = loc?.lat ?? driver.company?.lat ?? null;
      const driverLng = loc?.lng ?? driver.company?.lng ?? null;

      if (!driverLat || !driverLng) {
        scored.push({ id: driver.id, distKm: 9999 });
        continue;
      }

      const maxKm = driver.company?.serviceRadiusKm ?? 200;
      const distKm = this.haversineKm(driverLat, driverLng, job.pickupLat, job.pickupLng);
      if (distKm <= maxKm) {
        scored.push({ id: driver.id, distKm });
      }
    }

    if (scored.length === 0) return; // no eligible drivers right now

    scored.sort((a, b) => a.distKm - b.distKm);
    const nextDriver = scored[0];
    const offerExpiresAt = new Date(Date.now() + 45_000);

    // Atomic offer assignment: only set offer if job is still AVAILABLE.
    // Also persist the expired driver into declinedDriverIds so the cron
    // does not re-offer them the same job after the next expiry.
    const { count } = await this.prisma.transportJob.updateMany({
      where: { id: job.id, status: TransportJobStatus.AVAILABLE },
      data: {
        offeredToDriverId: nextDriver.id,
        offerExpiresAt,
        ...(expiredDriverId
          ? { declinedDriverIds: { push: expiredDriverId } }
          : {}),
      },
    });

    if (count === 0) return; // job was accepted/cancelled between select and update

    this.notifications
      .create({
        userId: nextDriver.id,
        type: NotificationType.SYSTEM_ALERT,
        title: `🚚 Jauns darbs: ${job.pickupCity} → ${job.deliveryCity}`,
        message: `${job.cargoType}${job.distanceKm ? ` • ${Math.round(job.distanceKm)} km` : ''} — pieņem 45 s laikā`,
        data: { jobId: job.id, offerExpiresAt: offerExpiresAt.toISOString() },
      })
      .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));

    this.logger.log(
      `Auto-dispatch: job ${job.id} offered to driver ${nextDriver.id} (${Math.round(nextDriver.distKm)} km away)`,
    );
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
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
    }

    return updated;
  }

  /**
   * Admin-only: forcibly reassign a job regardless of its current status.
   * Used when a driver breaks down, abandons the job, or goes unresponsive
   * mid-route. The job status is preserved — the new driver inherits the
   * current state so the timeline remains intact. An exception is logged
   * automatically and both the removed and new driver are notified.
   */
  async forceReassign(
    id: string,
    body: AssignDispatchDto & { note?: string },
    adminId?: string,
  ) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    const terminalStatuses: TransportJobStatus[] = [
      TransportJobStatus.DELIVERED,
      TransportJobStatus.CANCELLED,
    ];
    if (terminalStatuses.includes(job.status)) {
      throw new BadRequestException(
        `Job is already ${job.status} — cannot reassign`,
      );
    }

    const newDriver = await this.prisma.user.findUnique({
      where: { id: body.driverId },
      select: { id: true, firstName: true, canTransport: true },
    });
    if (!newDriver || !newDriver.canTransport) {
      throw new BadRequestException('Target user is not a valid driver');
    }

    // Update assignment without changing status (driver inherits current stage)
    const updated = await this.prisma.transportJob.update({
      where: { id },
      data: {
        driverId: body.driverId,
        vehicleId: body.vehicleId ?? job.vehicleId,
      },
      select: this.jobSelect,
    });

    const note = body.note ?? 'Admin emergency reassignment';

    // Log an exception so the incident is traceable
    await this.prisma.transportJobException.create({
      data: {
        transportJobId: id,
        type: 'OTHER',
        notes: `Force-reassigned by admin. ${note}. Previous driver: ${job.driverId ?? 'none'}. New driver: ${body.driverId}.`,
        reportedById: body.driverId,
        status: 'RESOLVED',
        resolution: 'Reassigned by admin',
        resolvedAt: new Date(),
      },
    }).catch((err) =>
      this.logger.warn(`Could not log force-reassign exception for job ${id}: ${(err as Error).message}`),
    );

    // Notify old driver they've been removed
    if (job.driverId && job.driverId !== body.driverId) {
      this.notifications
        .create({
          userId: job.driverId,
          type: NotificationType.SYSTEM_ALERT,
          title: 'Darbs noņemts',
          message: `Darbs ${updated.jobNumber} tika pārsūtīts citam šoferim. Iemesls: ${note}`,
          data: { jobId: updated.id },
        })
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
    }

    // Notify new driver
    this.notifications
      .create({
        userId: body.driverId,
        type: NotificationType.TRANSPORT_ASSIGNED,
        title: '🚚 Steidzams darbs piešķirts',
        message: `${updated.jobNumber} • ${updated.pickupCity} → ${updated.deliveryCity} (pārcelts statusā: ${updated.status})`,
        data: { jobId: updated.id },
      })
      .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));

    // Write audit trail
    if (adminId) {
      this.prisma.adminAuditLog
        .create({
          data: {
            adminId,
            action: 'FORCE_REASSIGN_JOB',
            entityType: 'TransportJob',
            entityId: id,
            before: { driverId: job.driverId ?? null, vehicleId: job.vehicleId ?? null },
            after: { driverId: body.driverId, vehicleId: body.vehicleId ?? job.vehicleId },
            note: body.note ?? null,
          },
        })
        .catch((err) =>
          this.logger.warn(
            `Could not write audit log for force-reassign of job ${id}: ${(err as Error).message}`,
          ),
        );
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
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
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

    // Block dispatcher from assigning a driver who is already mid-job
    const activeJob = await this.findMyActiveJob(driverId);
    if (activeJob) {
      throw new BadRequestException(
        `Driver already has an active job (${activeJob.jobNumber}). Complete or unassign it first.`,
      );
    }

    // Compliance gate: driver license must not be expired
    const assignDriverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: { licenseExpiry: true },
    });
    if (assignDriverProfile?.licenseExpiry && assignDriverProfile.licenseExpiry < new Date()) {
      throw new BadRequestException(
        `Šofera ${driver.firstName} ${driver.lastName} vadītāja apliecība ir beigusies (${assignDriverProfile.licenseExpiry.toISOString().split('T')[0]}). Atjauniniet apliecību pirms piešķiršanas.`,
      );
    }

    if (vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      // Check the vehicle isn't already assigned to another active job
      const activeJobStatuses = [
        TransportJobStatus.ASSIGNED,
        TransportJobStatus.ACCEPTED,
        TransportJobStatus.EN_ROUTE_PICKUP,
        TransportJobStatus.AT_PICKUP,
        TransportJobStatus.LOADED,
        TransportJobStatus.EN_ROUTE_DELIVERY,
        TransportJobStatus.AT_DELIVERY,
      ];
      const vehicleConflict = await this.prisma.transportJob.findFirst({
        where: {
          vehicleId,
          status: { in: activeJobStatuses },
          NOT: { id },
        },
        select: { jobNumber: true },
      });
      if (vehicleConflict) {
        throw new BadRequestException(
          `Vehicle is already assigned to active job ${vehicleConflict.jobNumber}. Choose a different vehicle.`,
        );
      }

      // Compliance gate: vehicle insurance and inspection must not be expired
      if (vehicle.insuranceExpiry && vehicle.insuranceExpiry < new Date()) {
        throw new BadRequestException(
          `Transportlīdzekļa ${vehicle.licensePlate} apdrošināšana ir beigusies (${vehicle.insuranceExpiry.toISOString().split('T')[0]}). Atjauniniet apdrošināšanu pirms piešķiršanas.`,
        );
      }
      if (vehicle.inspectionExpiry && vehicle.inspectionExpiry < new Date()) {
        throw new BadRequestException(
          `Transportlīdzekļa ${vehicle.licensePlate} tehniskā apskate ir beigusies (${vehicle.inspectionExpiry.toISOString().split('T')[0]}). Nokārtojiet apskati pirms piešķiršanas.`,
        );
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
      .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));

    if (driver.email) {
      const driverName = `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim();
      this.email
        .sendDriverJobAssigned(driver.email, driverName, {
          jobNumber: updated.jobNumber,
          pickupCity: updated.pickupCity,
          deliveryCity: updated.deliveryCity,
          scheduledDate: updated.pickupDate,
        })
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
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
          .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
      }

      // Reconcile invoice if actual weight differs from the ordered quantity
      if (dto.weightKg) {
        this.reconcileInvoiceWeight(orderId, dto.weightKg).catch(() => null);
      }

      // Weigh-bridge discrepancy alert: notify buyer if >5% difference
      if (dto.weightKg && updatedJob.cargoWeight) {
        const actualTonnes = dto.weightKg / 1000;
        const expectedTonnes = Number(updatedJob.cargoWeight);
        const diffPct = Math.abs(actualTonnes - expectedTonnes) / expectedTonnes * 100;
        if (diffPct > 5) {
          // Fetch buyer contact details
          const orderForAlert = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { createdById: true, orderNumber: true, createdBy: { select: { email: true, firstName: true } } },
          });
          const buyer = orderForAlert?.createdBy;
          if (buyer?.email) {
            const orderNum = orderForAlert?.orderNumber ?? updatedJob.jobNumber;
            const buyerName = buyer.firstName ?? 'Klients';
            this.email
              .sendWeighDiscrepancy(buyer.email, buyerName, {
                jobNumber: updatedJob.jobNumber,
                orderNumber: orderNum,
                expectedTonnes,
                actualTonnes,
                diffPct,
              })
              .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
            if (orderForAlert?.createdById) {
              this.notifications
                .create({
                  userId: orderForAlert.createdById,
                  type: NotificationType.WEIGHT_DISCREPANCY,
                  title: '⚠️ Svara neatbilstība',
                  message: `Job #${updatedJob.jobNumber}: ${diffPct.toFixed(1)}% starpība starp pasūtīto (${expectedTonnes.toFixed(1)}t) un svētītāja (${actualTonnes.toFixed(1)}t) svaru`,
                  data: { jobId: updatedJob.id },
                })
                .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
            }
          }
        }
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
              type: NotificationType.DRIVER_EN_ROUTE,
              title: '🚚 Šoferis dodas uz iekraušanu',
              message: `${driverName} dodas uz iekraušanas vietu • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
        } else if (dto.status === TransportJobStatus.LOADED) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.WEIGHING_SLIP,
              title: '📋 Svēršanas zīme pievienota',
              message: `Krava iekrauta${updatedJob.actualWeightKg != null ? ` • ${(updatedJob.actualWeightKg / 1000).toFixed(2)} t` : ''} • ${orderNum}`,
              data: {
                jobId: updatedJob.id,
                ...(updatedJob.pickupPhotoUrl ? { pickupPhotoUrl: updatedJob.pickupPhotoUrl } : {}),
              },
            })
            .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
        } else if (dto.status === TransportJobStatus.EN_ROUTE_DELIVERY) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.TRANSPORT_STARTED,
              title: '🚛 Piegāde ceļā',
              message: `${driverName} dodas uz piegādes vietu • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
        } else if (dto.status === TransportJobStatus.AT_DELIVERY) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.DRIVER_AT_DELIVERY,
              title: '📍 Šoferis ieradies',
              message: `${driverName} ir ieradies piegādes vietā • ${orderNum}`,
              data: { jobId: updatedJob.id },
            })
            .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
        } else if (dto.status === TransportJobStatus.DELIVERED) {
          this.notifications
            .create({
              userId: buyerId,
              type: NotificationType.ORDER_DELIVERED,
              title: '✅ Piegāde pabeigta',
              message: `Pasūtījums ${orderNum} ir veiksmīgi piegādāts.`,
              data: { jobId: updatedJob.id },
            })
            .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
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
          .catch((err) =>
            this.logger.error(
              `generateDeliveryNote failed for job ${updatedJob.id} / order ${orderId}: ${(err as Error).message}`,
            ),
          );
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
  // Track jobs where "driver nearby" push has already been sent (in-memory, per-server)
  private readonly nearbyNotifiedJobs = new Set<string>();

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

    // ── Driver nearby notification ────────────────────────────────────────────
    // Fire once when driver is within 5 km of delivery site while heading there.
    const headingToDelivery =
      job.status === 'EN_ROUTE_DELIVERY' ||
      job.status === 'LOADED';
    if (
      headingToDelivery &&
      job.deliveryLat != null &&
      job.deliveryLng != null &&
      !this.nearbyNotifiedJobs.has(id)
    ) {
      const distToDelivery = this.haversineKm(
        dto.lat,
        dto.lng,
        job.deliveryLat,
        job.deliveryLng,
      );
      if (distToDelivery <= 5) {
        this.nearbyNotifiedJobs.add(id);
        const recipientId = job.requestedById;
        if (recipientId) {
          this.notifications
            .create({
              userId: recipientId,
              type: NotificationType.SYSTEM_ALERT,
              title: 'Šoferis tuvojas',
              message: `Šoferis atrodas ${Math.round(distToDelivery * 10) / 10} km attālumā no piegādes vietas.`,
              data: { jobId: id },
            })
            .catch((err) =>
              this.logger.warn(`Driver nearby notification failed for job ${id}: ${err instanceof Error ? err.message : String(err)}`),
            );
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Broadcast real-time location to subscribed clients (fire-and-forget)
    // Compute a lightweight ETA: haversine to destination ÷ 50 km/h average speed.
    // Use delivery coords when en-route to delivery, pickup coords otherwise.
    const headingToDeliveryForEta =
      job.status === 'EN_ROUTE_DELIVERY' ||
      job.status === 'AT_DELIVERY' ||
      job.status === 'LOADED';
    const destLat = headingToDeliveryForEta ? job.deliveryLat : (job.pickupLat ?? job.deliveryLat);
    const destLng = headingToDeliveryForEta ? job.deliveryLng : (job.pickupLng ?? job.deliveryLng);
    let estimatedArrivalMin: number | null = null;
    if (destLat != null && destLng != null) {
      const distKm = this.haversineKm(dto.lat, dto.lng, destLat, destLng);
      estimatedArrivalMin = Math.max(1, Math.round((distKm / 50) * 60));
    }
    this.updates.broadcastJobLocation({ jobId: id, lat: dto.lat, lng: dto.lng, estimatedArrivalMin });

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
        loadCondition: dto.loadCondition,
        isPartialLoad: dto.isPartialLoad ?? false,
        hasDamage: dto.hasDamage ?? false,
        damageNote: dto.damageNote,
        gradeConfirmed: dto.gradeConfirmed ?? false,
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
          .catch((err) =>
            this.logger.error(
              `generateDeliveryNote failed for job ${id} / order ${job.orderId}: ${(err as Error).message}`,
            ),
          );

        // Advance the linked order to DELIVERED only when ALL transport jobs
        // for this order have been delivered (handles multi-truck orders where
        // truckCount > 1 — do not flip the order DELIVERED after the first truck).
        // A scheduled cron in OrdersService auto-advances DELIVERED → COMPLETED
        // after that window expires and fires releaseFunds().
        if (
          order.status !== OrderStatus.DELIVERED &&
          order.status !== OrderStatus.COMPLETED &&
          order.status !== OrderStatus.CANCELLED
        ) {
          const remainingJobs = await this.prisma.transportJob.count({
            where: {
              orderId: job.orderId,
              status: {
                notIn: [TransportJobStatus.DELIVERED, TransportJobStatus.CANCELLED],
              },
            },
          });

          if (remainingJobs === 0) {
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
    } else if (job.requestedById) {
      // Standalone disposal / freight job (no linked Order): notify the requester
      this.notifications
        .create({
          userId: job.requestedById,
          type: NotificationType.ORDER_DELIVERED,
          title: '✅ Darbs pabeigts',
          message: `Darbs ${delivered.jobNumber} ir veiksmīgi pabeigts. Lūdzu, apmaksājiet rēķinu.`,
          data: { jobId: id },
        })
        .catch((err) =>
          this.logger.error(err instanceof Error ? err.message : String(err)),
        );
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
          .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
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
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
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

    // PARTIAL_DELIVERY requires an actual quantity so we can adjust the order total
    if (dto.type === 'PARTIAL_DELIVERY' && (dto.actualQuantity == null || dto.actualQuantity < 0)) {
      throw new BadRequestException(
        'actualQuantity is required and must be ≥ 0 when reporting a PARTIAL_DELIVERY',
      );
    }

    const ex = await this.prisma.transportJobException.create({
      data: {
        transportJobId: id,
        type: dto.type,
        notes: dto.type === 'PARTIAL_DELIVERY' && dto.actualQuantity != null
          ? `${dto.notes}\n[actualQuantity=${dto.actualQuantity}]`
          : dto.notes,
        photoUrls: dto.photoUrls ?? [],
        reportedById: user.userId,
      },
      include: {
        reportedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // ── Partial delivery: adjust order total and Stripe authorization ────────
    // When the driver delivers less than ordered, we proportionally reduce the
    // order subtotal (tax scales with goods value; delivery fee is fixed).
    // The updated amount is pushed to the Stripe PaymentIntent immediately so
    // the buyer is only charged for what was actually delivered.
    if (dto.type === 'PARTIAL_DELIVERY' && dto.actualQuantity != null && job.order?.id) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: job.order.id },
          include: { items: true },
        });

        if (order && order.items.length > 0) {
          const totalPlannedQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

          if (totalPlannedQty > 0 && dto.actualQuantity < totalPlannedQty) {
            const ratio = dto.actualQuantity / totalPlannedQty;
            const newSubtotal = order.subtotal * ratio;
            const newTax = order.tax * ratio;
            const newTotal = newSubtotal + newTax + order.deliveryFee;

            await this.prisma.$transaction([
              // Proportionally adjust each order item
              ...order.items.map((item) =>
                this.prisma.orderItem.update({
                  where: { id: item.id },
                  data: {
                    quantity: item.quantity * ratio,
                    total: item.total * ratio,
                  },
                }),
              ),
              // Update order financial fields
              this.prisma.order.update({
                where: { id: order.id },
                data: { subtotal: newSubtotal, tax: newTax, total: newTotal },
              }),
            ]);

            // Sync Stripe PaymentIntent to reduced amount (fire-and-forget from here,
            // but awaited inside the method so any Stripe error is logged properly)
            await this.payments.updatePaymentIntentAmount(order.id, newTotal);
          }
        }
      } catch (err) {
        // Financial adjustment failure must not block the exception record being returned.
        // Log the error loudly so ops can corrects manually.
        this.logger.error(
          `reportException PARTIAL_DELIVERY: failed to adjust order total for job ${id} / order ${job.order?.id}: ${(err as Error).message}`,
        );
      }
    }

    const actorName =
      user.email?.trim() ||
      (user.companyId
        ? `Lietotājs (${user.companyId})`
        : `Lietotājs ${user.userId}`);
    const msg = `Darbs ${job.jobNumber} • ${dto.type} • ${job.pickupCity} → ${job.deliveryCity}`;

    // Human-readable exception type labels for buyer-facing messages
    const exceptionLabels: Record<string, string> = {
      DRIVER_NO_SHOW: 'Šoferis neieradās',
      SUPPLIER_NOT_READY: 'Piegādātājs nav gatavs',
      WRONG_MATERIAL: 'Nepareizs materiāls',
      PARTIAL_DELIVERY: 'Daļēja piegāde',
      REJECTED_DELIVERY: 'Noraidīta piegāde',
      SITE_CLOSED: 'Objekts slēgts',
      OVERWEIGHT: 'Pārslogots',
      OTHER: 'Cits',
    };
    const exceptionLabel = exceptionLabels[dto.type] ?? dto.type;

    const notifyIds = new Set<string>();
    if (job.driverId && job.driverId !== user.userId)
      notifyIds.add(job.driverId);
    if (job.requestedById && job.requestedById !== user.userId)
      notifyIds.add(job.requestedById);

    // Notify dispatcher/driver set
    if (notifyIds.size > 0) {
      this.notifications
        .createForMany(Array.from(notifyIds), {
          type: NotificationType.SYSTEM_ALERT,
          title: '⚠️ Ziņots izņēmuma gadījums',
          message: `${msg} • Ziņoja: ${actorName}`,
          data: { jobId: id, exceptionId: ex.id },
        })
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
    }

    // Send a separate, buyer-friendly notification to the order owner so they
    // know there is an issue with their delivery and can take action or contact support.
    const buyerId = job.order?.createdById;
    if (buyerId && buyerId !== user.userId) {
      this.notifications
        .create({
          userId: buyerId,
          type: NotificationType.SYSTEM_ALERT,
          title: `⚠️ Problēma ar jūsu piegādi`,
          message: `${exceptionLabel} — ${job.pickupCity} → ${job.deliveryCity}. Lūdzu, sekojiet līdzi pasūtījuma statusam vai sazinieties ar atbalstu.`,
          data: { jobId: id, exceptionId: ex.id, exceptionType: dto.type },
        })
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
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
        .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
    }

    return resolved;
  }

  /**
   * Runs every hour.
   * Finds transport jobs that were ASSIGNED/ACCEPTED by a driver but never
   * progressed to IN_PROGRESS within 4 hours of the scheduled pickup time (or
   * within 6 hours of assignment if no scheduled date is set). These jobs are:
   *   - Put back to AVAILABLE (driver unassigned)
   *   - Buyer + original order creator notified so they know to expect a new driver
   *
   * Construction logistics norm: if a driver doesn't show up within 4 hours of
   * the agreed time, the job must be re-opened for another driver to claim.
   */

  /**
   * Driver adds a surcharge (fuel, waiting time, overweight, etc.) to the order
   * linked to this transport job. The requesting user must be the assigned driver.
   */
  async addSurcharge(
    jobId: string,
    dto: { type: SurchargeType; label?: string; amount: number; billable?: boolean },
    driverId: string,
  ) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id: jobId },
      select: { id: true, jobNumber: true, driverId: true, orderId: true, status: true },
    });
    if (!job) throw new NotFoundException('Transport job not found');
    if (job.driverId !== driverId) {
      throw new ForbiddenException('Only the assigned driver can add surcharges');
    }
    if (!job.orderId) {
      throw new BadRequestException(
        'Surcharges can only be added to order-linked transport jobs',
      );
    }
    const nonEditableStatuses: TransportJobStatus[] = [
      TransportJobStatus.DELIVERED,
      TransportJobStatus.CANCELLED,
    ];
    if (nonEditableStatuses.includes(job.status as TransportJobStatus)) {
      throw new BadRequestException('Cannot add surcharges to a completed or cancelled job');
    }

    const SURCHARGE_LABELS: Partial<Record<SurchargeType, string>> = {
      [SurchargeType.FUEL]: 'Degvielas piemaksa',
      [SurchargeType.WAITING_TIME]: 'Gaidīšanas laiks',
      [SurchargeType.OVERWEIGHT]: 'Pārslogota krava',
      [SurchargeType.WEEKEND]: 'Nedēļas nogales piemaksa',
      [SurchargeType.NARROW_ACCESS]: 'Šaura pieeja',
      [SurchargeType.REMOTE_AREA]: 'Attāls objekts',
      [SurchargeType.TOLL]: 'Ceļa nodeva',
      [SurchargeType.OTHER]: 'Cita piemaksa',
    };

    return this.prisma.orderSurcharge.create({
      data: {
        orderId: job.orderId,
        type: dto.type,
        label: dto.label ?? SURCHARGE_LABELS[dto.type] ?? dto.type,
        amount: dto.amount,
        billable: dto.billable ?? true,
      },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async releaseStaleAcceptedJobs(): Promise<void> {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const stale = await this.prisma.transportJob.findMany({
      where: {
        status: { in: [TransportJobStatus.ASSIGNED, TransportJobStatus.ACCEPTED] },
        driverId: { not: null },
        OR: [
          // Has a pickup date that was more than 4 hours ago
          {
            pickupDate: { lt: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
          },
          // Or was last updated 6+ hours ago with no pickup date progress
          {
            updatedAt: { lt: sixHoursAgo },
          },
        ],
      },
      select: {
        id: true,
        jobNumber: true,
        driverId: true,
        requestedById: true,
        orderId: true,
        order: { select: { createdById: true } },
      },
    });

    for (const job of stale) {
      await this.prisma.transportJob
        .update({
          where: { id: job.id },
          data: {
            status: TransportJobStatus.AVAILABLE,
            driverId: null,
          },
        })
        .catch((err) =>
          this.logger.error(
            `releaseStaleAcceptedJobs: failed to reset job ${job.id}: ${(err as Error).message}`,
          ),
        );

      // Notify the order creator (buyer) that the job needs a new driver
      const notifyIds = new Set<string>();
      if (job.requestedById) notifyIds.add(job.requestedById);
      if (job.order?.createdById) notifyIds.add(job.order.createdById);

      if (notifyIds.size > 0) {
        this.notifications
          .createForMany(Array.from(notifyIds), {
            type: NotificationType.SYSTEM_ALERT,
            title: '⚠️ Transporta darbs — vadītājs neieradās',
            message: `Darbs #${job.jobNumber}: piešķirtais vadītājs nav sācis darbu. Darbs ir atkal pieejams citiem vadītājiem.`,
            data: { jobId: job.id },
          })
          .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
      }

      this.logger.warn(
        `releaseStaleAcceptedJobs: job ${job.jobNumber} (${job.id}) reset to AVAILABLE — driver ${job.driverId} did not start`,
      );
    }
  }

  /**
   * Runs every hour.
   * Finds AVAILABLE transport jobs that have been sitting without a driver for
   * more than 24 hours. Notifies the buyer + admins so they can investigate
   * (e.g. rate too low, area not covered, vehicle type not available).
   *
   * Jobs older than 48h with no driver are escalated to admin as critical.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async alertJobsWithNoDriver(): Promise<void> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const unassigned = await this.prisma.transportJob.findMany({
      where: {
        status: TransportJobStatus.AVAILABLE,
        driverId: null,
        createdAt: { lte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        jobNumber: true,
        createdAt: true,
        requestedById: true,
        orderId: true,
        order: { select: { createdById: true, orderNumber: true } },
      },
    });

    for (const job of unassigned) {
      const isCritical = job.createdAt <= fortyEightHoursAgo;
      const hoursOpen = Math.floor((now.getTime() - job.createdAt.getTime()) / 3_600_000);

      // Notify the buyer / requester
      const notifyIds = new Set<string>();
      if (job.requestedById) notifyIds.add(job.requestedById);
      if (job.order?.createdById) notifyIds.add(job.order.createdById);

      if (notifyIds.size > 0) {
        this.notifications
          .createForMany(Array.from(notifyIds), {
            type: NotificationType.SYSTEM_ALERT,
            title: isCritical
              ? '🚨 Transporta darbs bez vadītāja (48h)'
              : '⚠️ Transporta darbs bez vadītāja (24h)',
            message: isCritical
              ? `Darbs #${job.jobNumber} jau ${hoursOpen} stundas gaida vadītāju. Sazinieties ar atbalstu — iespējams, nepieciešams pielāgot nosacījumus.`
              : `Darbs #${job.jobNumber} jau ${hoursOpen} stundas gaida vadītāju. Mēs meklējam pieejamus vadītājus.`,
            data: { jobId: job.id },
          })
          .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
      }

      // Escalate critical cases to admin
      if (isCritical) {
        const admins = await this.prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true },
        });
        if (admins.length > 0) {
          this.notifications
            .createForMany(
              admins.map((a) => a.id),
              {
                type: NotificationType.SYSTEM_ALERT,
                title: '🚨 Transporta darbs bez vadītāja — 48h',
                message: `Darbs #${job.jobNumber} (pasūtījums ${job.order?.orderNumber ?? job.orderId}) — ${hoursOpen}h bez vadītāja. Nepieciešama manuāla iejaukšanās.`,
                data: { jobId: job.id, orderId: job.orderId },
              },
            )
            .catch((err) => this.logger.error(err instanceof Error ? err.message : String(err)));
        }
        this.logger.error(
          `alertJobsWithNoDriver: job ${job.jobNumber} (${job.id}) — CRITICAL: ${hoursOpen}h AVAILABLE with no driver`,
        );
      } else {
        this.logger.warn(
          `alertJobsWithNoDriver: job ${job.jobNumber} (${job.id}) — ${hoursOpen}h AVAILABLE with no driver`,
        );
      }
    }
  }
}
