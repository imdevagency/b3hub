/**
 * ConstructionController — /api/v1/construction
 *
 * Company-scoped construction ERP. All routes require:
 *  - JWT auth (JwtAuthGuard)
 *  - CONSTRUCTION_MANAGEMENT feature flag (CompanyFeatureGuard)
 *
 * companyId is always taken from the JWT, never from the URL.
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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyFeatureGuard, RequireCompanyFeature } from '../common/guards/company-feature.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ConstructionService } from './construction.service';

@Controller('construction')
@UseGuards(JwtAuthGuard, CompanyFeatureGuard)
@RequireCompanyFeature('CONSTRUCTION_MANAGEMENT')
export class ConstructionController {
  constructor(private readonly service: ConstructionService) {}

  // ─── Projects ──────────────────────────────────────────────────────────────

  @Get('projects')
  getProjects(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getProjects(user.companyId!, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 50,
    });
  }

  @Get('projects/:id')
  getProjectById(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getProjectById(id, user.companyId!);
  }

  @Post('projects')
  createProject(@CurrentUser() user: RequestingUser, @Body() body: any) {
    return this.service.createProject(user.companyId!, user.userId, body);
  }

  @Patch('projects/:id')
  updateProject(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateProject(id, user.companyId!, body);
  }

  // ─── Budget Lines ──────────────────────────────────────────────────────────

  @Get('projects/:id/budget-lines')
  getBudgetLines(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getBudgetLines(id, user.companyId!);
  }

  @Post('projects/:id/budget-lines')
  setBudgetLines(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: { lines: any[] },
  ) {
    return this.service.setBudgetLines(id, user.companyId!, body.lines);
  }

  // ─── Project Sites ─────────────────────────────────────────────────────────

  @Get('projects/:id/sites')
  getProjectSites(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getProjectSites(id, user.companyId!);
  }

  @Post('projects/:id/sites')
  createProjectSite(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.createProjectSite(id, user.companyId!, body);
  }

  @Delete('projects/:id/sites/:siteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProjectSite(
    @Param('id') id: string,
    @Param('siteId') siteId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.deleteProjectSite(siteId, id, user.companyId!);
  }

  // ─── Clients ───────────────────────────────────────────────────────────────

  @Get('clients')
  getClients(@CurrentUser() user: RequestingUser) {
    return this.service.getClients(user.companyId!);
  }
}
