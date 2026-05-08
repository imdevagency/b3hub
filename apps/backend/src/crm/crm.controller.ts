import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BuContext, LeadStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { ForbiddenException } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import {
  CreateNoteDto,
  CreateTaskDto,
  UpdateTaskDto,
} from './dto/note-task.dto';

function assertAdmin(user: RequestingUser) {
  if (user.userType !== 'ADMIN') throw new ForbiddenException();
}

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ─── Pipeline ─────────────────────────────────────────────────────────────

  @Get('pipeline')
  getPipeline(@CurrentUser() user: RequestingUser) {
    assertAdmin(user);
    return this.crmService.getPipelineSummary();
  }

  // ─── Leads ────────────────────────────────────────────────────────────────

  @Get('leads')
  listLeads(
    @CurrentUser() user: RequestingUser,
    @Query('status') status?: LeadStatus,
    @Query('buContext') buContext?: BuContext,
    @Query('search') search?: string,
  ) {
    assertAdmin(user);
    return this.crmService.listLeads({ status, buContext, search });
  }

  @Get('leads/:id')
  getLead(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    assertAdmin(user);
    return this.crmService.getLead(id);
  }

  @Post('leads')
  @HttpCode(201)
  createLead(@CurrentUser() user: RequestingUser, @Body() dto: CreateLeadDto) {
    assertAdmin(user);
    return this.crmService.createLead(dto, user.id);
  }

  @Patch('leads/:id')
  updateLead(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    assertAdmin(user);
    return this.crmService.updateLead(id, dto);
  }

  @Delete('leads/:id')
  @HttpCode(204)
  deleteLead(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    assertAdmin(user);
    return this.crmService.deleteLead(id);
  }

  // ─── Notes ────────────────────────────────────────────────────────────────

  @Post('leads/:id/notes')
  @HttpCode(201)
  addNote(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
  ) {
    assertAdmin(user);
    return this.crmService.addNote(id, dto, user.id);
  }

  @Delete('leads/:id/notes/:noteId')
  @HttpCode(204)
  deleteNote(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    assertAdmin(user);
    return this.crmService.deleteNote(id, noteId, user.id, true);
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────

  @Post('leads/:id/tasks')
  @HttpCode(201)
  addTask(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: CreateTaskDto,
  ) {
    assertAdmin(user);
    return this.crmService.addTask(id, dto);
  }

  @Patch('leads/:id/tasks/:taskId')
  updateTask(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    assertAdmin(user);
    return this.crmService.updateTask(id, taskId, dto);
  }

  @Delete('leads/:id/tasks/:taskId')
  @HttpCode(204)
  deleteTask(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
  ) {
    assertAdmin(user);
    return this.crmService.deleteTask(id, taskId);
  }
}
