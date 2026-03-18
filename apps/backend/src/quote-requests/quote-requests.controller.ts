import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { QuoteRequestsService } from './quote-requests.service';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto';
import { CreateQuoteResponseDto } from './dto/create-quote-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('quote-requests')
@UseGuards(JwtAuthGuard)
export class QuoteRequestsController {
  constructor(private readonly service: QuoteRequestsService) {}

  // ── Buyer endpoints ─────────────────────────────────────────

  /** POST /quote-requests — buyer submits a new request */
  @Post()
  create(@Body() dto: CreateQuoteRequestDto, @CurrentUser() user: RequestingUser) {
    return this.service.create(dto, user.userId);
  }

  /** GET /quote-requests — buyer lists their own requests */
  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    return this.service.findAll(user.userId);
  }

  // ── Supplier endpoints ──────────────────────────────────────
  // NOTE: static routes MUST come before parameterised ones (@Get(':id'))
  // otherwise NestJS/Express will greedily match "open" as an :id value.

  /** GET /quote-requests/open — supplier sees all open requests */
  @Get('open')
  openRequests() {
    return this.service.findOpenRequests();
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
    return this.service.addResponse(id, dto, user.companyId!);
  }
}
