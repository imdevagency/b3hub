import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { withCronLock } from '../common/utils/cron-lock.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';

/**
 * Runs daily at 08:00 server time.
 * Finds vehicles whose insurance or inspection certificate expires within
 * 30 days and sends one in-app alert per vehicle per field (deduped by
 * checking for a recent DOCUMENT_EXPIRING_SOON notification with a matching
 * vehicleId in its data JSON, within the last 25 days).
 */
@Injectable()
export class VehiclesComplianceScheduler {
  private readonly logger = new Logger(VehiclesComplianceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { name: 'vehicles-compliance-expiry-check' })
  async handleExpiryCheck() {
    await withCronLock(this.prisma, 'vehicles-compliance-expiry-check', async () => {
    this.logger.log('Starting vehicle compliance expiry check');

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ago25Days = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);

    // Vehicles with either certificate expiring within 30 days
    const expiring = await this.prisma.vehicle.findMany({
      where: {
        OR: [
          { insuranceExpiry: { gte: now, lte: in30Days } },
          { inspectionExpiry: { gte: now, lte: in30Days } },
        ],
      },
      select: {
        id: true,
        licensePlate: true,
        make: true,
        model: true,
        insuranceExpiry: true,
        inspectionExpiry: true,
        ownerId: true,
      },
    });

    if (expiring.length === 0) {
      this.logger.log('No vehicles with expiring compliance — nothing to do');
      return;
    }

    // Find already-alerted vehicle fields in the last 25 days to avoid spam
    const recentAlerts = await this.prisma.notification.findMany({
      where: {
        type: 'DOCUMENT_EXPIRING_SOON',
        createdAt: { gte: ago25Days },
      },
      select: { data: true },
    });

    // Build a Set of "vehicleId:field" strings that already got an alert
    const alerted = new Set<string>(
      recentAlerts.flatMap((n) => {
        const d = n.data as { vehicleId?: string; field?: string } | null;
        if (d?.vehicleId && d?.field) return [`${d.vehicleId}:${d.field}`];
        return [];
      }),
    );

    let sent = 0;

    for (const v of expiring) {
      const label = `${v.make} ${v.model} (${v.licensePlate})`;

      const checks: Array<{ field: 'insuranceExpiry' | 'inspectionExpiry'; date: Date | null; name: string }> = [
        { field: 'insuranceExpiry', date: v.insuranceExpiry, name: 'Apdrošināšana' },
        { field: 'inspectionExpiry', date: v.inspectionExpiry, name: 'Tehniskā apskate' },
      ];

      for (const check of checks) {
        if (!check.date || check.date < now || check.date > in30Days) continue;

        // Skip vehicles with no identifiable owner to notify
        if (!v.ownerId) continue;

        const key = `${v.id}:${check.field}`;
        if (alerted.has(key)) continue;

        const daysLeft = Math.ceil(
          (check.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        const message =
          daysLeft <= 1
            ? `${check.name} transportlīdzeklim ${label} beidzas rīt.`
            : `${check.name} transportlīdzeklim ${label} beidzas pēc ${daysLeft} dienām.`;

        await this.notifications.create({
          userId: v.ownerId as string,
          type: NotificationType.DOCUMENT_EXPIRING_SOON,
          title: 'Transportlīdzekļa dokuments drīz beidzas',
          message,
          data: { vehicleId: v.id, field: check.field, daysLeft },
        });

        sent++;
      }
    }

    this.logger.log(
      `Vehicle compliance check complete: ${sent} alert(s) sent, ${expiring.length} vehicle(s) checked`,
    );
    }, this.logger);
  }
}
