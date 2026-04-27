/**
 * PayoutsController — admin endpoints for principal payout management.
 *
 * All endpoints require ADMIN role. Suppliers and carriers cannot access
 * these directly — they receive notifications when payouts are executed.
 *
 * Routes:
 *   GET  /admin/payouts           — list pending/all payout obligations
 *   GET  /admin/payouts/summary   — aggregated totals (pending, overdue)
 *   POST /admin/payouts/execute   — run all due payouts in batch
 *   POST /admin/payouts/supplier/:id/execute — pay one supplier payout
 *   POST /admin/payouts/carrier/:id/execute  — pay one carrier payout
 */
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import type { PayoutStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('admin/payouts')
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: RequestingUser) {
    return this.payouts.getSummary(user);
  }

  @Get()
  listPayouts(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('overdue') overdue?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payouts.listPayouts(user, {
      status: status as PayoutStatus | undefined,
      type: type as 'supplier' | 'carrier' | undefined,
      overdue: overdue === 'true',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
    });
  }

  @Post('execute')
  executeDuePayouts(@CurrentUser() user: RequestingUser) {
    return this.payouts.executeDuePayouts(user);
  }

  @Post('supplier/:id/execute')
  executeSupplierPayout(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.payouts.executeSupplierPayout(id, user);
  }

  @Post('carrier/:id/execute')
  executeCarrierPayout(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.payouts.executeCarrierPayout(id, user);
  }
}
