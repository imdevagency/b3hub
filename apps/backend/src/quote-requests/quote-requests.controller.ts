/**
 * Quote requests controller — /api/v1/quote-requests
 * Endpoints to create RFQs, list open/my requests, submit offers, and accept one.
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuoteRequestsService } from './quote-requests.service';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';
import { CreateQuoteResponseDto } from './dto/create-quote-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Quote Requests')
@Controller('quote-requests')
@UseGuards(JwtAuthGuard)
export class QuoteRequestsController {
  constructor(private readonly service: QuoteRequestsService) {}

  private assertCanRespondAsSupplier(user: RequestingUser) {
    if (user.userType === 'ADMIN') return;
    if (!user.canSell || !user.companyId) {
      throw new ForbiddenException(
        'Only approved suppliers can view open RFQs and submit responses',
      );
    }
  }

  // ── Buyer endpoints ─────────────────────────────────────────

  /** POST /quote-requests — buyer submits a new request */
  @Post()
  create(
    @Body() dto: CreateQuoteRequestDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.create(dto, user.userId);
  }

  /** GET /quote-requests — buyer lists their own requests with pagination */
  @Get()
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query('limit') limit: string = '20',
    @Query('skip') skip: string = '0',
  ) {
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skipNum = Math.max(parseInt(skip, 10) || 0, 0);
    return this.service.findAll(user.userId, limitNum, skipNum);
  }

  // ── Supplier endpoints ──────────────────────────────────────
  // NOTE: static routes MUST come before parameterised ones (@Get(':id'))
  // otherwise NestJS/Express will greedily match "open" as an :id value.

  /** GET /quote-requests/open — supplier sees all open requests with pagination */
  @Get('open')
  openRequests(
    @CurrentUser() user: RequestingUser,
    @Query('limit') limit: string = '20',
    @Query('skip') skip: string = '0',
  ) {
    this.assertCanRespondAsSupplier(user);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skipNum = Math.max(parseInt(skip, 10) || 0, 0);
    return this.service.findOpenRequests(limitNum, skipNum);
  }

  // ── Buyer endpoints (parameterised) ────────────────────────

  /** GET /quote-requests/:id — buyer polls their request + responses */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.findOne(id, user.userId);
  }

  /** POST /quote-requests/:id/accept/:responseId — buyer accepts a quote */
  @Post(':id/accept/:responseId')
  accept(
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.acceptResponse(id, responseId, user.userId);
  }

  /** POST /quote-requests/:id/respond — supplier submits a price */
  @Post(':id/respond')
  respond(
    @Param('id') id: string,
    @Body() dto: CreateQuoteResponseDto,
    @CurrentUser() user: RequestingUser,
  ) {
    this.assertCanRespondAsSupplier(user);
    if (!user.companyId) {
      throw new ForbiddenException(
        'Supplier company is required to submit a response',
      );
    }
    return this.service.addResponse(id, dto, user.companyId);
  }
}
