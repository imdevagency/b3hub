import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';

/**
 * Runs daily at 08:00 server time.
 * Finds documents expiring within 30 days and sends one in-app alert per
 * document (deduped by checking for a recent DOCUMENT_EXPIRING_SOON notification
 * referencing the same documentId in its `data` JSON, within the last 25 days).
 */
@Injectable()
export class DocumentsExpiryScheduler {
  private readonly logger = new Logger(DocumentsExpiryScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { name: 'documents-expiry-check' })
  async handleExpiryCheck() {
    await withCronLock(this.prisma, 'documents-expiry-check', async () => {
    this.logger.log('Starting document expiry check');

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ago25Days = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);

    // Documents expiring within the next 30 days that are not archived
    const expiring = await this.prisma.document.findMany({
      where: {
        expiresAt: { gte: now, lte: in30Days },
        status: { not: DocumentStatus.ARCHIVED },
      },
      select: { id: true, title: true, expiresAt: true, ownerId: true },
    });

    if (expiring.length === 0) {
      this.logger.log('No documents expiring soon — nothing to do');
      return;
    }

    // Find doc IDs that already got an alert in the last 25 days to avoid spam
    const recentAlerts = await this.prisma.notification.findMany({
      where: {
        type: 'DOCUMENT_EXPIRING_SOON',
        createdAt: { gte: ago25Days },
      },
      select: { data: true },
    });

    const alertedDocIds = new Set<string>(
      recentAlerts
        .map((n) => (n.data as { documentId?: string } | null)?.documentId)
        .filter((id): id is string => !!id),
    );

    let sent = 0;

    for (const doc of expiring) {
      if (alertedDocIds.has(doc.id)) continue;

      const msLeft = doc.expiresAt!.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      const message =
        daysLeft <= 1
          ? `Dokuments "${doc.title}" beidzas rīt.`
          : `Dokuments "${doc.title}" beidzas pēc ${daysLeft} dienām.`;

      await this.notifications.create({
        userId: doc.ownerId,
        type: NotificationType.DOCUMENT_EXPIRING_SOON,
        title: 'Dokuments drīz beidzas',
        message,
        data: { documentId: doc.id, daysLeft },
      });

      sent++;
    }

    this.logger.log(
      `Document expiry check complete: ${sent} alert(s) sent, ${expiring.length} docs checked`,
    );
    }, this.logger);
  }
}
