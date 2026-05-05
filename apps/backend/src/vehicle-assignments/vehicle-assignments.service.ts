import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BuContext, VehicleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleAssignmentDto } from './dto/create-vehicle-assignment.dto';
import { UpdateVehicleAssignmentDto } from './dto/update-vehicle-assignment.dto';

@Injectable()
export class VehicleAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: { active?: boolean; buContext?: BuContext }) {
    return this.prisma.vehicleAssignment.findMany({
      where: {
        ...(filters?.active ? { endedAt: null } : {}),
        ...(filters?.buContext ? { buContext: filters.buContext } : {}),
      },
      include: {
        vehicle: {
          select: {
            id: true,
            licensePlate: true,
            make: true,
            model: true,
            vehicleType: true,
            status: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Returns all vehicles with their current active assignment (if any). */
  async getFleetOverview() {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { status: { not: VehicleStatus.INACTIVE } },
      select: {
        id: true,
        licensePlate: true,
        make: true,
        model: true,
        vehicleType: true,
        status: true,
        assignments: {
          where: { endedAt: null },
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            buContext: true,
            jobType: true,
            jobId: true,
            driverName: true,
            description: true,
            startedAt: true,
          },
        },
      },
      orderBy: { licensePlate: 'asc' },
    });

    return vehicles.map((v) => ({
      ...v,
      currentAssignment: v.assignments[0] ?? null,
      assignments: undefined,
    }));
  }

  async findOne(id: string) {
    const assignment = await this.prisma.vehicleAssignment.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: {
            id: true,
            licensePlate: true,
            make: true,
            model: true,
            vehicleType: true,
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  async create(dto: CreateVehicleAssignmentDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // Warn if vehicle already has an active assignment
    const existing = await this.prisma.vehicleAssignment.findFirst({
      where: { vehicleId: dto.vehicleId, endedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        'Vehicle already has an active assignment. End the current assignment before creating a new one.',
      );
    }

    return this.prisma.vehicleAssignment.create({
      data: {
        vehicleId: dto.vehicleId,
        jobType: dto.jobType,
        jobId: dto.jobId,
        buContext: dto.buContext,
        startedAt: new Date(dto.startedAt),
        endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
        driverName: dto.driverName,
        description: dto.description,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, dto: UpdateVehicleAssignmentDto) {
    await this.findOne(id);
    return this.prisma.vehicleAssignment.update({
      where: { id },
      data: {
        ...(dto.jobType && { jobType: dto.jobType }),
        ...(dto.jobId && { jobId: dto.jobId }),
        ...(dto.buContext && { buContext: dto.buContext }),
        ...(dto.startedAt && { startedAt: new Date(dto.startedAt) }),
        ...(dto.endedAt !== undefined && {
          endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
        }),
        ...(dto.driverName !== undefined && { driverName: dto.driverName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vehicleAssignment.delete({ where: { id } });
  }
}
