/**
 * Notifications controller — /api/v1/notifications
 * Authenticated endpoints: list my notifications, mark one/all as read, delete one.
 */
import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** GET /notifications?page=1&limit=20 */
  @Get()
  getMyNotifications(
    @CurrentUser() user: RequestingUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getForUser(
      user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
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
}
