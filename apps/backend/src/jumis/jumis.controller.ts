import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JumisService } from './jumis.service';
import { UpdateJumisSettingsDto, JumisSyncRequestDto } from './dto/jumis.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('admin/jumis')
@UseGuards(JwtAuthGuard, AdminGuard)
export class JumisController {
  constructor(private readonly jumisService: JumisService) {}

  /** GET /api/v1/admin/jumis/settings — returns current Jumis config (no password) */
  @Get('settings')
  getSettings() {
    return this.jumisService.getSettings();
  }

  /** POST /api/v1/admin/jumis/settings — save Jumis credentials */
  @Post('settings')
  updateSettings(
    @Body() dto: UpdateJumisSettingsDto,
    @CurrentUser() admin: RequestingUser,
  ) {
    return this.jumisService.updateSettings(dto, admin.userId);
  }

  /** POST /api/v1/admin/jumis/test — verify credentials against Jumis API */
  @Post('test')
  testConnection() {
    return this.jumisService.testConnection();
  }

  /** POST /api/v1/admin/jumis/sync — push data to Jumis (invoices or partners) */
  @Post('sync')
  sync(@Body() dto: JumisSyncRequestDto, @CurrentUser() admin: RequestingUser) {
    return this.jumisService.syncData(dto, admin.userId);
  }

  /** GET /api/v1/admin/jumis/sync/log — get sync history */
  @Get('sync/log')
  getSyncLog() {
    return this.jumisService.getSyncLog();
  }
}
