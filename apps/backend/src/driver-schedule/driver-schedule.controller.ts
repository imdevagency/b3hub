import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BlockDateDto } from './dto/block-date.dto';
import { ToggleOnlineDto } from './dto/toggle-online.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { DriverScheduleService } from './driver-schedule.service';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('driver-schedule')
@UseGuards(JwtAuthGuard)
export class DriverScheduleController {
  constructor(private readonly service: DriverScheduleService) {}

  /**
   * GET /driver-schedule
   * Returns the driver's full availability state:
   * isOnline, autoSchedule, maxJobsPerDay, weeklySchedule[], dateBlocks[], effectiveOnline
   */
  @Get()
  getMyAvailability(@CurrentUser() user: RequestingUser) {
    return this.service.getMyAvailability(user.userId);
  }

  /**
   * PATCH /driver-schedule/online
   * Toggle the driver's manual online/offline status.
   * Body: { isOnline: boolean }
   */
  @Patch('online')
  toggleOnline(
    @CurrentUser() user: RequestingUser,
    @Body() dto: ToggleOnlineDto,
  ) {
    return this.service.toggleOnline(user.userId, dto);
  }

  /**
   * PUT /driver-schedule
   * Upsert the full weekly schedule + preferences (autoSchedule, maxJobsPerDay).
   * Sends the full array of 7 days (or any subset).
   */
  @Post()
  updateSchedule(
    @CurrentUser() user: RequestingUser,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.updateSchedule(user.userId, dto);
  }

  /**
   * POST /driver-schedule/blocks
   * Block a specific date (vacation, sick day, etc.)
   * Body: { date: "2026-03-15", reason?: string }
   */
  @Post('blocks')
  blockDate(@CurrentUser() user: RequestingUser, @Body() dto: BlockDateDto) {
    return this.service.blockDate(user.userId, dto);
  }

  /**
   * DELETE /driver-schedule/blocks/:id
   * Remove a previously blocked date.
   */
  @Delete('blocks/:id')
  unblockDate(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    return this.service.unblockDate(user.userId, id);
  }
}
