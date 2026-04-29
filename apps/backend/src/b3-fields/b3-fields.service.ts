import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateB3FieldDto } from './dto/create-b3-field.dto';
import { UpdateB3FieldDto } from './dto/update-b3-field.dto';
import { CreatePickupSlotDto } from './dto/create-pickup-slot.dto';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto/create-inventory-item.dto';

@Injectable()
export class B3FieldsService {
  private readonly logger = new Logger(B3FieldsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Fields ──────────────────────────────────────────────────────────────────

  async findAll(activeOnly = true) {
    return this.prisma.b3Field.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        recyclingCenter: {
          select: { id: true, name: true, acceptedWasteTypes: true },
        },
        _count: { select: { pickupSlots: true } },
      },
      orderBy: { city: 'asc' },
    });
  }

  async findOne(id: string) {
    const field = await this.prisma.b3Field.findUnique({
      where: { id },
      include: {
        recyclingCenter: {
          select: {
            id: true,
            name: true,
            acceptedWasteTypes: true,
            capacity: true,
            operatingHours: true,
          },
        },
      },
    });
    if (!field) throw new NotFoundException('B3 Field not found');
    return field;
  }

  async findBySlug(slug: string) {
    const field = await this.prisma.b3Field.findUnique({
      where: { slug },
      include: {
        recyclingCenter: {
          select: { id: true, acceptedWasteTypes: true },
        },
      },
    });
    if (!field) throw new NotFoundException('B3 Field not found');
    return field;
  }

  async create(dto: CreateB3FieldDto) {
    // Check slug uniqueness
    const existing = await this.prisma.b3Field.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already in use');

    return this.prisma.b3Field.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode,
        lat: dto.lat,
        lng: dto.lng,
        services: dto.services,
        openingHours: dto.openingHours,
        recyclingCenterId: dto.recyclingCenterId,
        active: dto.active ?? true,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, dto: UpdateB3FieldDto) {
    await this.findOne(id); // 404 guard
    return this.prisma.b3Field.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.services !== undefined && { services: dto.services }),
        ...(dto.openingHours !== undefined && {
          openingHours: dto.openingHours,
        }),
        ...(dto.recyclingCenterId !== undefined && {
          recyclingCenterId: dto.recyclingCenterId,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  // ── Today's arrivals (gate view) ─────────────────────────────────────────

  async getTodayArrivals(fieldId: string) {
    await this.findOne(fieldId);
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Orders with PICKUP fulfillment type at this field today
    const orders = await this.prisma.order.findMany({
      where: {
        pickupFieldId: fieldId,
        fulfillmentType: 'PICKUP',
        deliveryDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        buyer: { select: { name: true } },
        items: {
          include: {
            material: { select: { name: true, unit: true } },
          },
        },
        pickupSlot: { select: { slotStart: true, slotEnd: true } },
        fieldPasses: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            passNumber: true,
            vehiclePlate: true,
            driverName: true,
            status: true,
          },
        },
      },
      orderBy: [
        { pickupSlot: { slotStart: 'asc' } },
        { deliveryDate: 'asc' },
      ],
    });

    // Waste disposal arrivals (field passes valid today)
    const passes = await this.prisma.fieldPass.findMany({
      where: {
        status: 'ACTIVE',
        validFrom: { lte: endOfDay },
        validTo: { gte: startOfDay },
        order: {
          pickupFieldId: fieldId,
        },
      },
      include: {
        company: { select: { name: true } },
        weighingSlips: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
          },
        },
      },
    });

    return { orders, passes };
  }

  // ── Pickup Slots ─────────────────────────────────────────────────────────

  async getSlots(fieldId: string, date: string) {
    const day = new Date(date);
    if (isNaN(day.getTime())) throw new BadRequestException('Invalid date');
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);

    return this.prisma.pickupSlot.findMany({
      where: {
        fieldId,
        slotStart: { gte: start, lte: end },
      },
      orderBy: { slotStart: 'asc' },
    });
  }

  async createSlot(dto: CreatePickupSlotDto) {
    await this.findOne(dto.fieldId);
    const start = new Date(dto.slotStart);
    const end = new Date(dto.slotEnd);
    if (end <= start) {
      throw new BadRequestException('slotEnd must be after slotStart');
    }
    return this.prisma.pickupSlot.create({
      data: {
        fieldId: dto.fieldId,
        slotStart: start,
        slotEnd: end,
        capacity: dto.capacity ?? 4,
      },
    });
  }

  async bookSlot(slotId: string): Promise<void> {
    const slot = await this.prisma.pickupSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new NotFoundException('Pickup slot not found');
    if (slot.booked >= slot.capacity) {
      throw new ConflictException('Pickup slot is fully booked');
    }
    await this.prisma.pickupSlot.update({
      where: { id: slotId },
      data: { booked: { increment: 1 } },
    });
  }

  async releaseSlot(slotId: string): Promise<void> {
    await this.prisma.pickupSlot.update({
      where: { id: slotId },
      data: { booked: { decrement: 1 } },
    });
  }

  // ── Inventory ────────────────────────────────────────────────────────────

  async getInventory(fieldId: string) {
    await this.findOne(fieldId);
    return this.prisma.b3FieldInventoryItem.findMany({
      where: { fieldId },
      orderBy: [{ available: 'desc' }, { name: 'asc' }],
    });
  }

  async createInventoryItem(fieldId: string, dto: CreateInventoryItemDto) {
    await this.findOne(fieldId);
    return this.prisma.b3FieldInventoryItem.create({
      data: {
        fieldId,
        name: dto.name,
        unit: dto.unit,
        pricePerUnit: dto.pricePerUnit,
        stockQty: dto.stockQty ?? 0,
        minStockQty: dto.minStockQty ?? 0,
        available: dto.available ?? true,
        notes: dto.notes,
      },
    });
  }

  async updateInventoryItem(fieldId: string, itemId: string, dto: UpdateInventoryItemDto) {
    const item = await this.prisma.b3FieldInventoryItem.findFirst({
      where: { id: itemId, fieldId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return this.prisma.b3FieldInventoryItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.pricePerUnit !== undefined && { pricePerUnit: dto.pricePerUnit }),
        ...(dto.stockQty !== undefined && { stockQty: dto.stockQty }),
        ...(dto.minStockQty !== undefined && { minStockQty: dto.minStockQty }),
        ...(dto.available !== undefined && { available: dto.available }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async deleteInventoryItem(fieldId: string, itemId: string) {
    const item = await this.prisma.b3FieldInventoryItem.findFirst({
      where: { id: itemId, fieldId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    await this.prisma.b3FieldInventoryItem.delete({ where: { id: itemId } });
  }

  // ── Public inventory (no auth) ────────────────────────────────────────────

  async getPublicInventory(fieldId: string) {
    return this.prisma.b3FieldInventoryItem.findMany({
      where: { fieldId, available: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        unit: true,
        pricePerUnit: true,
        stockQty: true,
      },
    });
  }

  // ── Slot bulk-generator ───────────────────────────────────────────────────

  async bulkCreateSlots(
    fieldId: string,
    body: {
      startDate: string; // ISO date YYYY-MM-DD
      endDate: string;   // ISO date YYYY-MM-DD
      slotTimes: string[]; // e.g. ['08:00', '10:00', '12:00']
      durationMinutes: number; // slot duration, e.g. 60
      capacity: number; // capacity per slot
      daysOfWeek: number[]; // 0=Sun … 6=Sat; empty = all days
    },
  ): Promise<{ created: number }> {
    await this.findOne(fieldId);
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (end < start) throw new BadRequestException('endDate must be >= startDate');
    if (!body.slotTimes.length) throw new BadRequestException('slotTimes must not be empty');

    const days = body.daysOfWeek?.length ? new Set(body.daysOfWeek) : null;
    const slots: Array<{
      fieldId: string;
      slotStart: Date;
      slotEnd: Date;
      capacity: number;
      booked: number;
    }> = [];

    const cursor = new Date(start);
    while (cursor <= end) {
      if (!days || days.has(cursor.getDay())) {
        for (const time of body.slotTimes) {
          const [h, m] = time.split(':').map(Number);
          const slotStart = new Date(cursor);
          slotStart.setHours(h, m, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + body.durationMinutes * 60 * 1000);
          slots.push({
            fieldId,
            slotStart,
            slotEnd,
            capacity: body.capacity,
            booked: 0,
          });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (!slots.length) return { created: 0 };

    const result = await this.prisma.pickupSlot.createMany({
      data: slots,
      skipDuplicates: true,
    });

    return { created: result.count };
  }

  // ── Auto-create a FieldPass for a PICKUP order on confirmation ────────────

  async autoCreatePickupPass(
    orderId: string,
    companyId: string,
    createdById: string,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupSlot: true,
        items: { include: { material: { select: { name: true } } } },
      },
    });
    if (!order || !order.pickupFieldId) return;

    // Find an active isFieldContract for this company, if any
    const contract = await this.prisma.frameworkContract.findFirst({
      where: {
        buyerId: companyId,
        isFieldContract: true,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!contract) {
      // No field contract — skip pass generation (company doesn't have site access agreement)
      return;
    }

    const passNumber = await this.generatePassNumber();
    const slotStart = order.pickupSlot?.slotStart;
    const validFrom = slotStart ?? order.deliveryDate ?? new Date();
    const slotEnd = order.pickupSlot?.slotEnd;
    const validTo = slotEnd ?? new Date(validFrom.getTime() + 24 * 60 * 60 * 1000);
    const materialNames = order.items.map((i) => i.material.name).join(', ');

    await this.prisma.fieldPass.create({
      data: {
        passNumber,
        companyId,
        createdById,
        contractId: contract.id,
        orderId,
        validFrom,
        validTo,
        status: 'ACTIVE',
        vehiclePlate: 'TBD',
        driverName: order.siteContactName ?? undefined,
        wasteDescription: materialNames || undefined,
      },
    });
  }

  private async generatePassNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.fieldPass.count();
    const seq = String(count + 1).padStart(5, '0');
    return `FP-${year}-${seq}`;
  }

  // ── Gate scan ─────────────────────────────────────────────────────────────

  async scanPass(fieldId: string, passNumber: string) {
    const field = await this.prisma.b3Field.findUnique({
      where: { id: fieldId },
      select: {
        id: true,
        name: true,
        recyclingCenter: { select: { acceptedWasteTypes: true } },
      },
    });
    if (!field) throw new NotFoundException('B3 Field not found');

    const pass = await this.prisma.fieldPass.findUnique({
      where: { passNumber: passNumber.toUpperCase().trim() },
      include: {
        company: { select: { name: true, legalName: true, registrationNum: true } },
        contract: { select: { contractNumber: true, title: true } },
        order: { select: { orderNumber: true } },
        weighingSlips: {
          select: { id: true, slipNumber: true, netTonnes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!pass) throw new NotFoundException('Pass not found');

    const now = new Date();
    const isValid =
      pass.status === 'ACTIVE' &&
      new Date(pass.validFrom) <= now &&
      new Date(pass.validTo) >= now;

    // Check whether the declared waste class is accepted by this field's recycling center.
    // wasteClassCode on the pass uses EWC format (e.g. "17 05 04") or a WasteType enum value.
    // We do a case-insensitive substring match so both conventions work.
    const acceptedWasteTypes: string[] =
      field.recyclingCenter?.acceptedWasteTypes ?? [];
    const wasteCode = pass.wasteClassCode?.toUpperCase().trim() ?? null;
    const wasteAccepted: boolean =
      acceptedWasteTypes.length === 0 // no restriction configured → accept all
        ? true
        : wasteCode !== null &&
          acceptedWasteTypes.some(
            (wt) =>
              wt.toUpperCase() === wasteCode ||
              wasteCode.includes(wt.toUpperCase()) ||
              wt.toUpperCase().includes(wasteCode),
          );

    return {
      pass,
      isValid,
      /** false when the pass's wasteClassCode is not in the field's acceptedWasteTypes list */
      wasteAccepted,
      /** convenience list so the gate UI can display what IS accepted */
      acceptedWasteTypes,
      field: { id: field.id, name: field.name },
      scannedAt: now.toISOString(),
    };
  }
}
