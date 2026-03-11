import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecyclingCenterDto } from './dto/create-recycling-center.dto';
import { UpdateRecyclingCenterDto } from './dto/update-recycling-center.dto';
import { QueryRecyclingCentersDto } from './dto/query-recycling-centers.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RecyclingCentersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Recycling Center CRUD ─────────────────────────────────────────────────

  /** Carrier: register a new recycling center for their company */
  async create(dto: CreateRecyclingCenterDto, companyId: string) {
    return this.prisma.recyclingCenter.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        coordinates: dto.coordinates ?? undefined,
        acceptedWasteTypes: dto.acceptedWasteTypes,
        capacity: dto.capacity,
        certifications: dto.certifications ?? [],
        operatingHours: dto.operatingHours as any,
        companyId,
        active: true,
      },
    });
  }

  /** Public: list active recycling centers with optional filters */
  async findAll(query: QueryRecyclingCentersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.activeOnly !== false) where.active = true;
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.wasteType) where.acceptedWasteTypes = { has: query.wasteType };

    const [data, total] = await Promise.all([
      this.prisma.recyclingCenter.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, logo: true, city: true } },
          _count: { select: { wasteRecords: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.recyclingCenter.count({ where }),
    ]);

    return { data, meta: { page, limit, total } };
  }

  /** Carrier: list recycling centers owned by their company */
  async findMine(companyId: string) {
    return this.prisma.recyclingCenter.findMany({
      where: { companyId },
      include: {
        _count: { select: { wasteRecords: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get a single recycling center by ID */
  async findOne(id: string) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, logo: true, phone: true, email: true } },
        _count: { select: { wasteRecords: true } },
      },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    return center;
  }

  /** Carrier: update their recycling center */
  async update(id: string, dto: UpdateRecyclingCenterDto, companyId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({ where: { id } });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId) throw new ForbiddenException('Not your recycling center');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.coordinates !== undefined) data.coordinates = dto.coordinates;
    if (dto.acceptedWasteTypes !== undefined) data.acceptedWasteTypes = dto.acceptedWasteTypes;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.certifications !== undefined) data.certifications = dto.certifications;
    if (dto.operatingHours !== undefined) data.operatingHours = dto.operatingHours;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.recyclingCenter.update({ where: { id }, data });
  }

  /** Carrier: deactivate (soft delete) their recycling center */
  async deactivate(id: string, companyId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({ where: { id } });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId) throw new ForbiddenException('Not your recycling center');

    return this.prisma.recyclingCenter.update({
      where: { id },
      data: { active: false },
    });
  }

  // ── Waste Records ─────────────────────────────────────────────────────────

  /** Carrier: log a waste delivery to a recycling center */
  async createWasteRecord(centerId: string, dto: CreateWasteRecordDto, companyId: string) {
    // Verify the center belongs to this carrier
    const center = await this.prisma.recyclingCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId) throw new ForbiddenException('Not your recycling center');

    return this.prisma.wasteRecord.create({
      data: {
        recyclingCenterId: centerId,
        containerOrderId: dto.containerOrderId ?? null,
        wasteType: dto.wasteType,
        weight: dto.weight,
        volume: dto.volume ?? null,
        processedDate: dto.processedDate ? new Date(dto.processedDate) : null,
        recyclableWeight: dto.recyclableWeight ?? null,
        recyclingRate: dto.recyclingRate ?? null,
        producedMaterialId: dto.producedMaterialId ?? null,
        certificateUrl: dto.certificateUrl ?? null,
      },
      include: {
        recyclingCenter: { select: { id: true, name: true, city: true } },
      },
    });
  }

  /** Carrier/Admin: get all waste records for a center */
  async getWasteRecords(centerId: string, companyId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId) throw new ForbiddenException('Not your recycling center');

    return this.prisma.wasteRecord.findMany({
      where: { recyclingCenterId: centerId },
      include: {
        recyclingCenter: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Buyer: get disposal records linked to their container orders */
  async getMyDisposalRecords(userId: string) {
    return this.prisma.wasteRecord.findMany({
      where: {
        containerOrder: {
          order: { buyerId: userId },
        },
      },
      include: {
        recyclingCenter: { select: { id: true, name: true, address: true, city: true } },
        containerOrder: {
          select: {
            id: true,
            order: { select: { id: true, createdAt: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Carrier: update processing results / add certificate URL */
  async updateWasteRecord(
    centerId: string,
    recordId: string,
    dto: UpdateWasteRecordDto,
    companyId: string,
  ) {
    const center = await this.prisma.recyclingCenter.findUnique({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId) throw new ForbiddenException('Not your recycling center');

    const record = await this.prisma.wasteRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Waste record not found');
    if (record.recyclingCenterId !== centerId) throw new ForbiddenException('Record not in this center');

    const data: any = {};
    if (dto.processedDate !== undefined) data.processedDate = new Date(dto.processedDate);
    if (dto.recyclableWeight !== undefined) data.recyclableWeight = dto.recyclableWeight;
    if (dto.recyclingRate !== undefined) data.recyclingRate = dto.recyclingRate;
    if (dto.producedMaterialId !== undefined) data.producedMaterialId = dto.producedMaterialId;
    if (dto.certificateUrl !== undefined) data.certificateUrl = dto.certificateUrl;

    return this.prisma.wasteRecord.update({ where: { id: recordId }, data });
  }
}
