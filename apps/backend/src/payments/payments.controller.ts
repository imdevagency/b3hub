import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Get,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Patch,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

class ReportDisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

class ResolveDisputeDto {
  @IsIn(['release', 'refund'])
  resolution!: 'release' | 'refund';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments/webhook
   * Stripe sends events here (no JWT — verified by Stripe-Signature header).
   * NestJS must be configured to expose rawBody for this route.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.paymentsService.handleWebhookEvent(req.rawBody!, signature);
    return { received: true };
  }

  @Post('create-intent/:orderId')
  @UseGuards(JwtAuthGuard)
  createIntent(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.paymentsService.createPaymentIntent(orderId, user);
  }

  @Post('onboard')
  @UseGuards(JwtAuthGuard)
  createConnectLink(@CurrentUser() user: RequestingUser) {
    if (!user.canSell && !user.canTransport && !user.canSkipHire) {
      throw new ForbiddenException(
        'Only approved sellers or carriers can onboard for payouts',
      );
    }
    return this.paymentsService.createConnectAccountLink(user);
  }

  @Post('dispute/:orderId')
  @UseGuards(JwtAuthGuard)
  reportDispute(
    @Param('orderId') orderId: string,
    @Body() dto: ReportDisputeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.paymentsService.reportDispute(
      orderId,
      dto.reason,
      dto.details,
      user,
    );
  }

  /**
   * PATCH /payments/dispute/:orderId/resolve
   * Admin-only. Resolves an open dispute by either releasing funds to the seller
   * (dispute rejected) or issuing a full refund to the buyer (dispute upheld).
   */
  @Patch('dispute/:orderId/resolve')
  @UseGuards(JwtAuthGuard)
  resolveDispute(
    @Param('orderId') orderId: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException('Only admins can resolve disputes');
    }
    return this.paymentsService.resolveDispute(
      orderId,
      dto.resolution,
      dto.adminNote,
      user,
    );
  }

  /**
   * GET /payments/earnings
   * Returns payout history for the requesting seller company or individual driver.
   * Used by the web earnings dashboard page.
   */
  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  getEarnings(@CurrentUser() user: RequestingUser) {
    return this.paymentsService.getEarnings(user);
  }

  /**
   * GET /payments/balance
   * Returns the Stripe Connect account available + pending balance for the
   * current user. Safe to call even if not yet onboarded — returns zeros.
   */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  getBalance(@CurrentUser() user: RequestingUser) {
    return this.paymentsService.getConnectBalance(user);
  }
}
