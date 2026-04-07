/**
 * Materials controller — /api/v1/materials
 * Public listing (with optional auth for pricing visibility) and authenticated
 * endpoints to create, update, and delete material listings.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ForbiddenException,
  Put,
} from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { QueryMaterialsDto, SearchMaterialsDto } from './dto/query-materials.dto';
import { GetOffersDto } from './dto/get-offers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

/** Checks that the authenticated user has canSell=true (or is ADMIN) */
function assertCanSell(user: RequestingUser) {
  if (!user.canSell && user.userType !== 'ADMIN') {
    throw new ForbiddenException('Only approved sellers can manage materials');
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

class UploadMaterialImageDto {
  @IsString()
  @IsNotEmpty()
  base64: string;

  @IsIn(ALLOWED_IMAGE_TYPES)
  mimeType: string;
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Materials')
@Controller('materials')
@UseGuards(JwtAuthGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  create(
    @Body() createMaterialDto: CreateMaterialDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanSell(user);
    if (!user.companyId) {
      throw new ForbiddenException(
        'Your account is not linked to a company — cannot create a material listing',
      );
    }
    // Force supplierId to the authenticated company — never trust client-provided value
    return this.materialsService.create({ ...createMaterialDto, supplierId: user.companyId });
  }

  @Get()
  findAll(@Query() query: QueryMaterialsDto) {
    return this.materialsService.findAll(query);
  }

  @Get('categories')
  getCategories() {
    return this.materialsService.getCategories();
  }

  @Get('search')
  search(@Query() query: SearchMaterialsDto) {
    return this.materialsService.search(query.q);
  }

  /**
   * Hybrid marketplace: instant supplier offers for a material category.
   * GET /materials/offers?category=SAND&quantity=10&lat=56.9&lng=24.1
   */
  @Get('offers')
  getOffers(@Query() query: GetOffersDto) {
    return this.materialsService.getOffers(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMaterialDto: UpdateMaterialDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanSell(user);
    return this.materialsService.update(id, updateMaterialDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    assertCanSell(user);
    return this.materialsService.remove(id, user);
  }

  /** GET /materials/:id/tiers — public, returns all volume price tiers */
  @Get(':id/tiers')
  getTiers(@Param('id') id: string) {
    return this.materialsService.getTiers(id);
  }

  /**
   * PUT /materials/:id/tiers — replace all price tiers for a material.
   * Body: [{ minQty: number, unitPrice: number }, ...]
   * Use an empty array to clear all tiers (revert to flat basePrice).
   */
  @Put(':id/tiers')
  setTiers(
    @Param('id') id: string,
    @Body() tiers: { minQty: number; unitPrice: number }[],
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanSell(user);
    return this.materialsService.setTiers(id, tiers, user);
  }

  /**
   * POST /materials/:id/upload-image
   * Upload a product photo (base64-encoded) to Supabase Storage.
   * Returns the updated images array for the material.
   * Body: { base64: string; mimeType: 'image/jpeg' | 'image/png' }
   */
  @Post(':id/upload-image')
  uploadImage(
    @Param('id') id: string,
    @Body() dto: UploadMaterialImageDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanSell(user);
    return this.materialsService.uploadMaterialImage(id, dto.base64, dto.mimeType, user);
  }
}
