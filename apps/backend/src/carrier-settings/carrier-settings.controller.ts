/**
 * Carrier settings controller — /api/v1/carrier-settings
 * Carrier-only endpoints to read and update transport pricing configuration.
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SkipSize } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CarrierSettingsService } from './carrier-settings.service';
import { BlockDateDto } from './dto/block-date.dto';
import { CreateZoneDto } from './dto/create-zone.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { SetRadiusDto } from './dto/set-radius.dto';

/** Asserts the caller is an approved carrier (canSkipHire or canTransport). */
function assertIsCarrier(user: RequestingUser): void {
  if (!user.canSkipHire && !user.canTransport) {
    throw new ForbiddenException(
      'Only approved carriers can access carrier settings',
    );
  }
}

@Controller('carrier-settings')
@UseGuards(JwtAuthGuard)
export class CarrierSettingsController {
  constructor(private readonly service: CarrierSettingsService) {}

  // ── Pricing ──────────────────────────────────────────────────────────────

  /** GET /api/v1/carrier-settings/pricing — list my pricing table */
  @Get('pricing')
  getPricing(@Request() req: Express.Request & { user: RequestingUser }) {
    assertIsCarrier(req.user);
    return this.service.getPricing(req.user.userId);
  }

  /** PUT /api/v1/carrier-settings/pricing/:size — set/update price for a skip size */
  @Put('pricing/:size')
  setPrice(
    @Param('size') size: SkipSize,
    @Body() dto: SetPriceDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.setPrice(req.user.userId, size, dto.price);
  }

  /** DELETE /api/v1/carrier-settings/pricing/:size — remove price for a skip size */
  @Delete('pricing/:size')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePrice(
    @Param('size') size: SkipSize,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.deletePrice(req.user.userId, size);
  }

  // ── Service zones ─────────────────────────────────────────────────────────

  /** GET /api/v1/carrier-settings/zones — list my service zones */
  @Get('zones')
  getZones(@Request() req: Express.Request & { user: RequestingUser }) {
    assertIsCarrier(req.user);
    return this.service.getZones(req.user.userId);
  }

  /** POST /api/v1/carrier-settings/zones — add a service zone */
  @Post('zones')
  @HttpCode(HttpStatus.CREATED)
  addZone(
    @Body() dto: CreateZoneDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.addZone(req.user.userId, dto);
  }

  /** DELETE /api/v1/carrier-settings/zones/:id — remove a service zone */
  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeZone(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.removeZone(req.user.userId, id);
  }

  // ── Availability ──────────────────────────────────────────────────────────

  /** GET /api/v1/carrier-settings/availability — list my blocked dates */
  @Get('availability')
  getBlocked(@Request() req: Express.Request & { user: RequestingUser }) {
    assertIsCarrier(req.user);
    return this.service.getBlocked(req.user.userId);
  }

  /** POST /api/v1/carrier-settings/availability — block a date */
  @Post('availability')
  @HttpCode(HttpStatus.CREATED)
  blockDate(
    @Body() dto: BlockDateDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.blockDate(req.user.userId, dto);
  }

  /** DELETE /api/v1/carrier-settings/availability/:id — unblock a date */
  @Delete('availability/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblockDate(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.unblockDate(req.user.userId, id);
  }

  // ── Radius ───────────────────────────────────────────────────────────────

  /** GET /api/v1/carrier-settings/radius — get my service radius */
  @Get('radius')
  getRadius(@Request() req: Express.Request & { user: RequestingUser }) {
    assertIsCarrier(req.user);
    return this.service.getRadius(req.user.userId);
  }

  /** PUT /api/v1/carrier-settings/radius — update my service radius */
  @Put('radius')
  setRadius(
    @Body() dto: SetRadiusDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    assertIsCarrier(req.user);
    return this.service.setRadius(req.user.userId, dto.radiusKm);
  }
}
