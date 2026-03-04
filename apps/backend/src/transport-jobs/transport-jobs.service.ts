import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransportJobStatus } from '@prisma/client';
import { UpdateStatusDto, ALLOWED_DRIVER_STATUSES } from './dto/update-status.dto';

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
      select: { id: true, orderNumber: true },
    },
  } as const;

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
}
