import {
  Controller,
  Get,
  Put,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { BisService } from './bis.service';
import type { UpdateBisSettingsDto } from './bis.service';

@UseGuards(JwtAuthGuard)
@Controller('admin/bis')
export class BisController {
  constructor(private readonly bis: BisService) {}

  // ─── Settings ────────────────────────────────────────────────────────────

  /**
   * Get current BIS API credentials and status.
   * GET /api/v1/admin/bis/settings
   */
  @Get('settings')
  async getSettings(@CurrentUser() user: RequestingUser) {
    this.requireAdmin(user);
    return { data: await this.bis.getSettings() };
  }

  /**
   * Update BIS API credentials.
   * PUT /api/v1/admin/bis/settings
   */
  @Put('settings')
  async updateSettings(
    @CurrentUser() user: RequestingUser,
    @Body() dto: UpdateBisSettingsDto,
  ) {
    this.requireAdmin(user);
    return this.bis.updateSettings(dto, user.id);
  }

  /**
   * Verify that the configured credentials can obtain an OAuth2 token.
   * POST /api/v1/admin/bis/test-connection
   */
  @Post('test-connection')
  async testConnection(@CurrentUser() user: RequestingUser) {
    this.requireAdmin(user);
    return this.bis.testConnection();
  }

  // ─── Registry ────────────────────────────────────────────────────────────

  /**
   * Search Būvkomersantu reģistrs by company name or registration number.
   * GET /api/v1/admin/bis/companies?q=SomeCompany
   * GET /api/v1/admin/bis/companies?q=40003073671
   */
  @Get('companies')
  async searchCompanies(
    @CurrentUser() user: RequestingUser,
    @Query('q') q: string,
  ) {
    this.requireAdmin(user);
    if (!q?.trim()) throw new BadRequestException('q param required');
    return { data: await this.bis.searchCompanies(q) };
  }

  /**
   * Lookup a single company by exact registration number.
   * GET /api/v1/admin/bis/company?regNr=40003073671
   */
  @Get('company')
  async getCompanyByRegNr(
    @CurrentUser() user: RequestingUser,
    @Query('regNr') regNr: string,
  ) {
    this.requireAdmin(user);
    if (!regNr?.trim()) throw new BadRequestException('regNr param required');
    return { data: await this.bis.getCompanyByRegNr(regNr) };
  }

  /**
   * Search Būvspeciālistu reģistrs by specialist name or certificate number.
   * GET /api/v1/admin/bis/specialists?q=Jānis
   */
  @Get('specialists')
  async searchSpecialists(
    @CurrentUser() user: RequestingUser,
    @Query('q') q: string,
  ) {
    this.requireAdmin(user);
    if (!q?.trim()) throw new BadRequestException('q param required');
    return { data: await this.bis.searchSpecialists(q) };
  }

  /**
   * Clear BIS cache for all keys or a specific prefix.
   * GET /api/v1/admin/bis/cache/clear?prefix=bis.company
   */
  @Get('cache/clear')
  async clearCache(
    @CurrentUser() user: RequestingUser,
    @Query('prefix') prefix?: string,
  ) {
    this.requireAdmin(user);
    await this.bis.clearCacheForKey(prefix ?? 'bis.');
    return { ok: true };
  }

  private requireAdmin(user: RequestingUser) {
    if (user.userType !== 'ADMIN') {
      throw new BadRequestException('Tikai administratoriem');
    }
  }
}

