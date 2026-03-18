/**
 * Vehicles service.
 * CRUD for carrier fleet vehicles (trucks, vans, etc.).
 * Validates company/individual ownership before any mutation.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleStatus, Prisma } from '@prisma/client';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create ─────────────────────────────────────────────────────

  async create(dto: CreateVehicleDto, userId: string) {
    // Check for duplicate license plate
    const existing = await this.prisma.vehicle.findUnique({
      where: { licensePlate: dto.licensePlate },
    });
    if (existing) {
      throw new ConflictException(
        `A vehicle with license plate "${dto.licensePlate}" already exists`,
      );
    }

    // Fetch user to optionally link to their company
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true },
    });

    const vehicle = await this.prisma.vehicle.create({
      data: {
        vehicleType: dto.vehicleType,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        licensePlate: dto.licensePlate,
        vin: dto.vin,
        imageUrl: dto.imageUrl,
        capacity: dto.capacity,
        maxGrossWeight: dto.maxGrossWeight,
        volumeCapacity: dto.volumeCapacity,
        driveType: dto.driveType,
        status: dto.status ?? VehicleStatus.ACTIVE,
        ownerId: userId,
        companyId: user?.companyId ?? undefined,
      },
    });
    this.logger.log(
      `Vehicle ${vehicle.licensePlate} registered by user ${userId}`,
    );
    return vehicle;
  }

  // ── Find all for current user (own + company vehicles) ─────────

  async findMine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    const where: Prisma.VehicleWhereInput = user?.companyId
      ? { OR: [{ ownerId: userId }, { companyId: user.companyId }] }
      : { ownerId: userId };

    return this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find one (must be owner or from same company) ───────────────

  async findOne(id: string, userId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    await this.assertAccess(vehicle, userId);
    return vehicle;
  }

  // ── Update ─────────────────────────────────────────────────────

  async update(id: string, dto: UpdateVehicleDto, userId: string) {
    const vehicle = await this.findOne(id, userId);

    // If changing license plate, verify it's not taken by another vehicle
    if (dto.licensePlate && dto.licensePlate !== vehicle.licensePlate) {
      const conflict = await this.prisma.vehicle.findUnique({
        where: { licensePlate: dto.licensePlate },
      });
      if (conflict) {
        throw new ConflictException(
          `License plate "${dto.licensePlate}" is already in use`,
        );
      }
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: dto,
    });
  }

  // ── Delete ─────────────────────────────────────────────────────

  async remove(id: string, userId: string) {
    await this.findOne(id, userId); // ownership check
    return this.prisma.vehicle.delete({ where: { id } });
  }

  // ── Stats ──────────────────────────────────────────────────────

  async countMine(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    const where: Prisma.VehicleWhereInput = user?.companyId
      ? { OR: [{ ownerId: userId }, { companyId: user.companyId }] }
      : { ownerId: userId };
    return this.prisma.vehicle.count({ where });
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async assertAccess(
    vehicle: { ownerId: string | null; companyId: string | null },
    userId: string,
  ) {
    if (vehicle.ownerId === userId) return;

    // Check if same company
    if (vehicle.companyId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });
      if (user?.companyId === vehicle.companyId) return;
    }

    throw new ForbiddenException('You do not have access to this vehicle');
  }
}
