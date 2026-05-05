/**
 * Recycling centers service.
 * CRUD for facility profiles: accepted waste types, GPS coordinates,
 * operating hours, and processing capacity.
 */
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRecyclingCenterDto } from './dto/create-recycling-center.dto';
import { UpdateRecyclingCenterDto } from './dto/update-recycling-center.dto';
import { QueryRecyclingCentersDto } from './dto/query-recycling-centers.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
import { DocumentsService } from '../documents/documents.service';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RecyclingCentersService {
  private readonly logger = new Logger(RecyclingCentersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  // ── Recycling Center CRUD ─────────────────────────────────────────────────

  /** Carrier: register a new recycling center for their company */
  async create(dto: CreateRecyclingCenterDto, companyId: string) {
    const center = await this.prisma.recyclingCenter.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        coordinates: dto.coordinates
          ? ({
              lat: dto.coordinates.lat,
              lng: dto.coordinates.lng,
            } as Prisma.InputJsonValue)
          : undefined,
        acceptedWasteTypes: dto.acceptedWasteTypes,
        capacity: dto.capacity,
        certifications: dto.certifications ?? [],
        operatingHours: dto.operatingHours as Prisma.InputJsonValue,
        companyId,
        active: true,
      },
    });
    this.logger.log(
      `Recycling center "${center.name}" registered for company ${companyId}`,
    );
    return center;
  }

  /** Public: list active recycling centers with optional filters */
  async findAll(query: QueryRecyclingCentersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RecyclingCenterWhereInput = {};
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
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            phone: true,
            email: true,
          },
        },
        _count: { select: { wasteRecords: true } },
      },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    return center;
  }

  /** Carrier: update their recycling center */
  async update(id: string, dto: UpdateRecyclingCenterDto, companyId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId)
      throw new ForbiddenException('Not your recycling center');

    const data: Prisma.RecyclingCenterUpdateInput = {};
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.coordinates !== undefined)
      data.coordinates =
        dto.coordinates !== null
          ? (dto.coordinates as Prisma.InputJsonValue)
          : Prisma.DbNull;
    if (dto.acceptedWasteTypes !== undefined)
      data.acceptedWasteTypes = dto.acceptedWasteTypes;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.certifications !== undefined)
      data.certifications = dto.certifications;
    if (dto.operatingHours !== undefined)
      data.operatingHours = dto.operatingHours;
    if (dto.active !== undefined) data.active = dto.active;

    return this.prisma.recyclingCenter.update({ where: { id }, data });
  }

  /** Carrier: deactivate (soft delete) their recycling center */
  async deactivate(id: string, companyId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId)
      throw new ForbiddenException('Not your recycling center');

    return this.prisma.recyclingCenter.update({
      where: { id },
      data: { active: false },
    });
  }

  // ── Waste Records ─────────────────────────────────────────────────────────

  /** Carrier: log a waste delivery to a recycling center */
  async createWasteRecord(
    centerId: string,
    dto: CreateWasteRecordDto,
    companyId: string,
  ) {
    // Verify the center belongs to this carrier
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: centerId },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId)
      throw new ForbiddenException('Not your recycling center');

    const record = await this.prisma.wasteRecord.create({
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

    // Auto-generate WASTE_CERTIFICATE document (fire-and-forget, non-fatal)
    this.documents
      .generateWasteCertificate({
        ownerId: companyId,
        wasteRecordId: record.id,
        centerId,
        centerName: record.recyclingCenter.name,
        centerCity: record.recyclingCenter.city ?? undefined,
        wasteType: record.wasteType ?? undefined,
        weightKg: record.weight ? Number(record.weight) * 1000 : undefined,
        recyclableWeightKg: record.recyclableWeight
          ? Number(record.recyclableWeight) * 1000
          : undefined,
        recyclingRate: record.recyclingRate
          ? Number(record.recyclingRate)
          : undefined,
        processedDate: record.processedDate ?? undefined,
      })
      .catch((err) =>
        this.logger.warn(
          `Waste cert generation failed for record ${record.id}: ${(err as Error).message}`,
        ),
      );

    return record;
  }

  /** Carrier/Admin: get all waste records for a center */
  async getWasteRecords(centerId: string, companyId: string) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: centerId },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId)
      throw new ForbiddenException('Not your recycling center');

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
    // Include both container-order-linked records AND direct disposal order records
    return this.prisma.wasteRecord.findMany({
      where: {
        OR: [
          { containerOrder: { order: { createdById: userId } } },
          { order: { createdById: userId } },
        ],
      },
      include: {
        recyclingCenter: {
          select: { id: true, name: true, address: true, city: true },
        },
        containerOrder: {
          select: {
            id: true,
            order: { select: { id: true, createdAt: true } },
          },
        },
        order: {
          select: { id: true, orderNumber: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Buyer: aggregate sustainability stats across all their disposal records.
   * CO₂ estimate uses 0.35t CO₂e per tonne of construction waste diverted from landfill.
   */
  async getMySustainabilityStats(userId: string) {
    const records = await this.prisma.wasteRecord.findMany({
      where: {
        OR: [
          { containerOrder: { order: { createdById: userId } } },
          { order: { createdById: userId } },
        ],
      },
      select: {
        id: true,
        weight: true,
        recyclableWeight: true,
        recyclingRate: true,
        certificateUrl: true,
        wasteType: true,
        processedDate: true,
        createdAt: true,
      },
    });

    const totalWeight = records.reduce((s, r) => s + (r.weight ?? 0), 0);
    const totalRecycled = records.reduce((s, r) => s + (r.recyclableWeight ?? 0), 0);
    const certifiedCount = records.filter((r) => !!r.certificateUrl).length;
    const co2DiversionTonnes = parseFloat((totalRecycled * 0.35).toFixed(2));
    const avgRecyclingRate =
      records.filter((r) => r.recyclingRate != null).length > 0
        ? records
            .filter((r) => r.recyclingRate != null)
            .reduce((s, r) => s + (r.recyclingRate ?? 0), 0) /
          records.filter((r) => r.recyclingRate != null).length
        : null;

    // Monthly trend: last 6 months
    const now = new Date();
    const monthlyTrend: { month: string; weight: number; recycled: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('lv-LV', { month: 'short', year: '2-digit' });
      const monthRecords = records.filter((r) => {
        const rd = new Date(r.createdAt);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });
      monthlyTrend.push({
        month: label,
        weight: parseFloat(monthRecords.reduce((s, r) => s + (r.weight ?? 0), 0).toFixed(2)),
        recycled: parseFloat(
          monthRecords.reduce((s, r) => s + (r.recyclableWeight ?? 0), 0).toFixed(2),
        ),
      });
    }

    return {
      totalRecords: records.length,
      totalWeightTonnes: parseFloat(totalWeight.toFixed(2)),
      totalRecycledTonnes: parseFloat(totalRecycled.toFixed(2)),
      certifiedCount,
      co2DiversionTonnes,
      avgRecyclingRate: avgRecyclingRate != null ? parseFloat(avgRecyclingRate.toFixed(1)) : null,
      monthlyTrend,
    };
  }

  /** Carrier: update processing results / add certificate URL */
  async updateWasteRecord(
    centerId: string,
    recordId: string,
    dto: UpdateWasteRecordDto,
    companyId: string,
  ) {
    const center = await this.prisma.recyclingCenter.findUnique({
      where: { id: centerId },
    });
    if (!center) throw new NotFoundException('Recycling center not found');
    if (center.companyId !== companyId)
      throw new ForbiddenException('Not your recycling center');

    const record = await this.prisma.wasteRecord.findUnique({
      where: { id: recordId },
    });
    if (!record) throw new NotFoundException('Waste record not found');
    if (record.recyclingCenterId !== centerId)
      throw new ForbiddenException('Record not in this center');

    const data: Prisma.WasteRecordUpdateInput = {};
    if (dto.processedDate) data.processedDate = new Date(dto.processedDate);
    if (dto.recyclableWeight !== undefined)
      data.recyclableWeight = dto.recyclableWeight;
    if (dto.recyclingRate !== undefined) data.recyclingRate = dto.recyclingRate;
    if (dto.producedMaterialId !== undefined)
      data.producedMaterialId = dto.producedMaterialId;
    if (dto.certificateUrl !== undefined)
      data.certificateUrl = dto.certificateUrl;

    return this.prisma.wasteRecord.update({ where: { id: recordId }, data });
  }

  /** Recycler: get incoming disposal transport jobs for their centers */
  async getIncomingJobs(companyId: string) {
    const centers = await this.prisma.recyclingCenter.findMany({
      where: { companyId, active: true },
      select: { id: true },
    });
    const centerIds = centers.map((c) => c.id);

    return this.prisma.transportJob.findMany({
      where: {
        recyclingCenterId: { in: centerIds },
        jobType: 'WASTE_COLLECTION',
      },
      include: {
        recyclingCenter: { select: { id: true, name: true, address: true } },
        requester: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Recycler: get all waste records for their centers */
  async getMyWasteRecords(companyId: string) {
    const centers = await this.prisma.recyclingCenter.findMany({
      where: { companyId, active: true },
      select: { id: true },
    });
    const centerIds = centers.map((c) => c.id);

    return this.prisma.wasteRecord.findMany({
      where: { recyclingCenterId: { in: centerIds } },
      include: {
        recyclingCenter: { select: { id: true, name: true } },
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
}
