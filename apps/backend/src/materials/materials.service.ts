/**
 * Materials service.
 * CRUD for recyclable/raw material listings created by approved suppliers (canSell).
 * Supports category & text filtering, Supabase image upload, and ownership checks.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialCategory } from '@prisma/client';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createMaterialDto: CreateMaterialDto) {
    const material = await this.prisma.material.create({
      data: createMaterialDto,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            logo: true,
            rating: true,
          },
        },
      },
    });
    this.logger.log(`Material ${material.id} created`);
    return material;
  }

  async findAll(filters?: {
    category?: MaterialCategory;
    supplierId?: string;
    isRecycled?: boolean;
    inStock?: boolean;
    search?: string;
    priceMax?: number;
    limit?: number;
    skip?: number;
  }) {
    const { category, supplierId, isRecycled, inStock, search, priceMax, limit = 40, skip = 0 } = filters ?? {};

    const where = {
      active: true,
      ...(category ? { category } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(isRecycled != null ? { isRecycled } : {}),
      ...(inStock ? { inStock: true } : {}),
      ...(priceMax != null ? { basePrice: { lte: priceMax } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              logo: true,
              rating: true,
              city: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // hard cap at 100 per page
        skip,
      }),
      this.prisma.material.count({ where }),
    ]);

    return { items, total, limit: Math.min(limit, 100), skip, hasMore: skip + items.length < total };
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            logo: true,
            rating: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
        priceTiers: { orderBy: { minQty: 'asc' } },
      },
    });

    if (!material) {
      throw new NotFoundException(`Material with ID ${id} not found`);
    }

    return material;
  }

  async update(
    id: string,
    updateMaterialDto: UpdateMaterialDto,
    currentUser?: { userId: string; userType: string; companyId?: string },
  ) {
    const material = await this.findOne(id);

    if (
      currentUser &&
      currentUser.userType !== 'ADMIN'
    ) {
      if (!currentUser.companyId) {
        throw new ForbiddenException('Your account is not linked to a company');
      }
      if (material.supplierId !== currentUser.companyId) {
        throw new ForbiddenException('You do not own this material');
      }
    }

    return this.prisma.material.update({
      where: { id },
      data: updateMaterialDto,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });
  }

  async remove(
    id: string,
    currentUser?: { userId: string; userType: string; companyId?: string },
  ) {
    const material = await this.findOne(id);

    if (
      currentUser &&
      currentUser.userType !== 'ADMIN'
    ) {
      if (!currentUser.companyId) {
        throw new ForbiddenException('Your account is not linked to a company');
      }
      if (material.supplierId !== currentUser.companyId) {
        throw new ForbiddenException('You do not own this material');
      }
    }

    return this.prisma.material.update({
      where: { id },
      data: { active: false },
    });
  }

  async getCategories() {
    const rows = await this.prisma.material.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async search(query: string) {
    return this.prisma.material.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { subCategory: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            logo: true,
            rating: true,
          },
        },
      },
      take: 20,
    });
  }

  /**
   * Hybrid marketplace: returns instant supplier offers for a given material
   * category and delivery location, sorted by effective price.
   * If coords are provided, offers outside the supplier's deliveryRadiusKm are
   * excluded.  Falls back to all in-stock listings when no coords given.
   */
  async getOffers(params: {
    category: string;
    quantity: number;
    lat?: number;
    lng?: number;
  }) {
    const listings = await this.prisma.material.findMany({
      where: {
        active: true,
        inStock: true,
        category: params.category as import('@prisma/client').MaterialCategory,
        ...(params.quantity
          ? {
              OR: [{ minOrder: null }, { minOrder: { lte: params.quantity } }],
            }
          : {}),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            city: true,
            logo: true,
            rating: true,
            phone: true,
            lat: true,
            lng: true,
          },
        },
        priceTiers: { orderBy: { minQty: 'asc' } },
      },
      orderBy: { basePrice: 'asc' },
    });

    // ── Compute supplier performance in one query ──────────────────────────
    const supplierIds = [...new Set(listings.map((m) => m.supplierId))];
    let perfMap: Record<string, { total: number; completed: number }> = {};
    if (supplierIds.length > 0) {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { material: { supplierId: { in: supplierIds } } },
        select: {
          material: { select: { supplierId: true } },
          order: { select: { status: true } },
        },
      });
      for (const row of orderItems) {
        const sid = row.material.supplierId;
        if (!perfMap[sid]) perfMap[sid] = { total: 0, completed: 0 };
        perfMap[sid].total++;
        if (row.order.status === 'DELIVERED' || row.order.status === 'COMPLETED') {
          perfMap[sid].completed++;
        }
      }
    }

    // If coordinates provided, filter by delivery radius and add distance
    let results = listings.map((m) => {
      let distanceKm: number | null = null;
      if (params.lat != null && params.lng != null && m.supplier.lat != null && m.supplier.lng != null) {
        // Haversine approximation (good enough for ~500 km)
        const R = 6371;
        const suppLat = m.supplier.lat;
        const suppLng = m.supplier.lng;
        const dLat = ((params.lat - suppLat) * Math.PI) / 180;
        const dLng = ((params.lng - suppLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((suppLat * Math.PI) / 180) *
            Math.cos((params.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        distanceKm = Math.round(
          R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
        );
      }
      // Strip internal lat/lng from the response payload
      const { lat: _lat, lng: _lng, ...supplierPublic } = m.supplier;
      // Apply volume price tier if the material has any
      const effectivePrice = this.resolvePrice(m.basePrice, m.priceTiers ?? [], params.quantity);
      // Supplier performance score
      const perf = perfMap[m.supplierId];
      const completionRate =
        perf && perf.total >= 3
          ? Math.round((perf.completed / perf.total) * 100)
          : null;
      // Distance-based delivery fee: €1.20/km standard rate (null when distance unknown)
      const DELIVERY_RATE_EUR_PER_KM = 1.20;
      const deliveryFee =
        distanceKm != null
          ? Math.round(distanceKm * DELIVERY_RATE_EUR_PER_KM * 100) / 100
          : null;
      return {
        ...m,
        supplier: supplierPublic,
        distanceKm,
        effectiveUnitPrice: effectivePrice,
        deliveryFee,
        totalPrice:
          Math.round((effectivePrice * params.quantity + (deliveryFee ?? 0)) * 100) / 100,
        etaDays: 1,
        isInstant: true,
        completionRate,
        totalOrders: perf?.total ?? 0,
      };
    });

    // Filter out suppliers whose radius is set and buyer is outside it
    // Suppliers without coordinates are always included (distance unknown = assume in range)
    if (params.lat != null && params.lng != null) {
      results = results.filter(
        (r) =>
          r.deliveryRadiusKm == null ||
          r.distanceKm == null ||
          r.distanceKm <= r.deliveryRadiusKm,
      );
    }

    return results;
  }

  // ─── Volume price tier helpers ──────────────────────────────────────────

  /**
   * Returns the unit price for a given quantity by picking the highest-minQty
   * tier that the quantity qualifies for.  Falls back to basePrice.
   */
  resolvePrice(
    basePrice: number,
    tiers: { minQty: number; unitPrice: number }[],
    quantity: number,
  ): number {
    const applicable = tiers
      .filter((t) => quantity >= t.minQty)
      .sort((a, b) => b.minQty - a.minQty);
    return applicable.length > 0 ? applicable[0].unitPrice : basePrice;
  }

  async getTiers(materialId: string) {
    return this.prisma.materialPriceTier.findMany({
      where: { materialId },
      orderBy: { minQty: 'asc' },
    });
  }

  async setTiers(
    materialId: string,
    tiers: { minQty: number; unitPrice: number }[],
    currentUser: { userType: string; companyId?: string },
  ) {
    const material = await this.findOne(materialId);
    if (currentUser.userType !== 'ADMIN' && material.supplierId !== currentUser.companyId) {
      throw new ForbiddenException('You do not own this material');
    }
    // Replace all existing tiers atomically
    await this.prisma.$transaction([
      this.prisma.materialPriceTier.deleteMany({ where: { materialId } }),
      ...(tiers.length > 0
        ? [
            this.prisma.materialPriceTier.createMany({
              data: tiers.map((t) => ({ materialId, minQty: t.minQty, unitPrice: t.unitPrice })),
            }),
          ]
        : []),
    ]);
    return this.getTiers(materialId);
  }
}
