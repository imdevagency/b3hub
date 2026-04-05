/**
 * Admin controller — /api/v1/admin
 * Admin-only endpoints for user management, platform stats,
 * and provider application approval workflow.
 */
import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

class UpdateCompanyDto {
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsBoolean() payoutEnabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) commissionRate?: number;
}

class UpdateJobRateDto {
  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsNumber() @Min(0) pricePerTonne?: number;
  @IsOptional() note?: string;
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
  getUsers() {
    return this.service.getUsers();
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

  /** GET /admin/orders — all orders */
  @Get('orders')
  getOrders() {
    return this.service.getOrders();
  }

  /** GET /admin/jobs — all transport jobs */
  @Get('jobs')
  getTransportJobs() {
    return this.service.getTransportJobs();
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
  getAuditLogs() {
    return this.service.getAuditLogs();
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
}
