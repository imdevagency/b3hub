import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { SupplierLoadingSlotsService } from './supplier-loading-slots.service';
import { CreateLoadingSlotDto } from './dto/create-loading-slot.dto';
import { UpdateLoadingSlotDto } from './dto/update-loading-slot.dto';

@UseGuards(JwtAuthGuard)
@Controller('supplier-loading-slots')
export class SupplierLoadingSlotsController {
  constructor(private readonly service: SupplierLoadingSlotsService) {}

  /**
   * POST /supplier-loading-slots
   * Create a new loading window for a supplier company.
   */
  @Post()
  create(
    @Body() dto: CreateLoadingSlotDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.create(dto, user);
  }

  /**
   * GET /supplier-loading-slots?companyId=xxx
   * List all loading windows for a company.
   */
  @Get()
  findByCompany(
    @Query('companyId') companyId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!companyId) throw new BadRequestException('companyId query param required');
    return this.service.findByCompany(companyId, user);
  }

  /**
   * GET /supplier-loading-slots/available?companyId=xxx&date=YYYY-MM-DD
   * Returns slot windows for a given date with availability counts.
   * Used by the dispatcher when scheduling jobs.
   * This is a public-ish read (no company restriction) so carririers can check supplier availability.
   */
  @Get('available')
  getAvailableForDate(
    @Query('companyId') companyId: string,
    @Query('date') date: string,
  ) {
    if (!companyId) throw new BadRequestException('companyId query param required');
    if (!date) throw new BadRequestException('date query param required (YYYY-MM-DD)');
    return this.service.getAvailableForDate(companyId, date);
  }

  /**
   * PATCH /supplier-loading-slots/:id
   * Update a loading window's config.
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLoadingSlotDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.update(id, dto, user);
  }

  /**
   * DELETE /supplier-loading-slots/:id
   * Delete a loading window.
   */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.remove(id, user);
  }
}
