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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateOrderScheduleDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateDisposalOrderDto } from './dto/create-disposal-order.dto';
import { CreateFreightOrderDto } from './dto/create-freight-order.dto';
import { CreateSurchargeDto } from './dto/create-surcharge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrderStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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

  @Get('stats')
  getStats(@CurrentUser() user: RequestingUser) {
    return this.ordersService.getDashboardStats(user);
  }

  @Get()
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: OrderStatus,
    @Query('limit') limit: string = '20',
    @Query('skip') skip: string = '0',
  ) {
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100); // Clamp 1-100
    const skipNum = Math.max(parseInt(skip, 10) || 0, 0);
    return this.ordersService.findAll(user, status, limitNum, skipNum);
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
  startLoading(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.updateStatusAsUser(
      id,
      OrderStatus.IN_PROGRESS,
      user,
    );
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.cancel(id, user);
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

  /** GET /orders/schedules — list caller's recurring schedules */
  @Get('schedules')
  getMySchedules(@CurrentUser() user: RequestingUser) {
    return this.ordersService.getMySchedules(user);
  }

  /** POST /orders/schedules/:id/pause — pause a schedule */
  @Post('schedules/:id/pause')
  pauseSchedule(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.pauseSchedule(id, user);
  }

  /** POST /orders/schedules/:id/resume — resume a paused schedule */
  @Post('schedules/:id/resume')
  resumeSchedule(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.resumeSchedule(id, user);
  }

  /** DELETE /orders/schedules/:id — cancel and remove a schedule */
  @Delete('schedules/:id')
  deleteSchedule(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.ordersService.deleteSchedule(id, user);
  }
}
