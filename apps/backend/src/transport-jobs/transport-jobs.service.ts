import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransportJobStatus, OrderStatus } from '@prisma/client';
import {
  UpdateStatusDto,
  ALLOWED_DRIVER_STATUSES,
} from './dto/update-status.dto';
import { CreateTransportJobDto } from './dto/create-transport-job.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SubmitDeliveryProofDto } from './dto/submit-delivery-proof.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { DocumentsService } from '../documents/documents.service';

// Valid next-state transitions for a driver
const NEXT_STATUS: Partial<Record<TransportJobStatus, TransportJobStatus>> = {
  [TransportJobStatus.ACCEPTED]: TransportJobStatus.EN_ROUTE_PICKUP,
  [TransportJobStatus.EN_ROUTE_PICKUP]: TransportJobStatus.AT_PICKUP,
  [TransportJobStatus.AT_PICKUP]: TransportJobStatus.LOADED,
  [TransportJobStatus.LOADED]: TransportJobStatus.EN_ROUTE_DELIVERY,
  [TransportJobStatus.EN_ROUTE_DELIVERY]: TransportJobStatus.AT_DELIVERY,
  [TransportJobStatus.AT_DELIVERY]: TransportJobStatus.DELIVERED,
};

@Injectable()
export class TransportJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly documents: DocumentsService,
  ) {}

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
    driverId: true,
    driver: {
      select: { id: true, firstName: true, lastName: true, phone: true, avatar: true },
    },
    vehicle: {
      select: { id: true, licensePlate: true, vehicleType: true },
    },
    order: {
      select: {
        id: true,
        orderNumber: true,
        siteContactName: true,
        siteContactPhone: true,
      },
    },
  } as const;

  // ── Create a new transport job ────────────────────────────────
  async create(dto: CreateTransportJobDto) {
    const jobNumber = await this.generateJobNumber();
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

  private async generateJobNumber(): Promise<string> {
    const count = await this.prisma.transportJob.count();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const number = (count + 1).toString().padStart(5, '0');
    return `TRJ${year}${month}${number}`;
  }

  // ── All jobs (dispatcher fleet view) ─────────────────────────
  async findAll() {
    return this.prisma.transportJob.findMany({
      select: this.jobSelect,
      orderBy: { pickupDate: 'asc' },
    });
  }

  // ── Available jobs (job board) ─────────────────────────────────
  async findAvailable() {
    return this.prisma.transportJob.findMany({
      where: { status: TransportJobStatus.AVAILABLE },
      select: this.jobSelect,
      orderBy: { pickupDate: 'asc' },
    });
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

    return this.prisma.transportJob.findFirst({
      where: { driverId, status: { in: activeStatuses } },
      select: this.jobSelect,
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ── My completed/all jobs ─────────────────────────────────────
  async findMyJobs(driverId: string) {
    return this.prisma.transportJob.findMany({
      where: { driverId },
      select: this.jobSelect,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Returns all WASTE_COLLECTION and TRANSPORT jobs that the given user
   * originally requested (via the disposal or freight booking wizard).
   */
  async findMyRequests(userId: string) {
    return this.prisma.transportJob.findMany({
      where: {
        requestedById: userId,
        jobType: { in: ['WASTE_COLLECTION', 'TRANSPORT'] },
      },
      select: this.jobSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Single job ────────────────────────────────────────────────
  async findOne(id: string) {
    const job = await this.prisma.transportJob.findUnique({
      where: { id },
      select: this.jobSelect,
    });
    if (!job) throw new NotFoundException('Transport job not found');
    return job;
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
    const buyerId = (updatedJob as any).order?.buyerId ?? (updatedJob as any).order?.buyer?.id;
    if (buyerId) {
      this.notifications.create({
        userId: buyerId,
        type: NotificationType.TRANSPORT_ASSIGNED,
        title: '🚚 Šoferis pieņēmis darbu',
        message: `${updatedJob.jobNumber} • ${updatedJob.pickupCity} → ${updatedJob.deliveryCity}`,
      }).catch(() => {});
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
  async findDrivers() {
    return this.prisma.user.findMany({
      where: { canTransport: true },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: { firstName: 'asc' },
    });
  }

  // ── Dispatcher: assign vehicle + driver to a job ──────────────
  async assign(id: string, body: { driverId: string; vehicleId: string }) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');

    if (job.status !== TransportJobStatus.AVAILABLE) {
      throw new BadRequestException(
        'Job is no longer available for assignment',
      );
    }

    const driver = await this.prisma.user.findUnique({
      where: { id: body.driverId },
    });
    if (!driver || !driver.canTransport) {
      throw new BadRequestException('User is not a valid driver');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: body.vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return this.prisma.transportJob.update({
      where: { id },
      data: {
        driverId: body.driverId,
        vehicleId: body.vehicleId,
        status: TransportJobStatus.ACCEPTED,
      },
      select: this.jobSelect,
    });
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
      throw new BadRequestException('Weight ticket reading (weightKg) is required when marking job as LOADED');
    }

    const updatedJob = await this.prisma.transportJob.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === TransportJobStatus.LOADED && dto.weightKg
          ? { actualWeightKg: dto.weightKg }
          : {}),
      },
      select: this.jobSelect,
    });

    // Auto-generate documents on key transitions
    const orderId = (updatedJob as any).order?.id as string | undefined;
    const createdById = (updatedJob as any).order?.createdById as string | undefined;

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
          this.notifications.create({
            userId: buyerId,
            type: NotificationType.SYSTEM_ALERT,
            title: '🚚 Šoferis dodas uz iekraušanu',
            message: `${driverName} dodas uz iekraušanas vietu • ${orderNum}`,
          }).catch(() => {});
        } else if (dto.status === TransportJobStatus.LOADED) {
          this.notifications.create({
            userId: buyerId,
            type: NotificationType.SYSTEM_ALERT,
            title: '📦 Krava iekrauta',
            message: `Krava iekrauta, šoferis dodas uz Jums • ${orderNum}`,
          }).catch(() => {});
        } else if (dto.status === TransportJobStatus.EN_ROUTE_DELIVERY) {
          this.notifications.create({
            userId: buyerId,
            type: NotificationType.SYSTEM_ALERT,
            title: '🚛 Piegāde ceļā',
            message: `${driverName} dodas uz piegādes vietu • ${orderNum}`,
          }).catch(() => {});
        } else if (dto.status === TransportJobStatus.AT_DELIVERY) {
          this.notifications.create({
            userId: buyerId,
            type: NotificationType.SYSTEM_ALERT,
            title: '📍 Šoferis ieradies',
            message: `${driverName} ir ieradies piegādes vietā • ${orderNum}`,
          }).catch(() => {});
        } else if (dto.status === TransportJobStatus.DELIVERED) {
          this.notifications.create({
            userId: buyerId,
            type: NotificationType.ORDER_DELIVERED,
            title: '✅ Piegāde pabeigta',
            message: `Pasūtījums ${orderNum} ir veiksmīgi piegādāts.`,
          }).catch(() => {});
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

    return location;
  }

  // ── Get current GPS location for a job ───────────────────────
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
      data: { status: TransportJobStatus.DELIVERED },
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
            pickupCity: delivered.pickupCity,
            deliveryCity: delivered.deliveryCity,
            driverName: driver
              ? `${driver.firstName} ${driver.lastName}`
              : undefined,
          })
          .catch(() => {});

        // Advance the linked order to DELIVERED if it's not already in a terminal state
        if (
          order.status !== OrderStatus.DELIVERED &&
          order.status !== OrderStatus.COMPLETED &&
          order.status !== OrderStatus.CANCELLED
        ) {
          await this.prisma.order.update({
            where: { id: job.orderId },
            data: { status: OrderStatus.DELIVERED },
          }).catch(() => {});
        }
      }
    }

    return delivered;
  }

  // ── LoadingDock — seller confirms driver loaded ───────────────
  // Called from the seller's LoadingDock screen when the driver arrives
  // at the pickup yard. Seller enters weight and confirms loading.
  // Transitions AT_PICKUP → LOADED and auto-generates WEIGHING_SLIP.
  async loadingDock(
    id: string,
    weightKg?: number,
  ) {
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
          .generateWeighingSlip(job.orderId, order.createdById, weight ?? 0, 't')
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
}
