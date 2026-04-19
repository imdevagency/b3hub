/**
 * Orders controller — /api/v1/orders
 * Endpoints for placing orders, listing buyer/supplier orders,
 * updating order status, and retrieving order details with line items.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderScheduleDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateDisposalOrderDto } from './dto/create-disposal-order.dto';
import { CreateFreightOrderDto } from './dto/create-freight-order.dto';
import { CreateSurchargeDto } from './dto/create-surcharge.dto';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import {
  RequireScope,
  RequireScopeGuard,
} from '../auth/guards/require-scope.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrderStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

class UploadSitePhotoDto {
  @IsString()
  @IsNotEmpty()
  base64: string;

  @IsOptional()
  @IsIn(ALLOWED_PHOTO_TYPES)
  mimeType?: string;
}

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtOrApiKeyGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * POST /orders/upload-site-photo
   * Buyer uploads a base64 image of the unloading point before creating the order.
   * Returns a Supabase Storage public URL to be passed as sitePhotoUrl on order creation.
   */
  @Post('upload-site-photo')
  async uploadSitePhoto(
    @CurrentUser() user: RequestingUser,
    @Body() dto: UploadSitePhotoDto,
  ) {
    if (!this.supabase) {
      throw new BadRequestException('File storage is not configured');
    }
    const mimeType = dto.mimeType ?? 'image/jpeg';
    const raw = dto.base64.includes(',') ? dto.base64.split(',')[1] : dto.base64;
    const buffer = Buffer.from(raw, 'base64');
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const path = `site-photos/${user.userId}/${Date.now()}.${ext}`;
    await this.supabase.uploadFile('site-photos', path, buffer);
    const url = this.supabase.getPublicUrl('site-photos', path);
    return { url };
  }

  @Post()
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  /** POST /orders/disposal — buyer requests waste collection (creates WASTE_COLLECTION transport job) */
  @Post('disposal')
  createDisposal(
    @Body() dto: CreateDisposalOrderDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.createDisposalOrder(dto, user.userId);
  }

  /** POST /orders/freight — buyer requests point-to-point freight transport (creates TRANSPORT job) */
  @Post('freight')
  createFreight(
    @Body() dto: CreateFreightOrderDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.createFreightOrder(dto, user.userId);
  }

  /** GET /orders/export/csv — download all accessible orders as CSV */
  @Get('export/csv')
  async exportCsv(@CurrentUser() user: RequestingUser, @Res() res: Response) {
    const csv = await this.ordersService.exportCsv(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.end('\uFEFF' + csv);
  }

  @Get('stats')
  getStats(@CurrentUser() user: RequestingUser) {
    return this.ordersService.getDashboardStats(user);
  }

  @Get()
  @UseGuards(RequireScopeGuard)
  @RequireScope('orders:read')
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: string,
    @Query('limit') limit: string = '20',
    @Query('skip') skip: string = '0',
    @Query('updatedSince') updatedSince?: string,
  ) {
    if (
      status !== undefined &&
      !Object.values(OrderStatus).includes(status as OrderStatus)
    ) {
      throw new BadRequestException(
        `status must be one of: ${Object.values(OrderStatus).join(', ')}`,
      );
    }
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skipNum = Math.max(parseInt(skip, 10) || 0, 0);
    return this.ordersService.findAll(
      user,
      status as OrderStatus | undefined,
      limitNum,
      skipNum,
      updatedSince,
    );
  }

  /** GET /orders/schedules — list caller's recurring schedules (must be before :id) */
  @Get('schedules')
  getMySchedules(@CurrentUser() user: RequestingUser) {
    return this.ordersService.getMySchedules(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.update(id, updateOrderDto, user);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.updateStatusAsUser(
      id,
      OrderStatus.CONFIRMED,
      user,
    );
  }

  @Post(':id/start-loading')
  startLoading(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: { weightKg?: number },
  ) {
    return this.ordersService.startLoading(id, user, body?.weightKg);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.cancel(id, user);
  }

  /** POST /orders/:id/confirm-receipt — buyer confirms they received the goods → COMPLETED */
  @Post(':id/confirm-receipt')
  confirmReceipt(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.confirmReceipt(id, user);
  }

  /** POST /orders/:id/seller-cancel — seller cancels after confirmation */
  @Post(':id/seller-cancel')
  sellerCancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('reason is required');
    }
    return this.ordersService.sellerCancel(id, reason.trim(), user);
  }

  /** POST /orders/:id/surcharges — add a surcharge line item (seller / admin only) */
  @Post(':id/surcharges')
  addSurcharge(
    @Param('id') id: string,
    @Body() dto: CreateSurchargeDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.addSurcharge(id, dto, user);
  }

  /** DELETE /orders/:id/surcharges/:surchargeId — remove a surcharge line item */
  @Delete(':id/surcharges/:surchargeId')
  removeSurcharge(
    @Param('id') id: string,
    @Param('surchargeId') surchargeId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.removeSurcharge(id, surchargeId, user);
  }

  /** PATCH /orders/:id/link-skip — link or unlink a SkipHireOrder to this material order */
  @Patch(':id/link-skip')
  linkSkipOrder(
    @Param('id') id: string,
    @Body('skipHireOrderId') skipHireOrderId: string | null,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.linkSkipOrder(id, skipHireOrderId ?? null, user);
  }

  // ─── Recurring order schedules ────────────────────────────────────────────

  /** POST /orders/schedules — create a recurring order schedule */
  @Post('schedules')
  createSchedule(
    @Body() dto: CreateOrderScheduleDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.createSchedule(dto, user);
  }

  /** POST /orders/schedules/:id/pause — pause a schedule */
  @Post('schedules/:id/pause')
  pauseSchedule(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.pauseSchedule(id, user);
  }

  /** POST /orders/schedules/:id/resume — resume a paused schedule */
  @Post('schedules/:id/resume')
  resumeSchedule(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.resumeSchedule(id, user);
  }

  /** DELETE /orders/schedules/:id — cancel and remove a schedule */
  @Delete('schedules/:id')
  deleteSchedule(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.deleteSchedule(id, user);
  }
}
