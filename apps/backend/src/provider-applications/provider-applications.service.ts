import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateProviderApplicationDto } from './dto/create-provider-application.dto';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class ProviderApplicationsService {
  private readonly logger = new Logger(ProviderApplicationsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /** Public — submit a provider application */
  async create(dto: CreateProviderApplicationDto) {
    if (!dto.appliesForSell && !dto.appliesForTransport) {
      throw new BadRequestException(
        'Must apply for at least one capability (sell or transport)',
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
        userId: dto.userId,
      },
    });

    // Notify applicant their submission was received (non-blocking)
    this.email
      .sendApplicationReceived(application.email, application.firstName ?? '')
      .catch(() => null);

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

    // Update application
    const updated = await this.prisma.providerApplication.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewedByUserId,
        reviewNote,
      },
    });

    // If linked to a user, grant capabilities and set OWNER role
    if (app.userId) {
      await this.prisma.user.update({
        where: { id: app.userId },
        data: {
          ...(app.appliesForSell && { canSell: true }),
          ...(app.appliesForTransport && { canTransport: true }),
          // First person to be approved for a company is its owner
          companyRole: 'OWNER',
        },
      });
    }

    // Notify applicant of approval (non-blocking)
    this.email
      .sendApplicationApproved(app.email, app.firstName ?? '', {
        canSell: app.appliesForSell,
        canTransport: app.appliesForTransport,
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

    this.logger.log(
      `Provider application ${id} rejected by admin ${reviewedByUserId}`,
    );
    return rejected;
  }
}
