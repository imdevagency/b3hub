/**
 * B3 Fields controller — /api/v1/b3-fields
 *
 * Public: GET list, GET by id/slug, GET slots for date
 * Admin:  POST create, PATCH update, POST create slot
 * Gate:   GET today's arrivals (PIN-gated on frontend, JWT on API)
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { B3FieldsService } from './b3-fields.service';
import { CreateB3FieldDto } from './dto/create-b3-field.dto';
import { UpdateB3FieldDto } from './dto/update-b3-field.dto';
import { CreatePickupSlotDto } from './dto/create-pickup-slot.dto';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto/create-inventory-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@ApiTags('B3 Fields')
@Controller('b3-fields')
export class B3FieldsController {
  constructor(private readonly service: B3FieldsService) {}

  /** GET /b3-fields — public list of active fields */
  @Get()
  findAll(@Query('all') all?: string) {
    return this.service.findAll(all !== 'true');
  }

  /** GET /b3-fields/:id — single field by id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** GET /b3-fields/by-slug/:slug — single field by URL slug */
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  /** GET /b3-fields/:id/today — gate view: today's arrivals (auth required) */
  @UseGuards(JwtAuthGuard)
  @Get(':id/today')
  getTodayArrivals(
    @Param('id') id: string,
    @CurrentUser() _user: RequestingUser,
  ) {
    return this.service.getTodayArrivals(id);
  }

  /** GET /b3-fields/:id/slots?date=YYYY-MM-DD — available pickup slots */
  @Get(':id/slots')
  getSlots(@Param('id') id: string, @Query('date') date: string) {
    return this.service.getSlots(id, date);
  }

  /** POST /b3-fields — admin: create a field */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateB3FieldDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.create(dto);
  }

  /** PATCH /b3-fields/:id — admin: update a field */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateB3FieldDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.update(id, dto);
  }

  /** POST /b3-fields/slots — admin: create a pickup slot */
  @UseGuards(JwtAuthGuard)
  @Post('slots')
  createSlot(
    @Body() dto: CreatePickupSlotDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.createSlot(dto);
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  /** GET /b3-fields/:id/inventory/public — publicly available inventory (no auth) */
  @Get(':id/inventory/public')
  getPublicInventory(@Param('id') id: string) {
    return this.service.getPublicInventory(id);
  }

  /** GET /b3-fields/:id/inventory — list all inventory items (admin) */
  @UseGuards(JwtAuthGuard)
  @Get(':id/inventory')
  getInventory(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.getInventory(id);
  }

  /** POST /b3-fields/:id/inventory — add inventory item (admin) */
  @UseGuards(JwtAuthGuard)
  @Post(':id/inventory')
  createInventoryItem(
    @Param('id') id: string,
    @Body() dto: CreateInventoryItemDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.createInventoryItem(id, dto);
  }

  /** PATCH /b3-fields/:id/inventory/:itemId — update inventory item (admin) */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/inventory/:itemId')
  updateInventoryItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.updateInventoryItem(id, itemId, dto);
  }

  /** DELETE /b3-fields/:id/inventory/:itemId — remove inventory item (admin) */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/inventory/:itemId')
  deleteInventoryItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.deleteInventoryItem(id, itemId);
  }

  /** POST /b3-fields/:id/slots/bulk — admin: bulk-create pickup slots */
  @UseGuards(JwtAuthGuard)
  @Post(':id/slots/bulk')
  bulkCreateSlots(
    @Param('id') id: string,
    @Body()
    body: {
      startDate: string;
      endDate: string;
      slotTimes: string[];
      durationMinutes: number;
      capacity: number;
      daysOfWeek: number[];
    },
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.bulkCreateSlots(id, body);
  }

  /** POST /b3-fields/:id/passes/scan — gate: scan a FieldPass QR code (admin) */
  @UseGuards(JwtAuthGuard)
  @Post(':id/passes/scan')
  scanPass(
    @Param('id') id: string,
    @Body() body: { passNumber: string },
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') throw new ForbiddenException();
    return this.service.scanPass(id, body.passNumber);
  }
}
