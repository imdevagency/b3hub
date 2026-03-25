import { Controller, Post, Body, Param, UseGuards, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent/:orderId')
  createIntent(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.paymentsService.createPaymentIntent(orderId, user);
  }

  @Post('onboard')
  createConnectLink(@CurrentUser() user: RequestingUser) {
    return this.paymentsService.createConnectAccountLink(user);
  }
}
