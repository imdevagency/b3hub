/**
 * Tracking controller — /api/v1/track
 * Public endpoints — no authentication required.
 */
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { UpdateTrackingDeliveryDto } from './dto/update-tracking-delivery.dto';
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Public()
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  /**
   * PATCH /track/:token/delivery
   * Public endpoint — foreman fills in delivery details for a draft/pending order.
   * Rate-limited to 20 req/min per IP to prevent abuse.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Public()
  @Patch(':token/delivery')
  updateDelivery(
    @Param('token') token: string,
    @Body() dto: UpdateTrackingDeliveryDto,
  ) {
    return this.service.updateDelivery(token, dto);
  }
}
