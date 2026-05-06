import { Controller, Get } from '@nestjs/common';
import { FuelService } from './fuel.service';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('public')
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  /**
   * GET /api/v1/public/price-rates
   *
   * Public endpoint — no authentication required.
   * Returns current Latvia retail diesel price + derived transport multiplier.
   * Used by the marketing landing page price estimator.
   *
   * Throttle is skipped because this is served with heavy caching on the CDN/proxy layer.
   */
  @SkipThrottle()
  @Get('price-rates')
  getPriceRates() {
    return this.fuelService.getLatest();
  }
}
