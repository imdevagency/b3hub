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
  BadRequestException,
} from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialCategory } from '@prisma/client';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MaterialsService {
  private readonly logger = new Logger(MaterialsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private readonly supabase: SupabaseService,
  ) {}

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
    lat?: number;
    lng?: number;
  }) {
    const { category, supplierId, isRecycled, inStock, search, priceMax, limit = 40, skip = 0, lat, lng } = filters ?? {};

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

    const [rawItems, total] = await this.prisma.$transaction([
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
              lat: true,
              lng: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100), // hard cap at 100 per page
        skip,
      }),
      this.prisma.material.count({ where }),
    ]);

    // Apply location-based filtering when lat/lng are provided
    // deliveryRadiusKm lives on the Material, not the Company
    let filteredItems = rawItems;
    if (lat != null && lng != null) {
      filteredItems = rawItems.filter((m) => {
        const sLat = m.supplier.lat;
        const sLng = m.supplier.lng;
        if (sLat == null || sLng == null) return true; // supplier has no coords → keep
        const R = 6371;
        const dLat = ((lat - sLat) * Math.PI) / 180;
        const dLng = ((lng - sLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((sLat * Math.PI) / 180) *
            Math.cos((lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        const radius = m.deliveryRadiusKm ?? null;
        return radius == null || distKm <= radius;
      });
    }

    // Strip internal lat/lng from supplier before returning
    const items = filteredItems.map((m) => {
      const { lat: _lat, lng: _lng, ...supplierPublic } = m.supplier;
      return { ...m, supplier: supplierPublic };
    });

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
      // ETA: simple model — 60 km/h average laden speed + 1.5 h loading/unloading buffer
      const etaHours = distanceKm != null ? Math.round(distanceKm / 60 + 1.5) : null;
      const etaLabel =
        etaHours == null
          ? 'Rīt'
          : etaHours <= 3
          ? `~${etaHours} h`
          : etaHours <= 8
          ? 'Šodien'
          : 'Rīt';
      const etaDays = etaHours == null || etaHours > 8 ? 2 : 1;
      return {
        ...m,
        supplier: supplierPublic,
        distanceKm,
        effectiveUnitPrice: effectivePrice,
        deliveryFee,
        totalPrice:
          Math.round((effectivePrice * params.quantity + (deliveryFee ?? 0)) * 100) / 100,
        etaDays,
        etaHours,
        etaLabel,
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

  /**
   * Upload a product photo (base64) to Supabase Storage and append the URL
   * to the material's images array. Returns the updated image list.
   */
  async uploadMaterialImage(
    materialId: string,
    base64: string,
    mimeType: string,
    currentUser: { userType: string; companyId?: string },
  ): Promise<{ images: string[] }> {
    const material = await this.findOne(materialId);
    if (currentUser.userType !== 'ADMIN' && material.supplierId !== currentUser.companyId) {
      throw new ForbiddenException('You do not own this material');
    }

    if (!this.supabase) {
      throw new BadRequestException('File storage is not configured');
    }

    // Strip data URI prefix if present
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(raw, 'base64');

    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `material-images/${materialId}/${Date.now()}.${ext}`;

    await this.supabase.uploadFile('material-images', path, buffer);
    const imageUrl = this.supabase.getPublicUrl('material-images', path);

    const updated = await this.prisma.material.update({
      where: { id: materialId },
      data: { images: { push: imageUrl } },
      select: { images: true },
    });

    this.logger.log(`Material ${materialId} image uploaded: ${imageUrl}`);
    return { images: updated.images };
  }
}
