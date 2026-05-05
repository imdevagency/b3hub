import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BuContext } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { CreateVehicleAssignmentDto } from './dto/create-vehicle-assignment.dto';
import { UpdateVehicleAssignmentDto } from './dto/update-vehicle-assignment.dto';
import { VehicleAssignmentsService } from './vehicle-assignments.service';

@UseGuards(JwtAuthGuard)
@Controller('vehicle-assignments')
export class VehicleAssignmentsController {
  constructor(private readonly service: VehicleAssignmentsService) {}

  private assertAdmin(user: RequestingUser) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
  }

  @Get('fleet-overview')
  getFleetOverview(@CurrentUser() user: RequestingUser) {
    this.assertAdmin(user);
    return this.service.getFleetOverview();
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query('active') active?: string,
    @Query('buContext') buContext?: BuContext,
  ) {
    this.assertAdmin(user);
    return this.service.findAll({
      active: active === 'true',
      buContext,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: RequestingUser,
    @Body() dto: CreateVehicleAssignmentDto,
  ) {
    this.assertAdmin(user);
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleAssignmentDto,
  ) {
    this.assertAdmin(user);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    this.assertAdmin(user);
    return this.service.remove(id);
  }
}
