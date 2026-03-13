import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type as NotificationType,
        title: dto.title,
        message: dto.message,
        data: dto.data ?? undefined,
      },
    });

    // Fire push notification if the user has a registered token
    this.sendPush(dto.userId, dto.title, dto.message).catch(() => {});

    return notification;
  }

  /** Notify multiple users at once (e.g. broadcast to all drivers). */
  async createForMany(userIds: string[], dto: Omit<CreateNotificationDto, 'userId'>) {
    await Promise.all(userIds.map((userId) => this.create({ ...dto, userId })));
  }

  private async sendPush(userId: string, title: string, body: string) {
    // Raw query avoids stale Prisma client type cache after schema push
    const rows = await this.prisma.$queryRaw<{ pushToken: string | null }[]>`
      SELECT "pushToken" FROM users WHERE id = ${userId} LIMIT 1
    `;
    const pushToken = rows[0]?.pushToken;
    if (!pushToken) return;

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: pushToken, sound: 'default', title, body }),
    });

    if (!res.ok) {
      this.logger.warn(`Expo push HTTP error for user ${userId}: ${res.status}`);
      return;
    }

    // Parse the ticket to detect stale tokens and clean up the DB
    try {
      const json = await res.json() as { data?: { status?: string; details?: { error?: string } } };
      const ticket = json?.data;
      if (ticket?.status === 'error') {
        const errCode = ticket?.details?.error;
        this.logger.warn(`Expo push error for user ${userId}: ${errCode}`);
        if (errCode === 'DeviceNotRegistered') {
          // Token is stale — clear it so we stop wasting push calls
          await this.prisma.$executeRaw`
            UPDATE users SET "pushToken" = NULL WHERE id = ${userId}
          `;
          this.logger.log(`Cleared stale push token for user ${userId}`);
        }
      }
    } catch {
      // Non-JSON response — ignore
    }
  }

  async getForUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return {
      data: notifications,
      meta: { page, limit, total, unreadCount },
    };
  }

  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }
}
