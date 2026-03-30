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
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

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
}
