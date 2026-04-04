/**
 * Provider applications controller — /api/v1/provider-applications
 * Endpoints for users to submit applications and for admins to list, approve, or reject them.
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProviderApplicationsService } from './provider-applications.service';
import { CreateProviderApplicationDto } from './dto/create-provider-application.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Provider Applications')
@Controller('provider-applications')
export class ProviderApplicationsController {
  constructor(private readonly service: ProviderApplicationsService) {}

  /** POST /provider-applications — public, anyone can apply; JWT optional to bind to account */
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateProviderApplicationDto,
    @Request() req: Express.Request & { user?: RequestingUser },
  ) {
    // Use the authenticated user's ID if present; ignore any client-supplied userId
    const authenticatedUserId = req.user?.userId ?? undefined;
    return this.service.create(dto, authenticatedUserId);
  }

  /** GET /provider-applications/mine — authenticated user's own applications */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@Request() req: Express.Request & { user: RequestingUser }) {
    return this.service.findByUser(req.user.userId);
  }

  /** GET /provider-applications?status=PENDING — admin only */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  /** GET /provider-applications/:id — admin only */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** PATCH /provider-applications/:id/approve — admin only */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body('reviewNote') reviewNote: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.service.approve(id, req.user.userId, reviewNote);
  }

  /** PATCH /provider-applications/:id/reject — admin only */
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body('reviewNote') reviewNote: string,
    @Request() req: Express.Request & { user: RequestingUser },
  ) {
    return this.service.reject(id, req.user.userId, reviewNote);
  }
}
