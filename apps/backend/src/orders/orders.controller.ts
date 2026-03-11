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

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.create(createOrderDto, {
      userId: user.userId,
      userType: user.userType,
      isCompany: user.isCompany ?? false,
      canSell: user.canSell ?? false,
      canTransport: user.canTransport ?? false,
      companyId: user.companyId,
    });
  }

  /** POST /orders/disposal — buyer requests waste collection (creates WASTE_COLLECTION transport job) */
  @Post('disposal')
  createDisposal(@Body() dto: CreateDisposalOrderDto, @CurrentUser() user: any) {
    return this.ordersService.createDisposalOrder(dto, user.userId);
  }

  /** POST /orders/freight — buyer requests point-to-point freight transport (creates TRANSPORT job) */
  @Post('freight')
  createFreight(@Body() dto: CreateFreightOrderDto, @CurrentUser() user: any) {
    return this.ordersService.createFreightOrder(dto, user.userId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.ordersService.getDashboardStats({
      userId: user.userId,
      userType: user.userType,
      isCompany: user.isCompany ?? false,
      canSell: user.canSell ?? false,
      canTransport: user.canTransport ?? false,
      companyId: user.companyId,
    });
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('status') status?: OrderStatus) {
    return this.ordersService.findAll(
      {
        userId: user.userId,
        userType: user.userType,
        isCompany: user.isCompany ?? false,
        canSell: user.canSell ?? false,
        canTransport: user.canTransport ?? false,
        companyId: user.companyId,
      },
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findOne(id, {
      userId: user.userId,
      userType: user.userType,
      isCompany: user.isCompany ?? false,
      canSell: user.canSell ?? false,
      canTransport: user.canTransport ?? false,
      companyId: user.companyId,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.update(id, updateOrderDto, {
      userId: user.userId,
      userType: user.userType,
      isCompany: user.isCompany ?? false,
      canSell: user.canSell ?? false,
      canTransport: user.canTransport ?? false,
      companyId: user.companyId,
    });
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
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.cancel(id, {
      userId: user.userId,
      userType: user.userType,
      isCompany: user.isCompany ?? false,
      canSell: user.canSell ?? false,
      canTransport: user.canTransport ?? false,
      companyId: user.companyId,
    });
  }
}
