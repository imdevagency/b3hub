/**
 * Tracking controller — /api/v1/track
 * Public endpoints — no authentication required.
 */
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { TrackingService } from './tracking.service';

@ApiTags('Tracking')
@Controller('track')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  /**
   * GET /track/:token
   * Returns a public, PII-safe snapshot of an order's status and transport jobs.
   * Anyone with the token URL can view live delivery progress.
   */
  @Public()
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.service.getByToken(token);
  }
}
