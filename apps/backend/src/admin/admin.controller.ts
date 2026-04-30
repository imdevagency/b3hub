/**
 * Admin controller — /api/v1/admin
 * Admin-only endpoints for user management, platform stats,
 * and provider application approval workflow.
 */
import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateConstructionClientDto } from './dto/create-construction-client.dto';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Max,
  Min,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { PagePaginationDto } from '../common/dto/pagination.dto';

class RejectSurchargeDto {
  @IsOptional() @IsString() note?: string;
}

class CancelOrderDto {
  @IsOptional() @IsString() reason?: string;
}

class RefundPaymentDto {
  @IsOptional() @IsString() reason?: string;
}

class ReassignJobDto {
  @IsString() driverId!: string;
  @IsOptional() @IsString() note?: string;
}

class ResolveExceptionDto {
  @IsString() resolution!: string;
}

class BroadcastNotificationDto {
  @IsString() title!: string;
  @IsString() message!: string;
  @IsIn(['ALL', 'BUYERS', 'SELLERS', 'CARRIERS'])
  audience!: 'ALL' | 'BUYERS' | 'SELLERS' | 'CARRIERS';
}

class UpdateCompanyDto {
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsBoolean() payoutEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionRate?: number;
}

class PlatformSettingUpsertDto {
  @IsString() key!: string;
  @IsString() value!: string;
}

class BulkSettingsDto {
  settings!: Record<string, string>;
}

class UpsertSkipSizeDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() labelLv?: string;
  @IsOptional() @IsNumber() volumeM3?: number;
  @IsOptional() @IsString() @IsIn(['SKIP', 'BIG_BAG', 'CONTAINER']) category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() descriptionLv?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) heightPct?: number;
  @IsOptional() @IsNumber() @Min(0) basePrice?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() @Min(0) sortOrder?: number;
}

class UpdateJobRateDto {
  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsNumber() @Min(0) pricePerTonne?: number;
  @IsOptional() @IsString() note?: string;
}

class UpdateMaterialDto {
  @IsBoolean() active!: boolean;
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  /** GET /admin/stats — overview counters */
  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  /** GET /admin/users — all users list */
  @Get('users')
  getUsers(@Query() pagination: PagePaginationDto) {
    return this.service.getUsers(pagination.page ?? 1, pagination.limit ?? 50);
  }

  /** GET /admin/users/:id — user detail */
  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.service.getUserById(id);
  }

  /** PATCH /admin/users/:id — toggle flags / status */
  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.updateUser(id, body, admin.userId);
  }

  /** GET /admin/orders — all orders (paginated) */
  @Get('orders')
  getOrders(@Query() pagination: PagePaginationDto) {
    return this.service.getOrders(pagination.page ?? 1, pagination.limit ?? 50);
  }

  /** GET /admin/orders/:id — order detail */
  @Get('orders/:id')
  getOrderById(@Param('id') id: string) {
    return this.service.getOrderById(id);
  }

  /** GET /admin/jobs — all transport jobs (paginated) */
  @Get('jobs')
  getTransportJobs(@Query() pagination: PagePaginationDto) {
    return this.service.getTransportJobs(
      pagination.page ?? 1,
      pagination.limit ?? 50,
    );
  }

  /** GET /admin/jobs/:id — transport job detail */
  @Get('jobs/:id')
  getTransportJobById(@Param('id') id: string) {
    return this.service.getTransportJobById(id);
  }

  /** GET /admin/companies — all companies */
  @Get('companies')
  getCompanies() {
    return this.service.getCompanies();
  }

  /** GET /admin/companies/:id — company detail */
  @Get('companies/:id')
  getCompanyById(@Param('id') id: string) {
    return this.service.getCompanyById(id);
  }

  /** PATCH /admin/companies/:id — update company flags */
  @Patch('companies/:id')
  updateCompany(
    @Param('id') id: string,
    @Body() body: UpdateCompanyDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.updateCompany(id, body, admin.userId);
  }

  /** GET /admin/audit-logs — recent admin mutations for compliance review */
  @Get('audit-logs')
  getAuditLogs(@Query('limit') limit?: string) {
    return this.service.getAuditLogs(
      limit ? Math.min(Number(limit), 500) : 200,
    );
  }

  /**
   * PATCH /admin/jobs/:id/rate
   * Override the rate on an in-flight transport job.
   * Audit-logged. Blocked for COMPLETED / CANCELLED jobs.
   */
  @Patch('jobs/:id/rate')
  updateJobRate(
    @Param('id') id: string,
    @Body() body: UpdateJobRateDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.updateJobRate(id, body, admin.userId);
  }

  /** GET /admin/materials — all material listings */
  @Get('materials')
  getMaterials() {
    return this.service.getMaterials();
  }

  /** PATCH /admin/materials/:id — toggle active flag */
  @Patch('materials/:id')
  setMaterialActive(
    @Param('id') id: string,
    @Body() body: UpdateMaterialDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.setMaterialActive(id, body.active, admin.userId);
  }

  /** GET /admin/payments — full payment pipeline (last 500) */
  @Get('payments')
  getPaymentQueue() {
    return this.service.getPaymentQueue();
  }

  /**
   * PATCH /admin/payments/:id/release
   * Manually trigger fund release for a captured payment that wasn't auto-released.
   */
  @Patch('payments/:id/release')
  releasePayment(
    @Param('id') id: string,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.releasePayment(id, admin.userId);
  }

  /** GET /admin/sla — orders breaching SLA thresholds (PENDING >4h, CONFIRMED >24h) */
  @Get('sla')
  getSlaOrders() {
    return this.service.getSlaOrders();
  }

  /** GET /admin/supplier-performance — per-supplier metrics for quality control */
  @Get('supplier-performance')
  getSupplierPerformance() {
    return this.service.getSupplierPerformance();
  }

  /** GET /admin/surcharges — surcharges pending admin approval */
  @Get('surcharges')
  getPendingSurcharges() {
    return this.service.getPendingSurcharges();
  }

  /** PATCH /admin/surcharges/:id/approve */
  @Patch('surcharges/:id/approve')
  approveSurcharge(
    @Param('id') id: string,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.approveSurcharge(id, admin.userId);
  }

  /** PATCH /admin/surcharges/:id/reject */
  @Patch('surcharges/:id/reject')
  rejectSurcharge(
    @Param('id') id: string,
    @Body() body: RejectSurchargeDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.rejectSurcharge(id, body.note ?? '', admin.userId);
  }

  // ── Operational response tools ────────────────────────────────────────────

  /**
   * POST /admin/orders/:id/cancel
   * Force-cancel an order and void/refund its payment.
   */
  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(
    @Param('id') id: string,
    @Body() body: CancelOrderDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.cancelOrder(id, body.reason ?? 'Admin force-cancel', admin.userId);
  }

  /**
   * POST /admin/payments/:id/refund
   * Issue a full refund for a CAPTURED or PAID payment.
   */
  @Post('payments/:id/refund')
  @HttpCode(HttpStatus.OK)
  refundPayment(
    @Param('id') id: string,
    @Body() body: RefundPaymentDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.refundPayment(id, body.reason ?? 'Admin manual refund', admin.userId);
  }

  /**
   * PATCH /admin/jobs/:id/reassign
   * Force-reassign a transport job to a different driver.
   */
  @Patch('jobs/:id/reassign')
  reassignJob(
    @Param('id') id: string,
    @Body() body: ReassignJobDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.reassignJob(id, body.driverId, admin.userId, body.note);
  }

  /**
   * PATCH /admin/jobs/:id/force-status
   * Override a transport job's status — for stuck jobs or dispute resolution.
   */
  @Patch('jobs/:id/force-status')
  forceJobStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.forceJobStatus(
      id,
      body.status,
      body.reason ?? 'Admin force status override',
      admin.userId,
    );
  }

  /**
   * PATCH /admin/orders/:id/status
   * Force an order into a specific status — resolving stuck or disputed orders.
   */
  @Patch('orders/:id/status')
  forceOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.forceOrderStatus(
      id,
      body.status,
      body.reason ?? 'Admin force status override',
      admin.userId,
    );
  }

  /** GET /admin/skip-hire — all skip hire orders (paginated) */
  @Get('skip-hire')
  getSkipHireOrders(@Query() pagination: PagePaginationDto) {
    return this.service.getSkipHireOrders(pagination.page ?? 1, pagination.limit ?? 50);
  }

  /**
   * GET /admin/exceptions — all transport job exceptions
   * Query param: ?status=OPEN|RESOLVED|ALL
   */
  @Get('exceptions')
  getExceptions(
    @Query() pagination: PagePaginationDto,
    @Query('status') status?: string,
  ) {
    return this.service.getExceptions(
      pagination.page ?? 1,
      pagination.limit ?? 50,
      status,
    );
  }

  /**
   * PATCH /admin/exceptions/:id/resolve
   * Resolve a transport job exception with a resolution note.
   */
  @Patch('exceptions/:id/resolve')
  resolveException(
    @Param('id') id: string,
    @Body() body: ResolveExceptionDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.resolveException(id, body.resolution, admin.userId);
  }

  // ── Invoices admin view ───────────────────────────────────────────────────

  /** GET /admin/invoices?page=1&limit=50&status=PENDING */
  @Get('invoices')
  getAllInvoices(
    @Query() pagination: PagePaginationDto,
    @Query('status') status?: string,
  ) {
    return this.service.getAllInvoices(
      pagination.page ?? 1,
      pagination.limit ?? 50,
      status,
    );
  }

  // ── Framework contracts admin view ────────────────────────────────────────

  /** GET /admin/framework-contracts?page=1&limit=50&status=ACTIVE */
  @Get('framework-contracts')
  getAllFrameworkContracts(
    @Query() pagination: PagePaginationDto,
    @Query('status') status?: string,
  ) {
    return this.service.getAllFrameworkContracts(
      pagination.page ?? 1,
      pagination.limit ?? 50,
      status,
    );
  }

  // ── RFQ / Quote Requests ──────────────────────────────────────────────────

  /** GET /admin/quote-requests?page=1&limit=50&status=PENDING */
  @Get('quote-requests')
  getQuoteRequests(
    @Query() pagination: PagePaginationDto,
    @Query('status') status?: string,
  ) {
    return this.service.adminGetQuoteRequests(
      pagination.page ?? 1,
      pagination.limit ?? 50,
      status,
    );
  }

  // ── Broadcast notification ────────────────────────────────────────────────

  /** POST /admin/notifications/broadcast */
  @Post('notifications/broadcast')
  @HttpCode(HttpStatus.OK)
  broadcastNotification(
    @Body() body: BroadcastNotificationDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.broadcastNotification(
      body.title,
      body.message,
      body.audience,
      admin.userId,
    );
  }

  // ── Platform settings ─────────────────────────────────────────────────────

  /** GET /admin/settings — all platform settings as key→value map */
  @Get('settings')
  getSettings() {
    return this.service.getSettings();
  }

  /** PATCH /admin/settings — bulk upsert settings */
  @Patch('settings')
  updateSettings(
    @Body() body: BulkSettingsDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.updateSettings(body.settings, admin.userId);
  }

  // ── Skip size catalogue ───────────────────────────────────────────────────

  /** GET /admin/skip-sizes — list all sizes (including inactive) */
  @Get('skip-sizes')
  listSkipSizes() {
    return this.service.adminListSkipSizes();
  }

  /** PUT /admin/skip-sizes/:code — create or update a size by code */
  @Put('skip-sizes/:code')
  upsertSkipSize(
    @Param('code') code: string,
    @Body() dto: UpsertSkipSizeDto,
  ) {
    return this.service.adminUpsertSkipSize(code, dto);
  }

  /** Delete /admin/skip-sizes/:code — hard delete a size (use isActive=false to soft-hide) */
  @Delete('skip-sizes/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSkipSize(@Param('code') code: string) {
    return this.service.adminDeleteSkipSize(code);
  }

  // ── Marketplace engine overview ───────────────────────────────────────────

  /**
   * GET /admin/marketplace
   * Returns all skip size definitions (CMS floor prices) + all CARRIER/HYBRID
   * companies with their pricing rows, service zones and today's availability.
   * Powers the admin marketplace overview page.
   */
  @Get('marketplace')
  getMarketplace() {
    return this.service.adminGetMarketplace();
  }

  // ── Recycling centers ─────────────────────────────────────────────────────

  /** GET /admin/recycling-centers?page=1&limit=50 — all centers (active + inactive) */
  @Get('recycling-centers')
  getRecyclingCenters(@Query() pagination: PagePaginationDto) {
    return this.service.adminGetRecyclingCenters(
      pagination.page ?? 1,
      pagination.limit ?? 50,
    );
  }

  /** PATCH /admin/recycling-centers/:id — toggle active flag */
  @Patch('recycling-centers/:id')
  toggleRecyclingCenter(
    @Param('id') id: string,
    @Body() body: { active: boolean },
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.adminToggleRecyclingCenter(id, body.active, admin.userId);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  /**
   * GET /admin/documents?page=1&limit=50&type=...&status=...&search=...&isGenerated=true|false
   * Platform-wide document listing — all users, no ownerId filter.
   */
  @Get('documents')
  getDocuments(
    @Query() pagination: PagePaginationDto,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('isGenerated') isGenerated?: string,
  ) {
    const gen =
      isGenerated === 'true' ? true : isGenerated === 'false' ? false : undefined;
    return this.service.getDocuments(
      pagination.page ?? 1,
      pagination.limit ?? 50,
      type,
      status,
      search,
      gen,
    );
  }

  /**
   * PATCH /admin/documents/:id/status
   * Update document status (e.g. ISSUED → ARCHIVED to void it).
   * Audit-logged.
   */
  @Patch('documents/:id/status')
  updateDocumentStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.service.updateDocumentStatus(id, body.status, admin.userId, body.note);
  }

  /**
   * GET /admin/dispatch
   * Live dispatcher snapshot — active jobs with coords, online drivers, carrier fleet stats.
   * Used by the admin live dispatch map view. Intended to be polled every 30s.
   */
  @Get('dispatch')
  getLiveDispatch() {
    return this.service.getLiveDispatch();
  }

  // ── B3 Recycling ──────────────────────────────────────────────────────────

  /**
   * GET /admin/b3-recycling/jobs
   * All DISPOSAL orders (inbound jobs for the Gulbene recycling facility).
   * Optionally filter by centerId query param.
   */
  @Get('b3-recycling/jobs')
  getRecyclingInboundJobs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('centerId') centerId?: string,
  ) {
    return this.service.adminGetRecyclingInboundJobs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      centerId,
    );
  }

  /**
   * GET /admin/b3-recycling/waste-records
   * All WasteRecord entries (the processed waste log).
   * Optionally filter by centerId query param.
   */
  @Get('b3-recycling/waste-records')
  getRecyclingWasteRecords(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('centerId') centerId?: string,
  ) {
    return this.service.adminGetRecyclingWasteRecords(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      centerId,
    );
  }

  // ── B3 Construction ───────────────────────────────────────────────────────

  /**
   * GET /admin/b3-construction/clients
   * All CONSTRUCTION-type companies (B3 Construction's client portfolio).
   */
  @Get('b3-construction/clients')
  getConstructionClients() {
    return this.service.adminGetConstructionClients();
  }

  /**
   * POST /admin/b3-construction/clients
   * Admin registers a new construction client company.
   */
  @Post('b3-construction/clients')
  createConstructionClient(@Body() body: CreateConstructionClientDto) {
    return this.service.adminCreateConstructionClient(body);
  }

  /**
   * POST /admin/b3-construction/projects
   * Admin manually creates a construction project on behalf of a company.
   */
  @Post('b3-construction/projects')
  createConstructionProject(
    @CurrentUser() user: RequestingUser,
    @Body() body: {
      name: string;
      companyId: string;
      contractValue: number;
      clientName?: string;
      description?: string;
      siteAddress?: string;
      budgetAmount?: number;
      startDate?: string;
      endDate?: string;
      status?: string;
    },
  ) {
    return this.service.adminCreateConstructionProject(user.id, body as Parameters<typeof this.service.adminCreateConstructionProject>[1]);
  }

  /**
   * GET /admin/b3-construction/disposal
   * All disposal orders tagged to a project (cross-project platform view).
   */
  @Get('b3-construction/disposal')
  getConstructionDisposalOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.adminGetConstructionDisposalOrders(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 100,
      projectId,
      status,
    );
  }

  /**
   * GET /admin/b3-construction/projects
   * All construction projects (platform-wide, not company-scoped).
   */
  @Get('b3-construction/projects')
  getConstructionProjects(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.adminGetConstructionProjects(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      status,
      companyId,
    );
  }

  /**
   * GET /admin/b3-construction/projects/:id
   * Single project detail with orders, sites, and framework contracts.
   */
  @Get('b3-construction/projects/:id')
  getConstructionProjectById(@Param('id') id: string) {
    return this.service.adminGetConstructionProjectById(id);
  }

  /**
   * PATCH /admin/b3-construction/projects/:id
   * Update project status or basic fields.
   */
  @Patch('b3-construction/projects/:id')
  updateConstructionProject(
    @Param('id') id: string,
    @Body() body: {
      status?: string;
      name?: string;
      description?: string;
      clientName?: string;
      siteAddress?: string;
      contractValue?: number;
      budgetAmount?: number;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    return this.service.adminUpdateConstructionProject(id, body as Parameters<typeof this.service.adminUpdateConstructionProject>[1]);
  }

  // ── B3 Recycling — job actions ─────────────────────────────────────────────

  /**
   * PATCH /admin/b3-recycling/jobs/:id
   * Update status of a DISPOSAL order (confirm, start, complete, cancel).
   */
  @Patch('b3-recycling/jobs/:id')
  updateRecyclingJob(
    @Param('id') id: string,
    @Body() body: { status?: string; notes?: string },
  ) {
    return this.service.adminUpdateRecyclingJob(id, body);
  }

  /**
   * POST /admin/b3-recycling/waste-records
   * Manually log a weigh-in record (walk-in vehicle, no online booking).
   */
  @Post('b3-recycling/waste-records')
  createWasteRecord(
    @Body() body: {
      recyclingCenterId: string;
      wasteType: string;
      weight: number;
      volume?: number;
      processedDate?: string;
      recyclableWeight?: number;
      recyclingRate?: number;
    },
  ) {
    return this.service.adminCreateWasteRecord(body);
  }
}
