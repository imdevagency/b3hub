/**
 * Equipment controller — /api/v1/equipment
 * Admin-only CRUD for the group-wide machinery registry.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { EquipmentStatus, BuContext } from '@prisma/client';

@ApiTags('Equipment')
@Controller('equipment')
@UseGuards(JwtAuthGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  /** GET /api/v1/equipment?status=ACTIVE&buContext=CONSTRUCTION */
  @Get()
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: EquipmentStatus,
    @Query('buContext') buContext?: BuContext,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.equipmentService.findAll({ status, buContext });
  }

  /** GET /api/v1/equipment/:id */
  @Get(':id')
  findOne(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.equipmentService.findOne(id);
  }

  /** POST /api/v1/equipment */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestingUser,
    @Body() dto: CreateEquipmentDto,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.equipmentService.create(dto);
  }

  /** PATCH /api/v1/equipment/:id */
  @Patch(':id')
  update(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.equipmentService.update(id, dto);
  }

  /** DELETE /api/v1/equipment/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.equipmentService.remove(id);
  }
}
