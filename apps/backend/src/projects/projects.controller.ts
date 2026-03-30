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
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignOrdersDto } from './dto/assign-orders.dto';
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
    return this.service.getFinancials(id, user.companyId);
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
}
