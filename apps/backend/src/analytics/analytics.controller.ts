/**
 * Analytics controller — /api/v1/analytics
 * ERP-style reporting endpoints. All routes are authenticated.
 */
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  /**
   * GET /analytics/delivery-calendar
   * Upcoming confirmed deliveries / transport jobs for the next 6 weeks.
   * Role-aware: buyer orders + seller orders + carrier jobs.
   */
  @UseGuards(JwtAuthGuard)
  @Get('delivery-calendar')
  getDeliveryCalendar(@CurrentUser() user: RequestingUser) {
    return this.analyticsService.getDeliveryCalendar(user);
  }

  /**
   * GET /analytics/export-pdf
   * Download analytics overview as a branded PDF report.
   */
  @UseGuards(JwtAuthGuard)
  @Get('export-pdf')
  async exportPdf(@CurrentUser() user: RequestingUser, @Res() res: Response) {
    const buffer = await this.analyticsService.generateReport(user);
    const filename = `analytics-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
}
