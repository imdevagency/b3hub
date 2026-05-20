import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  /** GET /projects — list buyer's projects */
  @Get()
  findAll(@CurrentUser() user: RequestingUser) {
    return this.service.findAll(user.userId, user.companyId);
  }

  /** GET /projects/:id — project detail with contracts */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.findOne(id, user.userId, user.companyId);
  }

  /** POST /projects — create project */
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: RequestingUser) {
    return this.service.create(dto, user.userId, user.companyId);
  }

  /** PATCH /projects/:id — update project */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.service.update(id, dto, user.userId, user.companyId);
  }

  /** DELETE /projects/:id — delete project (unlinks contracts) */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.service.remove(id, user.userId, user.companyId);
  }
}
