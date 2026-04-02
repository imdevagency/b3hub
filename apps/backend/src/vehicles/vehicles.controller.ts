/**
 * Vehicles controller — /api/v1/vehicles
 * Carrier-only endpoints to register, update, list, and delete fleet vehicles.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  /**
   * POST /api/v1/vehicles
   * Add a new vehicle to the user's fleet.
   * Company DRIVER and MEMBER roles cannot register vehicles — fleet management
   * is the responsibility of company OWNER / MANAGER.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateVehicleDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    if (!req.user.canTransport && req.user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only approved transport operators can register vehicles');
    }
    const role = req.user.companyRole;
    if (req.user.isCompany && (role === 'DRIVER' || role === 'MEMBER')) {
      throw new ForbiddenException(
        'Company drivers and members cannot add vehicles. Contact your fleet manager.',
      );
    }
    return this.vehiclesService.create(dto, req.user.userId);
  }

  /**
   * GET /api/v1/vehicles
   * Returns all vehicles owned by the current user (or their company).
   */
  @Get()
  findAll(@Request() req: Express.Request & { user: RequestingUser }) {
    if (!req.user.canTransport && req.user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only approved transport operators can view vehicles');
    }
    return this.vehiclesService.findMine(req.user.userId);
  }

  /**
   * GET /api/v1/vehicles/count
   * Returns vehicle count for dashboard stats.
   */
  @Get('count')
  count(@Request() req: Express.Request & { user: RequestingUser }) {
    if (!req.user.canTransport && req.user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only approved transport operators can view vehicle counts');
    }
    return this.vehiclesService
      .countMine(req.user.userId)
      .then((count) => ({ count }));
  }

  /**
   * GET /api/v1/vehicles/:id
   * Get single vehicle (must be owner or same company).
   */
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    if (!req.user.canTransport && req.user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only approved transport operators can view vehicles');
    }
    return this.vehiclesService.findOne(id, req.user.userId);
  }

  /**
   * PATCH /api/v1/vehicles/:id
   * Update vehicle details.
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    if (!req.user.canTransport && req.user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only approved transport operators can update vehicles');
    }
    const role = req.user.companyRole;
    if (req.user.isCompany && (role === 'DRIVER' || role === 'MEMBER')) {
      throw new ForbiddenException(
        'Company drivers and members cannot modify vehicles. Contact your fleet manager.',
      );
    }
    return this.vehiclesService.update(id, dto, req.user.userId);
  }

  /**
   * DELETE /api/v1/vehicles/:id
   * Remove a vehicle from the fleet.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    if (!req.user.canTransport && req.user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only approved transport operators can remove vehicles');
    }
    const role = req.user.companyRole;
    if (req.user.isCompany && (role === 'DRIVER' || role === 'MEMBER')) {
      throw new ForbiddenException(
        'Company drivers and members cannot remove vehicles. Contact your fleet manager.',
      );
    }
    return this.vehiclesService.remove(id, req.user.userId);
  }
}
