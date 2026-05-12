import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto';
import { UpdateRentalStatusDto } from './dto/update-rental-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { RentalServiceType } from '@prisma/client';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  // ── Create order (guest or authenticated) ────────────────────────────────

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(@Body() dto: CreateRentalOrderDto, @CurrentUser() user?: RequestingUser) {
    return this.rentalsService.create(dto, user?.userId);
  }

  // ── Buyer: list own orders ────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('my')
  myOrders(
    @CurrentUser() user: RequestingUser,
    @Query('serviceType') serviceType?: RentalServiceType,
  ) {
    return this.rentalsService.findBuyerOrders(user.userId, serviceType);
  }

  // ── Carrier: list assigned orders ────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('carrier')
  carrierOrders(
    @CurrentUser() user: RequestingUser,
    @Query('serviceType') serviceType?: RentalServiceType,
  ) {
    if (!user.companyId) return [];
    return this.rentalsService.findCarrierOrders(user.companyId, serviceType);
  }

  // ── Public: tracking by token ─────────────────────────────────────────────

  @Get('track/:token')
  track(@Param('token') token: string) {
    return this.rentalsService.findByTrackingToken(token);
  }

  // ── Get one order ─────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rentalsService.findOne(id);
  }

  // ── Carrier: update status ────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRentalStatusDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.rentalsService.updateStatus(id, user.companyId!, dto.status);
  }

  // ── Admin: assign carrier ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch(':id/assign/:carrierId')
  assignCarrier(@Param('id') id: string, @Param('carrierId') carrierId: string) {
    return this.rentalsService.assignCarrier(id, carrierId);
  }
}
