import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ContainersService } from './containers.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { QueryContainersDto } from './dto/query-containers.dto';
import { CreateContainerOrderDto } from './dto/create-container-order.dto';
import { UpdateContainerOrderStatusDto } from './dto/update-container-order-status.dto';

@Controller('containers')
@UseGuards(JwtAuthGuard)
export class ContainersController {
  constructor(private readonly service: ContainersService) {}

  // ── Fleet management (carrier) ────────────────────────────────────────────

  /** POST /containers — carrier adds a container to their fleet */
  @Post()
  create(@Body() dto: CreateContainerDto, @CurrentUser() user: RequestingUser) {
    if (!user.companyId) {
      return { error: 'Company account required' };
    }
    return this.service.create(dto, user.companyId);
  }

  /** GET /containers/mine — carrier sees their own fleet */
  @Get('mine')
  findMine(@CurrentUser() user: RequestingUser) {
    // companyId is always present for carrier accounts
    return this.service.findMine(user.companyId!);
  }

  // ── Rental orders ─────────────────────────────────────────────────────────

  /** GET /containers/orders — buyer's rental history */
  @Get('orders')
  findMyOrders(@CurrentUser() user: RequestingUser) {
    return this.service.findMyOrders(user.userId);
  }

  /** GET /containers/orders/:id — single rental order */
  @Get('orders/:id')
  findOrder(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.findOrder(id, user.userId);
  }

  /** PATCH /containers/orders/:id/status — carrier updates rental status */
  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContainerOrderStatusDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.updateOrderStatus(id, dto, user.companyId!);
  }

  // ── Browse (public w/ auth) ───────────────────────────────────────────────

  /** GET /containers — list available containers */
  @Get()
  findAll(@Query() query: QueryContainersDto) {
    return this.service.findAll(query);
  }

  /** GET /containers/:id — container detail */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** PATCH /containers/:id — carrier updates container */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContainerDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.update(id, dto, user.companyId!);
  }

  /** DELETE /containers/:id — carrier removes container */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.remove(id, user.companyId!);
  }

  /** POST /containers/:id/rent — buyer rents a container */
  @Post(':id/rent')
  rent(
    @Param('id') id: string,
    @Body() dto: CreateContainerOrderDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.createOrder(id, dto, user.userId);
  }
}
