import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderApplicationDto } from './dto/create-provider-application.dto';

@Injectable()
export class ProviderApplicationsService {
  constructor(private prisma: PrismaService) {}

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

    return application;
  }

  /** Admin — list all applications, optionally filtered by status */
  async findAll(status?: string) {
    return this.prisma.providerApplication.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin — get one application */
  async findOne(id: string) {
    const app = await this.prisma.providerApplication.findUnique({ where: { id } });
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

    return updated;
  }

  /** Admin — reject an application */
  async reject(id: string, reviewedByUserId: string, reviewNote?: string) {
    const app = await this.findOne(id);

    if (app.status !== 'PENDING') {
      throw new BadRequestException('Application is not in PENDING state');
    }

    return this.prisma.providerApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewedByUserId,
        reviewNote,
      },
    });
  }
}
