/**
 * Notifications controller — /api/v1/notifications
 * Authenticated endpoints: list my notifications, mark one/all as read, delete one.
 */
import {
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { PagePaginationDto } from '../common/dto/pagination.dto';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications?page=1&limit=20 */
  @Get()
  getMyNotifications(
    @CurrentUser() user: RequestingUser,
    @Query() pagination: PagePaginationDto,
  ) {
    return this.notificationsService.getForUser(
      user.userId,
      pagination.page ?? 1,
      pagination.limit ?? 20,
    );
  }

  /** GET /notifications/unread-count */
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: RequestingUser) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  markAllRead(@CurrentUser() user: RequestingUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  /** PATCH /notifications/:id/read */
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.notificationsService.markRead(id, user.userId);
  }

  /**
   * POST /notifications/test
   * Dev-only: send a test notification to any userId without auth.
   * Only active when NODE_ENV=development.
   */
  @Post('test')
  async sendTest(
    @Body() body: { userId: string; title?: string; message?: string },
  ) {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Only available in development');
    }
    return this.notificationsService.create({
      userId: body.userId,
      type: NotificationType.SYSTEM_ALERT,
      title: body.title ?? 'Dev Test',
      message: body.message ?? 'Test notification from local dev script',
    });
  }
}
