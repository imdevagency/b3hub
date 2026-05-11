/**
 * Supplier Locations controller — /api/v1/supplier-locations
 * Authenticated endpoints for suppliers to manage their quarry / loading sites.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupplierLocationsService } from './supplier-locations.service';
import { CreateSupplierLocationDto } from './dto/create-supplier-location.dto';
import { UpdateSupplierLocationDto } from './dto/update-supplier-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ApiTags } from '@nestjs/swagger';

function assertCanManage(user: RequestingUser) {
  if (!user.canSell && user.userType !== 'ADMIN') {
    throw new ForbiddenException('Only approved sellers can manage supplier locations');
  }
  if (!user.companyId) {
    throw new ForbiddenException('Account is not linked to a company');
  }
}

@ApiTags('Supplier Locations')
@Controller('supplier-locations')
@UseGuards(JwtAuthGuard)
export class SupplierLocationsController {
  constructor(private readonly service: SupplierLocationsService) {}

  /** List all active locations for the authenticated supplier's company */
  @Get('mine')
  findMine(@CurrentUser() user: RequestingUser) {
    assertCanManage(user);
    return this.service.findByCompany(user.companyId!);
  }

  @Post()
  create(
    @Body() dto: CreateSupplierLocationDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanManage(user);
    return this.service.create(user.companyId!, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierLocationDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanManage(user);
    return this.service.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    assertCanManage(user);
    return this.service.remove(id, user.companyId!);
  }
}
