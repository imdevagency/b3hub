import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /** GET /invoices?page=1&limit=20 — my invoices */
  @Get()
  getMyInvoices(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.getMyInvoices(
      user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /** GET /invoices/order/:orderId */
  @Get('order/:orderId')
  getByOrder(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    return this.invoicesService.getByOrder(orderId, user.userId);
  }

  /** GET /invoices/:id */
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invoicesService.getById(id, user.userId);
  }

  /** PATCH /invoices/:id/pay */
  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invoicesService.markAsPaid(id, user.userId);
  }
}
