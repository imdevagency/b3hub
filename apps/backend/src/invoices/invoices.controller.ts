/**
 * Invoices controller — /api/v1/invoices
 * Authenticated endpoints to list invoices, fetch a single invoice,
 * and mark invoices as paid.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

function canViewFinancials(user: RequestingUser): boolean {
  if (!user.companyId || user.companyRole === 'OWNER') return true;
  return user.permViewFinancials;
}

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /** GET /invoices?page=1&limit=20 — my invoices */
  @Get()
  getMyInvoices(
    @CurrentUser() user: RequestingUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view invoices',
      );
    }

    return this.invoicesService.getMyInvoices(
      user.userId,
      user.companyId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /** GET /invoices/order/:orderId */
  @Get('order/:orderId')
  getByOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view invoices',
      );
    }
    return this.invoicesService.getByOrder(
      orderId,
      user.userId,
      user.companyId,
    );
  }

  /** GET /invoices/:id */
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view invoices',
      );
    }
    return this.invoicesService.getById(id, user.userId, user.companyId);
  }

  /** PATCH /invoices/:id/pay */
  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to pay invoices',
      );
    }
    return this.invoicesService.markAsPaid(id, user.userId, user.companyId);
  }
}
