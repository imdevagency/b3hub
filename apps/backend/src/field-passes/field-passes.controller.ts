/**
 * Field Passes controller — /api/v1/field-passes
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FieldPassesService } from './field-passes.service';
import { CreateFieldPassDto } from './dto/create-field-pass.dto';
import { RevokeFieldPassDto } from './dto/revoke-field-pass.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Field Passes')
@Controller('field-passes')
@UseGuards(JwtAuthGuard)
export class FieldPassesController {
  constructor(private readonly service: FieldPassesService) {}

  /** GET /field-passes — list my company's passes */
  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    if (!user.companyId)
      throw new ForbiddenException('Company account required');
    return this.service.findAll(user.companyId);
  }

  /** GET /field-passes/admin — all passes (admin only) */
  @Get('admin')
  findAllAdmin(@CurrentUser() user: RequestingUser) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.service.findAllAdmin();
  }

  /**
   * GET /field-passes/validate/:passNumber — public gate validation.
   * No auth required — gate kiosk or driver's phone can call this
   * by scanning the QR code on the printed pass.
   * Tightly throttled to prevent pass number enumeration attacks.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('validate/:passNumber')
  validate(@Param('passNumber') passNumber: string) {
    return this.service.validateByPassNumber(passNumber);
  }

  /** GET /field-passes/:id — single pass */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    const companyId = user.userType === 'ADMIN' ? undefined : user.companyId;
    return this.service.findOne(id, companyId);
  }

  /** POST /field-passes — create a new pass */
  @Post()
  create(@Body() dto: CreateFieldPassDto, @CurrentUser() user: RequestingUser) {
    if (!user.companyId)
      throw new ForbiddenException('Company account required');
    return this.service.create(dto, user.userId, user.companyId);
  }

  /** PATCH /field-passes/:id/revoke — revoke (admin only) */
  @Patch(':id/revoke')
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeFieldPassDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.service.revoke(id, dto);
  }
}
