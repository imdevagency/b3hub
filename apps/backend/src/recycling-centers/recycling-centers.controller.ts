/**
 * Recycling centers controller — /api/v1/recycling-centers
 * Public listing and authenticated management of recycling center profiles.
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { RecyclingCentersService } from './recycling-centers.service';
import { CreateRecyclingCenterDto } from './dto/create-recycling-center.dto';
import { UpdateRecyclingCenterDto } from './dto/update-recycling-center.dto';
import { QueryRecyclingCentersDto } from './dto/query-recycling-centers.dto';
import { CreateWasteRecordDto } from './dto/create-waste-record.dto';
import { UpdateWasteRecordDto } from './dto/update-waste-record.dto';
import { UpsertPricingRuleDto } from './dto/upsert-pricing-rule.dto';
import { DisposalQuoteQueryDto } from './dto/disposal-quote-query.dto';

/** Asserts caller is an approved carrier or recycler operator. */
function assertIsCarrierOp(user: RequestingUser): void {
  if (!user.canSkipHire && !user.canTransport && !user.canRecycle) {
    throw new ForbiddenException(
      'Only approved carriers or recycling operators can manage recycling centers',
    );
  }
}

/** Asserts caller is an approved recycling operator. */
function assertIsRecycler(user: RequestingUser): void {
  if (!user.canRecycle) {
    throw new ForbiddenException(
      'Only approved recycling operators can access this endpoint',
    );
  }
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Recycling Centers')
@Controller('recycling-centers')
@UseGuards(JwtAuthGuard)
export class RecyclingCentersController {
  constructor(private readonly service: RecyclingCentersService) {}

  // ── Centers ───────────────────────────────────────────────────────────────

  /** POST /recycling-centers — carrier registers a recycling center */
  @Post()
  create(
    @Body() dto: CreateRecyclingCenterDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsCarrierOp(user);
    if (!user.companyId) {
      throw new ForbiddenException(
        'A linked company is required to create a recycling center',
      );
    }
    return this.service.create(dto, user.companyId);
  }

  /** GET /recycling-centers — public list with optional filters */
  @Get()
  findAll(@Query() query: QueryRecyclingCentersDto) {
    return this.service.findAll(query);
  }

  /** GET /recycling-centers/mine — carrier's own centers */
  @Get('mine')
  findMine(@CurrentUser() user: RequestingUser) {
    assertIsCarrierOp(user);
    if (!user.companyId) {
      throw new ForbiddenException('A linked company is required');
    }
    return this.service.findMine(user.companyId);
  }

  /** GET /recycling-centers/disposal/mine — buyer's disposal records */
  @Get('disposal/mine')
  getMyDisposalRecords(@CurrentUser() user: RequestingUser) {
    return this.service.getMyDisposalRecords(user.userId);
  }

  /** GET /recycling-centers/sustainability/stats — buyer's aggregate sustainability stats */
  @Get('sustainability/stats')
  getMySustainabilityStats(@CurrentUser() user: RequestingUser) {
    return this.service.getMySustainabilityStats(user.userId);
  }

  /** GET /recycling-centers/mine-incoming-jobs — disposal transport jobs heading to this operator's centers */
  @Get('mine-incoming-jobs')
  getIncomingJobs(@CurrentUser() user: RequestingUser) {
    assertIsRecycler(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.getIncomingJobs(user.companyId);
  }

  /** GET /recycling-centers/waste-records/mine — all waste records for this operator */
  @Get('waste-records/mine')
  getMyWasteRecords(@CurrentUser() user: RequestingUser) {
    assertIsRecycler(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.getMyWasteRecords(user.companyId);
  }

  /** GET /recycling-centers/:id — center detail */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** PATCH /recycling-centers/:id — carrier updates their center */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRecyclingCenterDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsCarrierOp(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.update(id, dto, user.companyId);
  }

  /** DELETE /recycling-centers/:id — carrier deactivates their center */
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    assertIsCarrierOp(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.deactivate(id, user.companyId);
  }

  // ── Waste Records ─────────────────────────────────────────────────────────

  /** POST /recycling-centers/:centerId/waste-records — log a waste delivery */
  @Post(':centerId/waste-records')
  createWasteRecord(
    @Param('centerId') centerId: string,
    @Body() dto: CreateWasteRecordDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsCarrierOp(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.createWasteRecord(centerId, dto, user.companyId);
  }

  /** GET /recycling-centers/:centerId/waste-records — center's intake history */
  @Get(':centerId/waste-records')
  getWasteRecords(
    @Param('centerId') centerId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsCarrierOp(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.getWasteRecords(centerId, user.companyId);
  }

  /** PATCH /recycling-centers/:centerId/waste-records/:recordId — update processing / add certificate */
  @Patch(':centerId/waste-records/:recordId')
  updateWasteRecord(
    @Param('centerId') centerId: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateWasteRecordDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsCarrierOp(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.updateWasteRecord(
      centerId,
      recordId,
      dto,
      user.companyId,
    );
  }

  /** POST /recycling-centers/waste-records/:recordId/create-listing — convert processed record to marketplace listing */
  @Post('waste-records/:recordId/create-listing')
  createListingFromWasteRecord(
    @Param('recordId') recordId: string,
    @Body() body: { basePrice: number; name?: string },
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsRecycler(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.createListingFromWasteRecord(recordId, body, user.companyId);
  }

  // ── Disposal Quote (public) ─────────────────────────────────────────────

  /**
   * GET /recycling-centers/disposal-quote
   * Returns available centers with disposal fees for the given waste type + weight.
   * Optional lat/lng for distance-sorted results.
   */
  @Get('disposal-quote')
  getDisposalQuote(@Query() query: DisposalQuoteQueryDto) {
    return this.service.getDisposalQuote(query);
  }

  // ── Pricing Rules (operator) ─────────────────────────────────────────

  /** GET /recycling-centers/:centerId/pricing-rules — list all rules for a center */
  @Get(':centerId/pricing-rules')
  getPricingRules(
    @Param('centerId') centerId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsRecycler(user);
    if (!user.companyId) throw new ForbiddenException('A linked company is required');
    return this.service.getPricingRules(centerId, user.companyId);
  }

  /** PUT /recycling-centers/:centerId/pricing-rules — upsert a pricing rule */
  @Post(':centerId/pricing-rules')
  upsertPricingRule(
    @Param('centerId') centerId: string,
    @Body() dto: UpsertPricingRuleDto,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsRecycler(user);
    if (!user.companyId) throw new ForbiddenException('A linked company is required');
    return this.service.upsertPricingRule(centerId, dto, user.companyId);
  }

  /** DELETE /recycling-centers/:centerId/pricing-rules/:wasteType — remove a pricing rule */
  @Delete(':centerId/pricing-rules/:wasteType')
  deletePricingRule(
    @Param('centerId') centerId: string,
    @Param('wasteType') wasteType: string,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsRecycler(user);
    if (!user.companyId) throw new ForbiddenException('A linked company is required');
    return this.service.deletePricingRule(centerId, wasteType, user.companyId);
  }

  // ── Incoming Job Management ───────────────────────────────────────────────

  /**
   * POST /recycling-centers/:centerId/incoming-jobs/:jobId/cancel
   * Operator cancels an incoming waste delivery they cannot receive.
   * Only allowed while the driver has not yet loaded the cargo.
   */
  @Post(':centerId/incoming-jobs/:jobId/cancel')
  cancelIncomingJob(
    @Param('centerId') centerId: string,
    @Param('jobId') jobId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    assertIsRecycler(user);
    if (!user.companyId)
      throw new ForbiddenException('A linked company is required');
    return this.service.cancelIncomingJob(centerId, jobId, user.companyId);
  }
}
