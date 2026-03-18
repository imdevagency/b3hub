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
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('provider-applications')
export class ProviderApplicationsController {
  constructor(private readonly service: ProviderApplicationsService) {}

  /** POST /provider-applications — public, anyone can apply */
  @Post()
  create(@Body() dto: CreateProviderApplicationDto) {
    return this.service.create(dto);
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
