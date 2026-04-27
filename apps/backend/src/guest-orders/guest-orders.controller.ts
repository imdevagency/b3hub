/**
 * GuestOrdersController — /api/v1/guest-orders
 *
 * Public endpoints (no auth):
 *   POST   /guest-orders                        Submit a new guest order
 *   GET    /guest-orders/track/:token           Public tracking page data
 *   POST   /guest-orders/:id/payment-intent     Initiate card checkout (requires quoted price)
 *
 * Admin endpoints (JWT + ADMIN userType):
 *   GET    /guest-orders                        List all guest orders
 *   GET    /guest-orders/:id                    Get single guest order
 *   PATCH  /guest-orders/:id/status             Update status
 *   PATCH  /guest-orders/:id/quote              Set quoted price (before sending payment link)
 *
 * Internal endpoint (JWT):
 *   POST   /guest-orders/:token/convert         Link guest order to real order on registration
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { GuestOrderStatus } from '@prisma/client';
import { GuestOrdersService } from './guest-orders.service';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { Throttle } from '@nestjs/throttler';

class UpdateGuestStatusDto {
  @IsEnum(GuestOrderStatus)
  status: GuestOrderStatus;
}

class ConvertGuestOrderDto {
  @IsString()
  newOrderId: string;
}

class SetGuestQuoteDto {
  @IsNumber()
  @Min(0.01)
  quotedAmount: number;

  @IsString()
  @IsOptional()
  quotedCurrency?: string;
}

@ApiTags('Guest Orders')
@Controller('guest-orders')
@UseGuards(JwtAuthGuard)
export class GuestOrdersController {
  constructor(private readonly service: GuestOrdersService) {}

  // ── Public: submit a guest order ─────────────────────────────────────────

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 per minute per IP — anti-spam
  async create(@Body() dto: CreateGuestOrderDto) {
    return this.service.create(dto);
  }

  // ── Public: track by token ────────────────────────────────────────────────

  @Public()
  @Get('track/:token')
  async track(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  // ── Admin: list all guest orders ──────────────────────────────────────────

  @Get()
  async findAll(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: GuestOrderStatus,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.service.findAll(status);
  }

  // ── Admin: get one ────────────────────────────────────────────────────────

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.service.findOne(id);
  }

  // ── Admin: update status ──────────────────────────────────────────────────

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGuestStatusDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.service.updateStatus(id, dto.status);
  }

  // ── Admin: set quoted price ───────────────────────────────────────────────

  @Patch(':id/quote')
  async setQuote(
    @Param('id') id: string,
    @Body() dto: SetGuestQuoteDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return this.service.setQuote(id, dto.quotedAmount, dto.quotedCurrency);
  }

  // ── Public: guest card checkout ───────────────────────────────────────────

  @Public()
  @Post(':id/payment-intent')
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 per minute per IP — anti-abuse
  async createPaymentIntent(@Param('id') id: string) {
    return this.service.createPaymentIntent(id);
  }

  // ── Authenticated: convert guest order → real order ───────────────────────

  @Post(':token/convert')
  async convert(
    @Param('token') token: string,
    @Body() dto: ConvertGuestOrderDto,
  ) {
    return this.service.convertToOrder(token, dto.newOrderId);
  }
}
