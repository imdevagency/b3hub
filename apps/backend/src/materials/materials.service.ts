import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { MaterialCategory } from '@prisma/client';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(createMaterialDto: CreateMaterialDto) {
    return this.prisma.material.create({
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

  async update(id: string, updateMaterialDto: UpdateMaterialDto) {
    await this.findOne(id); // Check if exists

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

  async remove(id: string) {
    await this.findOne(id); // Check if exists

    return this.prisma.material.update({
      where: { id },
      data: { active: false },
    });
  }

  async getCategories() {
    return Object.values(MaterialCategory);
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
}
