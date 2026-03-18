import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateDisposalOrderDto } from './dto/create-disposal-order.dto';
import { CreateFreightOrderDto } from './dto/create-freight-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrderStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: RequestingUser) {
    return this.ordersService.create(createOrderDto, user);
  }

  /** POST /orders/disposal — buyer requests waste collection (creates WASTE_COLLECTION transport job) */
  @Post('disposal')
  createDisposal(@Body() dto: CreateDisposalOrderDto, @CurrentUser() user: RequestingUser) {
    return this.ordersService.createDisposalOrder(dto, user.userId);
  }

  /** POST /orders/freight — buyer requests point-to-point freight transport (creates TRANSPORT job) */
  @Post('freight')
  createFreight(@Body() dto: CreateFreightOrderDto, @CurrentUser() user: RequestingUser) {
    return this.ordersService.createFreightOrder(dto, user.userId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: RequestingUser) {
    return this.ordersService.getDashboardStats(user);
  }

  @Get()
  findAll(@CurrentUser() user: RequestingUser, @Query('status') status?: OrderStatus) {
    return this.ordersService.findAll(user, status);
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
  confirm(@Param('id') id: string) {
    return this.ordersService.updateStatus(id, OrderStatus.CONFIRMED);
  }

  @Post(':id/start-loading')
  startLoading(@Param('id') id: string) {
    return this.ordersService.updateStatus(id, OrderStatus.IN_PROGRESS);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.ordersService.cancel(id, user);
  }
}
