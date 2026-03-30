/**
 * Invoices controller — /api/v1/invoices
 * Authenticated endpoints to list invoices, fetch a single invoice,
 * download as PDF, send by email, and mark invoices as paid.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

function canViewFinancials(_user: RequestingUser): boolean {
  // All authenticated buyers can view and manage their own invoices.
  // The service layer (buyerAccess) scopes results to the user's own orders only.
  return true;
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

  /** GET /invoices/:id/pdf — stream PDF to client */
  @Get(':id/pdf')
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Res() res: Response,
  ) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view invoices',
      );
    }
    const pdf = await this.invoicesService.generatePdf(
      id,
      user.userId,
      user.companyId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${id}.pdf"`,
    );
    res.end(pdf);
  }

  /** POST /invoices/:id/send-email — email the invoice PDF to the currently authenticated user */
  @Post(':id/send-email')
  async sendEmail(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view invoices',
      );
    }
    if (!user.email) {
      throw new ForbiddenException('No email address on account');
    }
    await this.invoicesService.emailInvoice(id, user.email, user.userId);
    return { message: 'Invoice emailed successfully' };
  }
}
