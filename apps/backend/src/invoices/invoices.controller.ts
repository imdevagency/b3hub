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
import { PagePaginationDto } from '../common/dto/pagination.dto';

function canViewFinancials(user: RequestingUser): boolean {
  // Company OWNERs and MANAGERs always have financial access.
  // Other company members require the explicit permViewFinancials flag.
  // Solo users (no company) always have access to their own invoices.
  if (!user.companyId) return true;
  if (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER') return true;
  return user.permViewFinancials === true;
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /** GET /invoices?page=1&limit=20 — my invoices */
  @Get()
  getMyInvoices(
    @CurrentUser() user: RequestingUser,
    @Query() pagination: PagePaginationDto,
  ) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view invoices',
      );
    }

    return this.invoicesService.getMyInvoices(
      user.userId,
      user.companyId,
      pagination.page ?? 1,
      pagination.limit ?? 20,
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

  /** PATCH /invoices/:id/pay — admin-only: confirms offline/bank-transfer payment */
  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException(
        'Only admins can manually mark invoices as paid',
      );
    }
    return this.invoicesService.markAsPaid(id, user.userId, user.companyId, true);
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
