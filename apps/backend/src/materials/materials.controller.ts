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
} from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

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
    return this.materialsService.create(createMaterialDto);
  }

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('supplierId') supplierId?: string,
    @Query('isRecycled') isRecycled?: string,
  ) {
    return this.materialsService.findAll({
      category: category as any,
      supplierId,
      isRecycled: isRecycled === 'true',
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
}
