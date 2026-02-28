import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkipHireDto } from './dto/create-skip-hire.dto';
import { UpdateSkipHireStatusDto } from './dto/update-skip-hire-status.dto';
import { SkipHireStatus, SkipSize } from '@prisma/client';

// Base prices per size (EUR)
const SKIP_PRICES: Record<SkipSize, number> = {
  MINI: 89,
  MIDI: 129,
  BUILDERS: 169,
  LARGE: 199,
};

@Injectable()
export class SkipHireService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create (public — no auth needed) ──────────────────────────
  async create(dto: CreateSkipHireDto, userId?: string) {
    const orderNumber = await this.generateOrderNumber();
    const price = SKIP_PRICES[dto.skipSize];

    return this.prisma.skipHireOrder.create({
      data: {
        orderNumber,
        location: dto.location,
        wasteCategory: dto.wasteCategory,
        skipSize: dto.skipSize,
        deliveryDate: new Date(dto.deliveryDate),
        price,
        currency: 'EUR',
        status: SkipHireStatus.PENDING,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        notes: dto.notes,
        userId: userId ?? null,
      },
    });
  }

  // ── List all (admin / internal) ────────────────────────────────
  async findAll(filters?: { status?: SkipHireStatus; userId?: string }) {
    return this.prisma.skipHireOrder.findMany({
      where: filters,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Single order ───────────────────────────────────────────────
  async findOne(id: string) {
    const order = await this.prisma.skipHireOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Skip hire order ${id} not found`);
    return order;
  }

  // ── Orders by order number ─────────────────────────────────────
  async findByOrderNumber(orderNumber: string) {
    const order = await this.prisma.skipHireOrder.findUnique({
      where: { orderNumber },
    });
    if (!order)
      throw new NotFoundException(`Order ${orderNumber} not found`);
    return order;
  }

  // ── Orders for a specific registered user ─────────────────────
  async findByUser(userId: string) {
    return this.prisma.skipHireOrder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Update status (admin / internal) ──────────────────────────
  async updateStatus(id: string, dto: UpdateSkipHireStatusDto) {
    await this.findOne(id); // ensures it exists
    return this.prisma.skipHireOrder.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ── Cancel ────────────────────────────────────────────────────
  async cancel(id: string) {
    const order = await this.findOne(id);
    if (
      order.status === SkipHireStatus.COMPLETED ||
      order.status === SkipHireStatus.COLLECTED
    ) {
      throw new BadRequestException(
        'Cannot cancel an order that is already completed or collected',
      );
    }
    return this.prisma.skipHireOrder.update({
      where: { id },
      data: { status: SkipHireStatus.CANCELLED },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.skipHireOrder.count();
    const d = new Date();
    const yy = d.getFullYear().toString().slice(-2);
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const seq = (count + 1).toString().padStart(5, '0');
    return `SKP${yy}${mm}${seq}`;
  }
}
