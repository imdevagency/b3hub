/**
 * Analytics controller — /api/v1/analytics
 * ERP-style reporting endpoints. All routes are authenticated.
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/overview
   * Returns a full analytics overview shaped to the user's roles:
   * - buyer section always included
   * - seller section included if canSell=true
   * - carrier section included if canTransport=true
   */
  @Get('overview')
  getOverview(@CurrentUser() user: RequestingUser) {
    return this.analyticsService.getOverview(user);
  }
}
