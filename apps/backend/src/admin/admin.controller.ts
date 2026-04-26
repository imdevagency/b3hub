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
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
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

class UpdateCompanyDto {
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsBoolean() payoutEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionRate?: number;
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

  /** GET /admin/jobs — all transport jobs (paginated) */
  @Get('jobs')
  getTransportJobs(@Query() pagination: PagePaginationDto) {
    return this.service.getTransportJobs(
      pagination.page ?? 1,
      pagination.limit ?? 50,
    );
  }

  /** GET /admin/companies — all companies */
  @Get('companies')
  getCompanies() {
    return this.service.getCompanies();
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
}
