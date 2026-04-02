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
  }) {
    return this.prisma.material.findMany({
      where: {
        active: true,
        ...filters,
      },
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
      orderBy: {
        createdAt: 'desc',
      },
      take: 500,
    });
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
      currentUser.userType !== 'ADMIN' &&
      currentUser.companyId
    ) {
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
      currentUser.userType !== 'ADMIN' &&
      currentUser.companyId
    ) {
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
      },
      orderBy: { basePrice: 'asc' },
    });

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
      return {
        ...m,
        supplier: supplierPublic,
        distanceKm,
        totalPrice: Math.round(m.basePrice * params.quantity * 100) / 100,
        etaDays: 1,
        isInstant: true,
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
}
