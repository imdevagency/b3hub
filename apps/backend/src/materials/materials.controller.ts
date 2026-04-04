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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { MaterialCategory } from '@prisma/client';

/** Checks that the authenticated user has canSell=true (or is ADMIN) */
function assertCanSell(user: RequestingUser) {
  if (!user.canSell && user.userType !== 'ADMIN') {
    throw new ForbiddenException('Only approved sellers can manage materials');
  }
}

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
  findAll(
    @Query('category') category?: string,
    @Query('supplierId') supplierId?: string,
    @Query('isRecycled') isRecycled?: string,
    @Query('inStock') inStock?: string,
    @Query('search') search?: string,
    @Query('priceMax') priceMax?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.materialsService.findAll({
      category: category as MaterialCategory | undefined,
      supplierId,
      isRecycled: isRecycled === 'true' ? true : isRecycled === 'false' ? false : undefined,
      inStock: inStock === 'true' ? true : undefined,
      search,
      priceMax: priceMax != null ? Number(priceMax) : undefined,
      limit: limit != null ? Number(limit) : undefined,
      skip: skip != null ? Number(skip) : undefined,
    });
  }

  @Get('categories')
  getCategories() {
    return this.materialsService.getCategories();
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.materialsService.search(query);
  }

  /**
   * Hybrid marketplace: instant supplier offers for a material category.
   * GET /materials/offers?category=SAND&quantity=10&lat=56.9&lng=24.1
   */
  @Get('offers')
  getOffers(
    @Query('category') category: string,
    @Query('quantity') quantity: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.materialsService.getOffers({
      category,
      quantity: parseFloat(quantity ?? '1'),
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    });
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
}
