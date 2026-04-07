/**
 * Skip-hire controller — /api/v1/skip-hire
 * Endpoints for browsing skips, creating hire bookings, updating booking status,
 * and managing carrier-side skip inventory.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipHireService } from './skip-hire.service';
import { CreateSkipHireDto } from './dto/create-skip-hire.dto';
import { GetQuotesQueryDto } from './dto/get-quotes-query.dto';
import { UpdateSkipHireStatusDto } from './dto/update-skip-hire-status.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { SkipHireStatus } from '@prisma/client';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Skip Hire')
@Controller('skip-hire')
export class SkipHireController {
  constructor(private readonly skipHireService: SkipHireService) {}

  /**
   * GET /api/v1/skip-hire/market-prices
   * Public — returns the minimum price per skip size across verified carriers.
   * Used by the frontend to display indicative "from €X" prices in step 1.
   */
  @Get('market-prices')
  getMarketPrices() {
    return this.skipHireService.getMarketPrices();
  }

  /**
   * GET /api/v1/skip-hire/quotes
   * Public — returns carrier offers for the given size, location, date.
   */
  @Get('quotes')
  getQuotes(@Query() query: GetQuotesQueryDto) {
    return this.skipHireService.getQuotes(
      query.size,
      query.location,
      query.date,
    );
  }

  /**
   * POST /api/v1/skip-hire
   * Public endpoint — anyone can place a skip hire order.
   * If the request carries a valid JWT the order will be linked to that user.
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateSkipHireDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    // Attach user id if logged in (optional JWT)
    const userId: string | undefined = req.user?.userId;
    return this.skipHireService.create(dto, userId);
  }

  /**
   * GET /api/v1/skip-hire
   * Protected — admins see all orders; regular users see only their own.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Request() req: Express.Request & { user: RequestingUser },
    @Query('status') status?: SkipHireStatus,
  ) {
    const isAdmin = req.user?.userType === 'ADMIN';
    return this.skipHireService.findAll(req.user.userId, isAdmin, status);
  }

  /**
   * GET /api/v1/skip-hire/my
   * Returns orders for the currently authenticated user.
   */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMine(@Request() req: Express.Request & { user: RequestingUser }) {
    return this.skipHireService.findByUser(req.user.userId);
  }

  /**
   * GET /api/v1/skip-hire/number/:orderNumber
   * Lookup by the human-readable order number (e.g. SKP2602000001).
   * Requires authentication — order data contains PII (contact name/email/phone).
   */
  @Get('number/:orderNumber')
  @UseGuards(JwtAuthGuard)
  findByNumber(
    @Param('orderNumber') orderNumber: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.skipHireService.findByOrderNumber(orderNumber, req.user);
  }

  /**
   * GET /api/v1/skip-hire/carrier-map
   * Returns all active (CONFIRMED + DELIVERED) skip orders for the requesting
   * user's carrier company — used by the skip driver fleet map.
   */
  @Get('carrier-map')
  @UseGuards(JwtAuthGuard)
  getCarrierMap(@Request() req: Express.Request & { user: RequestingUser }) {
    return this.skipHireService.getCarrierMapSkips(req.user.userId);
  }

  /**
   * GET /api/v1/skip-hire/:id
   * Protected — must be owner or admin.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    const isAdmin = req.user?.userType === 'ADMIN';
    return this.skipHireService.findOne(id, req.user.userId, isAdmin);
  }

  /**
   * PATCH /api/v1/skip-hire/:id/carrier-status
   * Carriers update delivery progress for their own skip orders.
   * Allowed: CONFIRMED → DELIVERED, DELIVERED → COLLECTED
   */
  @Patch(':id/carrier-status')
  @UseGuards(JwtAuthGuard)
  updateCarrierStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSkipHireStatusDto,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.skipHireService.updateCarrierStatus(
      id,
      dto.status,
      req.user.userId,
    );
  }

  /**
   * PATCH /api/v1/skip-hire/:id/status
   * Update the lifecycle status (admin only).
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSkipHireStatusDto) {
    return this.skipHireService.updateStatus(id, dto);
  }

  /**
   * POST /api/v1/skip-hire/:id/cancel
   * Owner or admin can cancel.
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @Param('id') id: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    const isAdmin = req.user?.userType === 'ADMIN';
    return this.skipHireService.cancel(id, req.user.userId, isAdmin);
  }
}
