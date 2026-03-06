import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransportJobStatus } from '@prisma/client';
import { UpdateStatusDto, ALLOWED_DRIVER_STATUSES } from './dto/update-status.dto';
import { CreateTransportJobDto } from './dto/create-transport-job.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { SubmitDeliveryProofDto } from './dto/submit-delivery-proof.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
      select: { id: true, firstName: true, lastName: true, phone: true },
    },
    vehicle: {
      select: { id: true, licensePlate: true, vehicleType: true },
    },
    order: {
      select: { id: true, orderNumber: true, siteContactName: true, siteContactPhone: true },
    },
  } as const;

  // ── Create a new transport job ────────────────────────────────
  async create(dto: CreateTransportJobDto) {
    const jobNumber = await this.generateJobNumber();
    return this.prisma.transportJob.create({
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
      throw new BadRequestException('You already have an active job. Complete it first.');
    }

    return this.prisma.transportJob.update({
      where: { id },
      data: {
        status: TransportJobStatus.ACCEPTED,
        driverId,
      },
      select: this.jobSelect,
    });
  }

  // ── Avoid Empty Runs — return trip suggestions ────────────────
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
        return this.haversineKm(lat, lng, job.pickupLat, job.pickupLng) <= radiusKm;
      })
      .map((job) => ({
        ...job,
        returnDistanceKm: Math.round(
          this.haversineKm(lat, lng, job.pickupLat!, job.pickupLng!),
        ),
      }))
      .sort((a, b) => a.returnDistanceKm - b.returnDistanceKm);
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
      throw new BadRequestException('Job is no longer available for assignment');
    }

    const driver = await this.prisma.user.findUnique({ where: { id: body.driverId } });
    if (!driver || !driver.canTransport) {
      throw new BadRequestException('User is not a valid driver');
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: body.vehicleId } });
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

    return this.prisma.transportJob.update({
      where: { id },
      data: { status: dto.status },
      select: this.jobSelect,
    });
  }

  // ── Driver: update GPS location ───────────────────────────────
  async updateLocation(id: string, driverId: string, dto: UpdateLocationDto) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');
    if (job.driverId !== driverId) throw new ForbiddenException('This is not your job');

    const location = { lat: dto.lat, lng: dto.lng, updatedAt: new Date().toISOString() };

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
  async submitDeliveryProof(id: string, driverId: string, dto: SubmitDeliveryProofDto) {
    const job = await this.prisma.transportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Transport job not found');
    if (job.driverId !== driverId) throw new ForbiddenException('This is not your job');
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

    return this.prisma.transportJob.update({
      where: { id },
      data: { status: TransportJobStatus.DELIVERED },
      select: this.jobSelect,
    });
  }
}
