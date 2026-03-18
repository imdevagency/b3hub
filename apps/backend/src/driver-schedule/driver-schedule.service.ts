import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockDateDto } from './dto/block-date.dto';
import { ToggleOnlineDto } from './dto/toggle-online.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class DriverScheduleService {
  private readonly logger = new Logger(DriverScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Auto-create a minimal DriverProfile for any canTransport user ─────────
  private async getOrCreateDriverProfile(userId: string) {
    const existing = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    // Check user actually has canTransport permission
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.canTransport) {
      throw new ForbiddenException('Transport permission not granted.');
    }

    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);

    return this.prisma.driverProfile.create({
      data: {
        userId,
        licenseNumber: `DRV-${userId.slice(-8).toUpperCase()}`,
        licenseType: ['B', 'C'],
        licenseExpiry: expiry,
        certifications: [],
      },
    });
  }

  // ── Guard: ensure caller has a DriverProfile (auto-create if needed) ─────
  private async requireDriverProfile(userId: string) {
    return this.getOrCreateDriverProfile(userId);
  }

  // ── Get full availability state (status + schedule + blocks) ─────────────
  async getMyAvailability(userId: string) {
    await this.getOrCreateDriverProfile(userId);

    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        weeklySchedule: { orderBy: { dayOfWeek: 'asc' } },
        dateBlocks: {
          where: { blockedDate: { gte: new Date() } },
          orderBy: { blockedDate: 'asc' },
        },
      },
    });
    if (!profile) throw new ForbiddenException('No driver profile found');

    // Compute whether driver should be auto-available right now
    const effectiveOnline = this.computeEffectiveOnline(profile);

    return { ...profile, effectiveOnline };
  }

  // ── Toggle online/offline immediately ─────────────────────────────────────
  async toggleOnline(userId: string, dto: ToggleOnlineDto) {
    await this.requireDriverProfile(userId);
    const profile = await this.prisma.driverProfile.update({
      where: { userId },
      data: { isOnline: dto.isOnline },
    });
    return { isOnline: profile.isOnline };
  }

  // ── Upsert weekly schedule + preferences ─────────────────────────────────
  async updateSchedule(userId: string, dto: UpdateScheduleDto) {
    const profile = await this.requireDriverProfile(userId);

    await this.prisma.$transaction(async (tx) => {
      // Update profile-level settings
      await tx.driverProfile.update({
        where: { id: profile.id },
        data: {
          autoSchedule: dto.autoSchedule ?? profile.autoSchedule,
          maxJobsPerDay:
            dto.maxJobsPerDay !== undefined
              ? dto.maxJobsPerDay
              : profile.maxJobsPerDay,
        },
      });

      // Upsert each day
      for (const day of dto.days) {
        await tx.driverSchedule.upsert({
          where: {
            driverProfileId_dayOfWeek: {
              driverProfileId: profile.id,
              dayOfWeek: day.dayOfWeek,
            },
          },
          create: {
            driverProfileId: profile.id,
            dayOfWeek: day.dayOfWeek,
            enabled: day.enabled,
            startTime: day.startTime,
            endTime: day.endTime,
          },
          update: {
            enabled: day.enabled,
            startTime: day.startTime,
            endTime: day.endTime,
          },
        });
      }
    });

    return this.getMyAvailability(userId);
  }

  // ── Block a specific date ─────────────────────────────────────────────────
  async blockDate(userId: string, dto: BlockDateDto) {
    const profile = await this.requireDriverProfile(userId);
    const blockedDate = new Date(dto.date);

    return this.prisma.driverDateBlock.upsert({
      where: {
        driverProfileId_blockedDate: {
          driverProfileId: profile.id,
          blockedDate,
        },
      },
      create: {
        driverProfileId: profile.id,
        blockedDate,
        reason: dto.reason,
      },
      update: { reason: dto.reason },
    });
  }

  // ── Remove a date block ───────────────────────────────────────────────────
  async unblockDate(userId: string, blockId: string) {
    const profile = await this.requireDriverProfile(userId);
    const block = await this.prisma.driverDateBlock.findUnique({
      where: { id: blockId },
    });
    if (!block || block.driverProfileId !== profile.id) {
      throw new NotFoundException('Date block not found');
    }
    await this.prisma.driverDateBlock.delete({ where: { id: blockId } });
    return { deleted: blockId };
  }

  // ── Check if a specific driver is available (used by job matching) ────────
  async isDriverAvailableNow(driverProfileId: string): Promise<boolean> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
      include: {
        weeklySchedule: true,
        dateBlocks: {
          where: { blockedDate: { gte: new Date() } },
        },
      },
    });
    if (!profile) return false;
    return this.computeEffectiveOnline(profile);
  }

  // ── Internal: derive effective online status ──────────────────────────────
  private computeEffectiveOnline(profile: {
    isOnline: boolean;
    autoSchedule: boolean;
    weeklySchedule: Array<{
      dayOfWeek: number;
      enabled: boolean;
      startTime: string;
      endTime: string;
    }>;
    dateBlocks: Array<{ blockedDate: Date }>;
  }): boolean {
    const now = new Date();

    // Check if today is blocked
    const todayStr = now.toISOString().slice(0, 10);
    const todayBlocked = profile.dateBlocks.some(
      (b) => b.blockedDate.toISOString().slice(0, 10) === todayStr,
    );
    if (todayBlocked) return false;

    if (profile.autoSchedule) {
      // 0=Sun, 1=Mon … 6=Sat
      const dayOfWeek = now.getDay();
      const schedule = profile.weeklySchedule.find(
        (s) => s.dayOfWeek === dayOfWeek && s.enabled,
      );
      if (!schedule) return false;

      // Compare current HH:mm against window
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      return (
        currentTime >= schedule.startTime && currentTime <= schedule.endTime
      );
    }

    // Manual mode: just use the isOnline flag
    return profile.isOnline;
  }
}
