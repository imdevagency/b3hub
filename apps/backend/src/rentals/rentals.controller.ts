import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseFloatPipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { CreateRentalOrderDto } from './dto/create-rental-order.dto';
import { UpdateRentalStatusDto } from './dto/update-rental-order.dto';
import { CreateRentalListingDto } from './dto/create-rental-listing.dto';
import { UpdateRentalListingDto } from './dto/update-rental-listing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { RentalServiceType } from '@prisma/client';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  // ── Listings: public browse ───────────────────────────────────────────────

  @Get('listings')
  findListings(
    @Query('serviceType') serviceType?: RentalServiceType,
    @Query('city') city?: string,
    @Query('lat') latStr?: string,
    @Query('lng') lngStr?: string,
  ) {
    const lat = latStr !== undefined ? parseFloat(latStr) : undefined;
    const lng = lngStr !== undefined ? parseFloat(lngStr) : undefined;
    return this.rentalsService.findListings(serviceType, city, lat, lng);
  }

  @Get('listings/my')
  @UseGuards(JwtAuthGuard)
  myListings(@CurrentUser() user: RequestingUser) {
    if (!user.companyId) return [];
    return this.rentalsService.findProviderListings(user.companyId);
  }

  @Get('listings/:id')
  findListing(@Param('id') id: string) {
    return this.rentalsService.findListing(id);
  }

  /** Public — calendar availability (blocked + fully-booked dates) */
  @Get('listings/:id/availability')
  getAvailability(@Param('id') id: string) {
    return this.rentalsService.getListingAvailability(id);
  }

  /** Public — check delivery radius for a lat/lng before address step proceeds */
  @Get('listings/:id/radius-check')
  checkRadius(
    @Param('id') id: string,
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
  ) {
    return this.rentalsService.checkDeliveryRadius(id, lat, lng);
  }

  /**
   * Public — compute a live price estimate for the booking widget.
   * POST body: { hireDays, selectedAddOnIds?, insurancePlanId?, lat?, lng? }
   */
  @Post('listings/:id/price-estimate')
  priceEstimate(
    @Param('id') id: string,
    @Body() body: {
      hireDays: number;
      selectedAddOnIds?: string[];
      insurancePlanId?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    return this.rentalsService.computePriceEstimate(
      id,
      body.hireDays,
      body.selectedAddOnIds ?? [],
      body.insurancePlanId,
      body.lat,
      body.lng,
    );
  }

  /** Provider — replace blocked dates */
  @UseGuards(JwtAuthGuard)
  @Patch('listings/:id/blocked-dates')
  setBlockedDates(
    @Param('id') id: string,
    @Body() body: { dates: string[] },
    @CurrentUser() user: RequestingUser,
  ) {
    if (!user.canRent || !user.companyId) {
      throw new ForbiddenException('Only approved rental providers can manage availability');
    }
    return this.rentalsService.setBlockedDates(id, user.companyId, body.dates ?? []);
  }

  // ── Listings: provider CRUD ───────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('listings')
  createListing(@Body() dto: CreateRentalListingDto, @CurrentUser() user: RequestingUser) {
    if (!user.canRent || !user.companyId) {
      throw new ForbiddenException('Only approved rental providers can create listings');
    }
    return this.rentalsService.createListing(dto, user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('listings/:id')
  updateListing(
    @Param('id') id: string,
    @Body() dto: UpdateRentalListingDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!user.canRent || !user.companyId) {
      throw new ForbiddenException('Only approved rental providers can update listings');
    }
    return this.rentalsService.updateListing(id, dto, user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('listings/:id')
  deleteListing(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (!user.canRent || !user.companyId) {
      throw new ForbiddenException('Only approved rental providers can delete listings');
    }
    return this.rentalsService.deleteListing(id, user.companyId);
  }

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

  // ── Admin: list all orders ────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('all')
  allOrders(
    @CurrentUser() user: RequestingUser,
    @Query('serviceType') serviceType?: RentalServiceType,
    @Query('status') status?: string,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.rentalsService.findAllOrders(serviceType, status);
  }

  // ── Provider: list orders for their listings ──────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('provider')
  providerOrders(
    @CurrentUser() user: RequestingUser,
    @Query('serviceType') serviceType?: RentalServiceType,
  ) {
    if (!user.canRent || !user.companyId) throw new ForbiddenException('Rental providers only');
    return this.rentalsService.findProviderOrders(user.companyId, serviceType);
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
