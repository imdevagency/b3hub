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

  // ─── Daily Reports ─────────────────────────────────────────────────────────

  @Get('daily-reports')
  getDailyReports(
    @CurrentUser() user: RequestingUser,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getDailyReports(user.companyId!, {
      projectId,
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 100,
    });
  }

  @Get('daily-reports/:id')
  getDailyReportById(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getDailyReportById(id, user.companyId!);
  }

  @Post('daily-reports')
  createDailyReport(@CurrentUser() user: RequestingUser, @Body() body: any) {
    return this.service.createDailyReport(user.companyId!, user.userId, body);
  }

  @Patch('daily-reports/:id')
  updateDailyReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateDailyReport(id, user.companyId!, body);
  }

  @Delete('daily-reports/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDailyReport(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteDailyReport(id, user.companyId!);
  }

  @Patch('daily-reports/:id/approve')
  approveDailyReport(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.approveDailyReport(id, user.companyId!, user.userId);
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

  // ─── Equipment ─────────────────────────────────────────────────────────────

  @Get('equipment')
  getEquipment(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getEquipment({
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 100,
    });
  }

  @Post('equipment')
  createEquipment(@Body() body: any) {
    return this.service.createEquipment(body);
  }

  @Patch('equipment/:id')
  updateEquipment(@Param('id') id: string, @Body() body: any) {
    return this.service.updateEquipment(id, body);
  }

  @Delete('equipment/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEquipment(@Param('id') id: string) {
    return this.service.deleteEquipment(id);
  }

  // ─── DPR Templates ─────────────────────────────────────────────────────────

  @Get('dpr-templates')
  getDprTemplates(
    @CurrentUser() user: RequestingUser,
    @Query('projectId') projectId?: string,
  ) {
    return this.service.getDprTemplates(user.companyId!, { projectId });
  }

  @Post('dpr-templates')
  createDprTemplate(@CurrentUser() user: RequestingUser, @Body() body: any) {
    return this.service.createDprTemplate(user.companyId!, body);
  }

  @Patch('dpr-templates/:id')
  updateDprTemplate(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateDprTemplate(id, user.companyId!, body);
  }

  @Delete('dpr-templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDprTemplate(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteDprTemplate(id, user.companyId!);
  }

  // ─── Rate Entries ──────────────────────────────────────────────────────────

  @Get('rates')
  getRateEntries(
    @CurrentUser() user: RequestingUser,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getRateEntries(user.companyId!, {
      category,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 500) : 200,
    });
  }

  @Post('rates')
  createRateEntry(@CurrentUser() user: RequestingUser, @Body() body: any) {
    return this.service.createRateEntry(user.companyId!, body);
  }

  @Patch('rates/:id')
  updateRateEntry(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateRateEntry(id, user.companyId!, body);
  }

  @Delete('rates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRateEntry(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteRateEntry(id, user.companyId!);
  }

  // ─── Employees ─────────────────────────────────────────────────────────────

  @Get('employees')
  getEmployees(
    @CurrentUser() user: RequestingUser,
    @Query('activeOnly') activeOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getEmployees(user.companyId!, {
      activeOnly: activeOnly === 'true',
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 500) : 200,
    });
  }

  @Post('employees')
  createEmployee(@CurrentUser() user: RequestingUser, @Body() body: any) {
    return this.service.createEmployee(user.companyId!, body);
  }

  @Patch('employees/:id')
  updateEmployee(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateEmployee(id, user.companyId!, body);
  }

  @Delete('employees/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmployee(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteEmployee(id, user.companyId!);
  }

  // ─── Subcontractors ────────────────────────────────────────────────────────

  @Get('subcontractors')
  getSubcontractors(
    @CurrentUser() user: RequestingUser,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getSubcontractors(user.companyId!, {
      active: active !== undefined ? active === 'true' : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 500) : 200,
    });
  }

  @Post('subcontractors')
  createSubcontractor(@CurrentUser() user: RequestingUser, @Body() body: any) {
    return this.service.createSubcontractor(user.companyId!, body);
  }

  @Patch('subcontractors/:id')
  updateSubcontractor(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateSubcontractor(id, user.companyId!, body);
  }

  @Delete('subcontractors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubcontractor(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteSubcontractor(id, user.companyId!);
  }

  @Get('projects/:id/subcontractor-engagements')
  getSubcontractorEngagements(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getSubcontractorEngagements(id, user.companyId!);
  }

  @Post('projects/:id/subcontractor-engagements')
  createSubcontractorEngagement(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.createSubcontractorEngagement(id, user.companyId!, body);
  }

  @Patch('subcontractor-engagements/:id')
  updateSubcontractorEngagement(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateSubcontractorEngagement(id, user.companyId!, body);
  }

  @Delete('subcontractor-engagements/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubcontractorEngagement(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteSubcontractorEngagement(id, user.companyId!);
  }

  // ─── Client Invoices ───────────────────────────────────────────────────────

  @Get('client-invoices')
  getClientInvoices(
    @CurrentUser() user: RequestingUser,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.getClientInvoices(user.companyId!, {
      projectId,
      status,
      limit: limit ? Math.min(Number(limit), 500) : 100,
      skip: skip ? Number(skip) : 0,
    });
  }

  @Post('projects/:id/client-invoices')
  createClientInvoice(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.createClientInvoice(id, user.companyId!, body);
  }

  @Patch('client-invoices/:id')
  updateClientInvoice(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() body: any,
  ) {
    return this.service.updateClientInvoice(id, user.companyId!, body);
  }

  @Delete('client-invoices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteClientInvoice(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.deleteClientInvoice(id, user.companyId!);
  }

  // ─── Profitability ─────────────────────────────────────────────────────────

  @Get('profitability')
  getProfitability(
    @CurrentUser() user: RequestingUser,
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getProfitability(user.companyId!, { projectId, from, to });
  }

  // ─── Clients ───────────────────────────────────────────────────────────────

  @Get('clients')
  getClients(@CurrentUser() user: RequestingUser) {
    return this.service.getClients(user.companyId!);
  }
}
