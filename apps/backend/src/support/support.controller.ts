/**
 * Support chat controller — /api/v1/support
 */
import { Body, Controller, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface.js';
import { IsEnum } from 'class-validator';

class SetThreadStatusDto {
  @IsEnum(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED';
}

@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly service: SupportService) {}

  /** GET /support/my-thread — get (or auto-create) the user's support thread */
  @Get('my-thread')
  getOrCreateMyThread(@CurrentUser() user: RequestingUser) {
    const name = user.email ?? 'User';
    return this.service.getOrCreateMyThread(user.userId, name);
  }

  /** GET /support/my-messages — fetch messages for the user's thread */
  @Get('my-messages')
  getMyMessages(@CurrentUser() user: RequestingUser) {
    return this.service.getMyMessages(user.userId);
  }

  /** POST /support/my-messages — send a message on the user's thread */
  @Post('my-messages')
  sendMyMessage(
    @CurrentUser() user: RequestingUser,
    @Body() dto: SendSupportMessageDto,
  ) {
    const name = user.email ?? 'User';
    return this.service.sendMyMessage(user.userId, name, dto);
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  /** GET /support/admin/threads — list all support threads (admin only) */
  @Get('admin/threads')
  adminListThreads(@CurrentUser() user: RequestingUser) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return this.service.adminListThreads();
  }

  /** GET /support/admin/threads/:id — get a specific thread with messages */
  @Get('admin/threads/:id')
  adminGetThread(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return this.service.adminGetThread(id);
  }

  /** POST /support/admin/threads/:id/reply — admin replies to a thread */
  @Post('admin/threads/:id/reply')
  adminReply(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: SendSupportMessageDto,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException();
    }
    const name = user.email ?? 'Support';
    return this.service.adminReply(id, user.userId, name, dto);
  }

  /** PUT /support/admin/threads/:id/status — close or reopen a thread */
  @Put('admin/threads/:id/status')
  adminSetStatus(
    @Param('id') id: string,
    @Body() body: SetThreadStatusDto,
    @CurrentUser() user: RequestingUser,
  ) {
    if (user.userType !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return this.service.adminSetStatus(id, body.status);
  }
}
