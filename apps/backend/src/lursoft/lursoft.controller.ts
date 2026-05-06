import {
  Controller,
  Get,
  Put,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { LursoftService } from './lursoft.service';
import type { UpdateLursoftSettingsDto } from './lursoft.service';

@Controller('lursoft')
export class LursoftController {
  constructor(private readonly lursoft: LursoftService) {}

  // ─── Admin: settings ───────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@CurrentUser() user: RequestingUser) {
    this.requireAdmin(user);
    return { data: await this.lursoft.getSettings() };
  }

  @UseGuards(JwtAuthGuard)
  @Put('settings')
  async updateSettings(
    @CurrentUser() user: RequestingUser,
    @Body() dto: UpdateLursoftSettingsDto,
  ) {
    this.requireAdmin(user);
    return this.lursoft.updateSettings(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('test-connection')
  async testConnection(@CurrentUser() user: RequestingUser) {
    this.requireAdmin(user);
    return this.lursoft.testConnection();
  }

  // ─── Admin: company search ─────────────────────────────────────────────────

  /**
   * Search companies by name fragment.
   * GET /api/v1/lursoft/companies?q=Ceļu
   */
  @UseGuards(JwtAuthGuard)
  @Get('companies')
  async searchCompanies(
    @CurrentUser() user: RequestingUser,
    @Query('q') q: string,
  ) {
    this.requireAdmin(user);
    if (!q?.trim() || q.trim().length < 2)
      throw new BadRequestException('q param must be at least 2 characters');
    return { data: await this.lursoft.searchCompanies(q) };
  }

  /**
   * Clear Lursoft cache.
   * DELETE /api/v1/lursoft/cache
   */
  @UseGuards(JwtAuthGuard)
  @Get('cache/clear')
  async clearCache(@CurrentUser() user: RequestingUser) {
    this.requireAdmin(user);
    await this.lursoft.clearCacheForKey('lursoft.');
    return { ok: true };
  }

  // ─── Platform: company lookup (used by registration forms) ─────────────────

  /**
   * Look up a company by registration number.
   * Authenticated users (B2B buyers, sellers registering) may call this.
   * GET /api/v1/lursoft/company/:regNr
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('company/:regNr')
  async getCompany(@Param('regNr') regNr: string) {
    if (!regNr?.trim()) throw new BadRequestException('regNr required');
    return { data: await this.lursoft.getCompanyByRegNr(regNr) };
  }

  /**
   * Quick risk check for a company (admin + internal use).
   * GET /api/v1/lursoft/risk/:regNr
   */
  @UseGuards(JwtAuthGuard)
  @Get('risk/:regNr')
  async riskCheck(
    @CurrentUser() user: RequestingUser,
    @Param('regNr') regNr: string,
  ) {
    this.requireAdmin(user);
    return { data: await this.lursoft.riskCheck(regNr) };
  }

  private requireAdmin(user: RequestingUser) {
    if (user.userType !== 'ADMIN') {
      throw new BadRequestException('Tikai administratoriem');
    }
  }
}
