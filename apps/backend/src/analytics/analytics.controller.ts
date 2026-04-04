/**
 * Analytics controller — /api/v1/analytics
 * ERP-style reporting endpoints. All routes are authenticated.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/overview
   * Role-aware analytics (buyer / seller / carrier sections).
   */
  @UseGuards(JwtAuthGuard)
  @Get('overview')
  getOverview(@CurrentUser() user: RequestingUser) {
    return this.analyticsService.getOverview(user);
  }

  /**
   * GET /analytics/suppliers
   * Public supplier performance scores — sorted by avg rating.
   * Used by buyers browsing the catalog and by admin dashboards.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('suppliers')
  getSupplierScores() {
    return this.analyticsService.getSupplierScores();
  }
}
