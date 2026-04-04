/**
 * Provider applications service.
 * Users apply to become a supplier (canSell) or carrier (canTransport).
 * Stores application data, triggers admin review, and on approval sets user flags.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/create-notification.dto';
import { CreateProviderApplicationDto } from './dto/create-provider-application.dto';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class ProviderApplicationsService {
  private readonly logger = new Logger(ProviderApplicationsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notifications: NotificationsService,
  ) {}

  /** Public — submit a provider application */
  async create(dto: CreateProviderApplicationDto, authenticatedUserId?: string) {
    if (!dto.appliesForSell && !dto.appliesForTransport) {
      throw new BadRequestException(
        'Must apply for at least one capability (sell or transport)',
      );
    }

    // Prevent duplicate PENDING applications from the same email or linked user
    const duplicateWhere = authenticatedUserId
      ? { OR: [{ email: dto.email }, { userId: authenticatedUserId }] }
      : { email: dto.email };
    const existingPending = await this.prisma.providerApplication.findFirst({
      where: { ...duplicateWhere, status: 'PENDING' },
      select: { id: true },
    });
    if (existingPending) {
      throw new BadRequestException(
        'You already have a pending application under review',
      );
    }

    const application = await this.prisma.providerApplication.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        companyName: dto.companyName,
        regNumber: dto.regNumber,
        taxId: dto.taxId,
        website: dto.website,
        appliesForSell: dto.appliesForSell,
        appliesForTransport: dto.appliesForTransport,
        description: dto.description,
        // Never trust client-provided userId — use the server-verified identity
        userId: authenticatedUserId ?? null,
      },
    });

    // Notify applicant their submission was received (non-blocking)
    this.email
      .sendApplicationReceived(application.email, application.firstName ?? '')
      .catch(() => null);

    // Alert all admins so they can promptly review the new application
    this.prisma.user
      .findMany({ where: { userType: 'ADMIN' }, select: { id: true } })
      .then((admins) => {
        if (admins.length === 0) return;
        const roleLabel = [
          dto.appliesForSell ? 'piegādātājs' : null,
          dto.appliesForTransport ? 'pārvadātājs' : null,
        ]
          .filter(Boolean)
          .join(' / ');
        return this.notifications.createForMany(
          admins.map((a) => a.id),
          {
            type: NotificationType.SYSTEM_ALERT,
            title: '📋 Jauns sniedzēja pieteikums',
            message: `${application.firstName ?? ''} ${application.lastName ?? ''} (${application.email}) lūdz apstiprināšanu kā ${roleLabel}. Uzņēmums: ${application.companyName ?? 'nav norādīts'}.`,
            data: { applicationId: application.id },
          },
        );
      })
      .catch((err) =>
        this.logger.error(
          `Failed to notify admins of new provider application ${application.id}: ${(err as Error).message}`,
        ),
      );

    this.logger.log(`Provider application submitted by ${application.email}`);
    return application;
  }

  /** User — get their own applications */
  async findByUser(userId: string) {
    return this.prisma.providerApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin — list all applications, optionally filtered by status */
  async findAll(status?: string) {
    return this.prisma.providerApplication.findMany({
      where: status ? { status: status as ApplicationStatus } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin — get one application */
  async findOne(id: string) {
    const app = await this.prisma.providerApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  /** Admin — approve: sets flags on the user and updates application status */
  async approve(id: string, reviewedByUserId: string, reviewNote?: string) {
    const app = await this.findOne(id);

    if (app.status !== 'PENDING') {
      throw new BadRequestException('Application is not in PENDING state');
    }

    // Wrap both writes in a transaction so the application is never left in
    // APPROVED state while the user still lacks the capability flags.
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.providerApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewedByUserId,
          reviewNote,
        },
      });

      // If linked to a user, grant capabilities and set OWNER role
      if (app.userId) {
        // Fetch user to check if they already have a companyId
        const linkedUser = await tx.user.findUnique({
          where: { id: app.userId },
          select: { companyId: true },
        });

        await tx.user.update({
          where: { id: app.userId },
          data: {
            ...(app.appliesForSell && { canSell: true }),
            ...(app.appliesForTransport && { canTransport: true }),
            // Only promote to OWNER when the user is already tied to a company.
            // Without a companyId, setting companyRole produces an inconsistent state
            // (OWNER with no company). The admin onboarding flow should create the
            // Company record separately and link it before or after approval.
            ...(linkedUser?.companyId && { companyRole: 'OWNER' }),
            // Bump tokenVersion so any in-flight JWT is invalidated on next request.
            tokenVersion: { increment: 1 },
          },
        });
      }

      return result;
    });

    // Notify applicant of approval (non-blocking)
    this.email
      .sendApplicationApproved(app.email, app.firstName ?? '', {
        canSell: app.appliesForSell,
        canTransport: app.appliesForTransport,
      })
      .catch(() => null);

    this.prisma.adminAuditLog
      .create({
        data: {
          adminId: reviewedByUserId,
          action: 'APPROVE_APPLICATION',
          entityType: 'ProviderApplication',
          entityId: id,
          before: { status: 'PENDING' },
          after: { status: 'APPROVED', reviewNote: reviewNote ?? null },
        },
      })
      .catch(() => null);

    this.logger.log(
      `Provider application ${id} approved by admin ${reviewedByUserId}`,
    );
    return updated;
  }

  /** Admin — reject an application */
  async reject(id: string, reviewedByUserId: string, reviewNote?: string) {
    const app = await this.findOne(id);

    if (app.status !== 'PENDING') {
      throw new BadRequestException('Application is not in PENDING state');
    }

    const rejected = await this.prisma.providerApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewedByUserId,
        reviewNote,
      },
    });

    // Notify applicant of rejection (non-blocking)
    this.email
      .sendApplicationRejected(app.email, app.firstName ?? '', reviewNote)
      .catch(() => null);

    this.prisma.adminAuditLog
      .create({
        data: {
          adminId: reviewedByUserId,
          action: 'REJECT_APPLICATION',
          entityType: 'ProviderApplication',
          entityId: id,
          before: { status: 'PENDING' },
          after: { status: 'REJECTED', reviewNote: reviewNote ?? null },
        },
      })
      .catch(() => null);

    this.logger.log(
      `Provider application ${id} rejected by admin ${reviewedByUserId}`,
    );
    return rejected;
  }
}
