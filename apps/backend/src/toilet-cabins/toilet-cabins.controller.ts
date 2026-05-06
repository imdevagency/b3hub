/**
 * Toilet Cabin Rental controller — /api/v1/toilet-cabins
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ToiletCabinsService } from './toilet-cabins.service';
import type { SetToiletCabinSettingsDto } from './toilet-cabins.service';
import { CreateToiletCabinDto } from './dto/create-toilet-cabin.dto';
import { UpdateToiletCabinStatusDto } from './dto/update-toilet-cabin-status.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ToiletCabinStatus } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Toilet Cabins')
@Controller('toilet-cabins')
export class ToiletCabinsController {
  constructor(private readonly toiletCabinsService: ToiletCabinsService) {}

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/toilet-cabins/quotes?city=&cabins=&hireDays=
   * Public — returns verified carriers available in the city, sorted by price.
   */
  @Get('quotes')
  getQuotes(
    @Query('city') city: string,
    @Query('cabins') cabins: string,
    @Query('hireDays') hireDays: string,
  ) {
    return this.toiletCabinsService.getQuotes(
      city ?? '',
      parseInt(cabins ?? '1', 10),
      parseInt(hireDays ?? '1', 10),
    );
  }

  // ── BUYER ─────────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/toilet-cabins
   * Public — anyone can place a toilet cabin hire order.
   * If a valid JWT is present the order is linked to that user.
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateToiletCabinDto,
    @Request() req: Express.Request & { user?: RequestingUser },
  ) {
    const userId: string | undefined = req.user?.userId;
    return this.toiletCabinsService.create(dto, userId);
  }

  /**
   * GET /api/v1/toilet-cabins
   * Protected — admins see all orders; users see their own.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Request() req: Express.Request & { user: RequestingUser },
    @Query('status') status?: ToiletCabinStatus,
  ) {
    return this.toiletCabinsService.findAll(req.user, status);
  }

  /**
   * GET /api/v1/toilet-cabins/:id
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.toiletCabinsService.findOne(id, req.user);
  }

  /**
   * PATCH /api/v1/toilet-cabins/:id/status
   * Admin-only: set arbitrary status.
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateToiletCabinStatusDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.toiletCabinsService.updateStatus(id, dto, req.user);
  }

  // ── CARRIER ───────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/toilet-cabins/carrier/orders
   * Carrier: list their assigned toilet cabin orders.
   */
  @Get('carrier/orders')
  @UseGuards(JwtAuthGuard)
  getCarrierOrders(
    @Request() req: Express.Request & { user: RequestingUser },
    @Query('status') status?: ToiletCabinStatus,
  ) {
    return this.toiletCabinsService.findCarrierOrders(req.user.userId, status);
  }

  /**
   * PATCH /api/v1/toilet-cabins/:id/carrier-status
   * Carrier: advance delivery lifecycle (CONFIRMED → DELIVERED → IN_USE → COLLECTED).
   */
  @Patch(':id/carrier-status')
  @UseGuards(JwtAuthGuard)
  updateCarrierStatus(
    @Param('id') id: string,
    @Body('status') status: ToiletCabinStatus,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.toiletCabinsService.updateCarrierStatus(id, status, req.user.userId);
  }

  /**
   * GET /api/v1/toilet-cabins/carrier/settings
   * Carrier: get own toilet cabin pricing & service configuration.
   */
  @Get('carrier/settings')
  @UseGuards(JwtAuthGuard)
  getCarrierSettings(@Request() req: Express.Request & { user: RequestingUser }) {
    return this.toiletCabinsService.getCarrierSettings(req.user.userId);
  }

  /**
   * PUT /api/v1/toilet-cabins/carrier/settings
   * Carrier: create or update toilet cabin pricing & service configuration.
   */
  @Put('carrier/settings')
  @UseGuards(JwtAuthGuard)
  upsertCarrierSettings(
    @Body() dto: SetToiletCabinSettingsDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.toiletCabinsService.upsertCarrierSettings(req.user.userId, dto);
  }
}
