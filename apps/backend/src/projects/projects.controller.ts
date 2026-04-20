/**
 * Projects controller — /api/v1/projects
 * Construction project management for CONSTRUCTION company accounts.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignOrdersDto } from './dto/assign-orders.dto';
import { CreateProjectSiteDto } from './dto/create-project-site.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

function isOwnerOrManager(user: RequestingUser): boolean {
  if (!user.companyId) return false; // must belong to a company
  return (
    !user.companyRole || // no role set → sole company owner
    user.companyRole === 'OWNER' ||
    user.companyRole === 'MANAGER' ||
    user.permManageOrders
  );
}

function canViewFinancials(user: RequestingUser): boolean {
  if (!user.companyId) return false;
  if (!user.companyRole) return true; // sole owner
  if (user.companyRole === 'OWNER' || user.companyRole === 'MANAGER')
    return true;
  return user.permViewFinancials === true;
}

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  /** GET /projects — list my company's projects */
  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    if (!user.companyId) {
      throw new ForbiddenException('Projects require a company account');
    }
    return this.service.findAll(user.companyId);
  }

  /** GET /projects/:id — project detail with P&L */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.findOne(id, user.companyId);
  }

  /** GET /projects/:id/financials — P&L snapshot */
  @Get(':id/financials')
  getFinancials(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view project financials',
      );
    }
    return this.service.getFinancials(id, user.companyId);
  }

  /** GET /projects/:id/co2-report.pdf — downloadable branded CO₂ emissions report */
  @Get(':id/co2-report.pdf')
  async getCo2Report(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Res() res: Response,
  ) {
    if (!canViewFinancials(user)) {
      throw new ForbiddenException(
        'You do not have permission to view project financials',
      );
    }
    const buffer = await this.service.generateCo2Report(id, user.companyId);
    const filename = `co2-report-${id}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** POST /projects — create project (OWNER / MANAGER / permManageOrders) */
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestingUser) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to create projects',
      );
    }
    return this.service.create(dto, user.userId, user.companyId);
  }

  /** PATCH /projects/:id — update project */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to update projects',
      );
    }
    return this.service.update(id, dto, user.companyId);
  }

  /** POST /projects/:id/orders — assign orders to a project */
  @Post(':id/orders')
  assignOrders(
    @Param('id') id: string,
    @Body() dto: AssignOrdersDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to manage project orders',
      );
    }
    return this.service.assignOrders(id, dto, user.companyId);
  }

  /** DELETE /projects/:id/orders/:orderId — unassign an order */
  @Delete(':id/orders/:orderId')
  unassignOrder(
    @Param('id') id: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to manage project orders',
      );
    }
    return this.service.unassignOrder(id, orderId, user.companyId);
  }

  /** GET /projects/:id/documents — project-linked documents */
  @Get(':id/documents')
  getDocuments(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getDocuments(id, user.companyId);
  }

  /** GET /projects/:id/sites — list delivery / loading sites */
  @Get(':id/sites')
  getSites(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.getSites(id, user.companyId);
  }

  /** POST /projects/:id/sites — add a site */
  @Post(':id/sites')
  addSite(
    @Param('id') id: string,
    @Body() dto: CreateProjectSiteDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to manage project sites',
      );
    }
    return this.service.addSite(id, dto, user.companyId);
  }

  /** PATCH /projects/:id/sites/:siteId — update a site */
  @Patch(':id/sites/:siteId')
  updateSite(
    @Param('id') id: string,
    @Param('siteId') siteId: string,
    @Body() dto: CreateProjectSiteDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to manage project sites',
      );
    }
    return this.service.updateSite(id, siteId, dto, user.companyId);
  }

  /** DELETE /projects/:id/sites/:siteId — remove a site */
  @Delete(':id/sites/:siteId')
  removeSite(
    @Param('id') id: string,
    @Param('siteId') siteId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (!isOwnerOrManager(user)) {
      throw new ForbiddenException(
        'You do not have permission to manage project sites',
      );
    }
    return this.service.removeSite(id, siteId, user.companyId);
  }
}
