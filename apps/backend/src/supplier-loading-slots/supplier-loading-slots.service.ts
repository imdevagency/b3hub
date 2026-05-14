import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { CreateLoadingSlotDto } from './dto/create-loading-slot.dto';
import { UpdateLoadingSlotDto } from './dto/update-loading-slot.dto';

@Injectable()
export class SupplierLoadingSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new loading window for a supplier company. */
  async create(dto: CreateLoadingSlotDto, currentUser: RequestingUser) {
    this.assertCanManage(currentUser, dto.companyId);
    return this.prisma.supplierLoadingSlot.create({
      data: {
        companyId: dto.companyId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        capacity: dto.capacity ?? 1,
        isActive: dto.isActive ?? true,
        label: dto.label,
      },
    });
  }

  /** List all loading windows for a company. */
  async findByCompany(companyId: string, currentUser: RequestingUser) {
    this.assertCanManage(currentUser, companyId);
    return this.prisma.supplierLoadingSlot.findMany({
      where: { companyId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Returns available slot windows for a given supplier + date.
   * Each slot shows how many bookings exist vs capacity.
   * Used by dispatcher when scheduling MATERIAL_DELIVERY jobs.
   */
  async getAvailableForDate(companyId: string, dateStr: string) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new Error('Invalid date');

    const dayOfWeek = date.getDay();

    const slots = await this.prisma.supplierLoadingSlot.findMany({
      where: { companyId, dayOfWeek, isActive: true },
      include: {
        bookings: {
          where: {
            pickupDate: {
              gte: new Date(`${dateStr}T00:00:00.000Z`),
              lte: new Date(`${dateStr}T23:59:59.999Z`),
            },
          },
          select: { id: true, jobNumber: true, status: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return slots.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: slot.label,
      capacity: slot.capacity,
      booked: slot.bookings.length,
      available: slot.capacity - slot.bookings.length,
      bookings: slot.bookings,
    }));
  }

  /** Update a slot's config. */
  async update(id: string, dto: UpdateLoadingSlotDto, currentUser: RequestingUser) {
    const slot = await this.prisma.supplierLoadingSlot.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!slot) throw new NotFoundException('Loading slot not found');
    this.assertCanManage(currentUser, slot.companyId);
    return this.prisma.supplierLoadingSlot.update({ where: { id }, data: dto });
  }

  /** Delete a slot. */
  async remove(id: string, currentUser: RequestingUser) {
    const slot = await this.prisma.supplierLoadingSlot.findUnique({
      where: { id },
      select: { companyId: true },
    });
    if (!slot) throw new NotFoundException('Loading slot not found');
    this.assertCanManage(currentUser, slot.companyId);
    await this.prisma.supplierLoadingSlot.delete({ where: { id } });
    return { ok: true };
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private assertCanManage(user: RequestingUser, companyId: string) {
    if (user.userType === 'ADMIN') return;
    // Supplier company owner/manager can manage their own slots
    if (
      user.companyId === companyId &&
      (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER')
    ) {
      return;
    }
    throw new ForbiddenException('You cannot manage loading slots for this company');
  }
}
