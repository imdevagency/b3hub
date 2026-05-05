/**
 * Equipment service — group-wide construction machinery registry.
 *
 * All CRUD operations.  Mutations are admin-only; list is admin-only too
 * (equipment is an internal operational resource, not public).
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentStatus, BuContext } from '@prisma/client';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async findAll(filters?: { status?: EquipmentStatus; buContext?: BuContext }) {
    return this.prisma.constructionEquipment.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.buContext ? { buContext: filters.buContext } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Single ────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const item = await this.prisma.constructionEquipment.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`Equipment ${id} not found`);
    return item;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateEquipmentDto) {
    const existing = await this.prisma.constructionEquipment.findUnique({
      where: { licensePlate: dto.licensePlate },
    });
    if (existing) {
      throw new ConflictException(
        `Equipment with license plate "${dto.licensePlate}" already exists`,
      );
    }

    const item = await this.prisma.constructionEquipment.create({
      data: {
        name: dto.name,
        type: dto.type,
        licensePlate: dto.licensePlate,
        yearManufactured: dto.yearManufactured,
        status: dto.status ?? EquipmentStatus.IDLE,
        buContext: dto.buContext ?? BuContext.UNASSIGNED,
        hourlyRate: dto.hourlyRate ?? 0,
        assignedProject: dto.assignedProject ?? null,
        notes: dto.notes ?? null,
      },
    });

    this.logger.log(`Equipment "${item.name}" (${item.id}) created`);
    return item;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateEquipmentDto) {
    await this.findOne(id); // throws 404 if not found

    if (dto.licensePlate) {
      const conflict = await this.prisma.constructionEquipment.findFirst({
        where: { licensePlate: dto.licensePlate, NOT: { id } },
      });
      if (conflict) {
        throw new ConflictException(
          `License plate "${dto.licensePlate}" is already used by another item`,
        );
      }
    }

    return this.prisma.constructionEquipment.update({
      where: { id },
      data: dto,
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(id: string) {
    await this.findOne(id); // throws 404 if not found
    await this.prisma.constructionEquipment.delete({ where: { id } });
    this.logger.log(`Equipment ${id} deleted`);
    return { success: true };
  }
}
