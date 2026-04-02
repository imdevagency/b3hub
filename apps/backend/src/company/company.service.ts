/**
 * Company service.
 * Manages company profiles: create, update, logo upload via Supabase,
 * and fetch with members and linked vehicles.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { CompanyRole } from '@prisma/client';

const COMPANY_SELECT = {
  id: true,
  name: true,
  legalName: true,
  registrationNum: true,
  taxId: true,
  companyType: true,
  email: true,
  phone: true,
  website: true,
  description: true,
  logo: true,
  verified: true,
  street: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  createdAt: true,
  updatedAt: true,
} as const;

const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatar: true,
  companyRole: true,
  canSell: true,
  canTransport: true,
  status: true,
  emailVerified: true,
  createdAt: true,
} as const;

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private assertHasCompany(currentUser: RequestingUser): string {
    if (!currentUser.companyId) {
      throw new ForbiddenException('You are not associated with a company');
    }
    return currentUser.companyId;
  }

  private assertIsOwnerOrManager(currentUser: RequestingUser): void {
    if (
      currentUser.companyRole !== 'OWNER' &&
      currentUser.companyRole !== 'MANAGER'
    ) {
      throw new ForbiddenException(
        'Only company owners and managers can perform this action',
      );
    }
  }

  private assertIsOwner(currentUser: RequestingUser): void {
    if (currentUser.companyRole !== 'OWNER') {
      throw new ForbiddenException(
        'Only the company owner can perform this action',
      );
    }
  }

  // ── Company profile ────────────────────────────────────────────────────────

  async getMyCompany(currentUser: RequestingUser) {
    const companyId = this.assertHasCompany(currentUser);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: COMPANY_SELECT,
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateMyCompany(currentUser: RequestingUser, dto: UpdateCompanyDto) {
    const companyId = this.assertHasCompany(currentUser);
    this.assertIsOwnerOrManager(currentUser);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.street !== undefined && { street: dto.street }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
      },
      select: COMPANY_SELECT,
    });
  }

  // ── Team members ───────────────────────────────────────────────────────────

  async getMembers(currentUser: RequestingUser) {
    const companyId = this.assertHasCompany(currentUser);
    return this.prisma.user.findMany({
      where: { companyId },
      select: MEMBER_SELECT,
      orderBy: [{ companyRole: 'asc' }, { firstName: 'asc' }],
    });
  }

  async inviteMember(currentUser: RequestingUser, dto: InviteMemberDto) {
    const companyId = this.assertHasCompany(currentUser);
    this.assertIsOwnerOrManager(currentUser);

    // Only OWNERs can create other OWNERs or MANAGERs
    if (
      (dto.companyRole === CompanyRole.OWNER ||
        dto.companyRole === CompanyRole.MANAGER) &&
      currentUser.companyRole !== 'OWNER'
    ) {
      throw new ForbiddenException('Only owners can invite owners or managers');
    }

    // Email or phone must be provided
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    // Check for duplicate email
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new BadRequestException('A user with this email already exists');
      }
    }

    // Generate a temporary password — returned once so admin can share it
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        password: hashedPassword,
        companyId,
        companyRole: dto.companyRole,
        canTransport:
          dto.canTransport ?? dto.companyRole === CompanyRole.DRIVER,
        canSell: dto.canSell ?? false,
        status: 'ACTIVE',
      },
      select: MEMBER_SELECT,
    });

    return { user, tempPassword };
  }

  async updateMember(
    currentUser: RequestingUser,
    memberId: string,
    dto: UpdateMemberDto,
  ) {
    const companyId = this.assertHasCompany(currentUser);
    this.assertIsOwnerOrManager(currentUser);

    // Confirm the member belongs to the same company
    const member = await this.prisma.user.findFirst({
      where: { id: memberId, companyId },
    });
    if (!member)
      throw new NotFoundException('Member not found in your company');

    // Only owners can promote to OWNER or MANAGER
    if (
      dto.companyRole &&
      (dto.companyRole === CompanyRole.OWNER ||
        dto.companyRole === CompanyRole.MANAGER) &&
      currentUser.companyRole !== 'OWNER'
    ) {
      throw new ForbiddenException(
        'Only owners can set the owner or manager role',
      );
    }

    // Owners cannot demote themselves
    if (
      memberId === currentUser.userId &&
      dto.companyRole &&
      dto.companyRole !== CompanyRole.OWNER
    ) {
      throw new BadRequestException('You cannot change your own owner role');
    }

    return this.prisma.user.update({
      where: { id: memberId },
      data: {
        ...(dto.companyRole !== undefined && { companyRole: dto.companyRole }),
        ...(dto.canTransport !== undefined && {
          canTransport: dto.canTransport,
        }),
        ...(dto.canSell !== undefined && { canSell: dto.canSell }),
        // Invalidate any in-flight JWT so revoked permissions take effect immediately
        tokenVersion: { increment: 1 },
      },
      select: MEMBER_SELECT,
    });
  }

  async removeMember(currentUser: RequestingUser, memberId: string) {
    const companyId = this.assertHasCompany(currentUser);
    this.assertIsOwnerOrManager(currentUser);

    if (memberId === currentUser.userId) {
      throw new BadRequestException(
        'You cannot remove yourself from the company',
      );
    }

    const member = await this.prisma.user.findFirst({
      where: { id: memberId, companyId },
    });
    if (!member)
      throw new NotFoundException('Member not found in your company');

    // Don't delete — deactivate and detach from company
    // Increment tokenVersion to immediately invalidate any in-flight JWT so the
    // removed employee cannot act as a company member after removal.
    await this.prisma.user.update({
      where: { id: memberId },
      data: {
        status: 'DEACTIVATED',
        companyId: null,
        companyRole: null,
        canSell: false,
        canTransport: false,
        tokenVersion: { increment: 1 },
      },
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from(
      { length: 10 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }
}
