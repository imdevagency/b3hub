import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// Fields returned for every member in the list
const MEMBER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  companyRole: true,
  status: true,
  permCreateContracts: true,
  permReleaseCallOffs: true,
  permManageOrders: true,
  permViewFinancials: true,
  permManageTeam: true,
  createdAt: true,
};

@Injectable()
export class CompanyMembersService {
  private readonly logger = new Logger(CompanyMembersService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /** Assert caller belongs to a company and optionally is OWNER or has permManageTeam */
  private async assertCanManage(callerId: string, requireOwner = false) {
    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { companyId: true, companyRole: true, permManageTeam: true },
    });
    if (!caller?.companyId) throw new ForbiddenException('You are not part of a company');
    const isOwner = caller.companyRole === 'OWNER';
    if (requireOwner && !isOwner) throw new ForbiddenException('Only the company owner can do this');
    if (!isOwner && !caller.permManageTeam) {
      throw new ForbiddenException('You do not have permission to manage team members');
    }
    return { companyId: caller.companyId, isOwner };
  }

  /** List all members of the caller's company */
  async listMembers(callerId: string) {
    const caller = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { companyId: true },
    });
    if (!caller?.companyId) throw new ForbiddenException('You are not part of a company');
    return this.prisma.user.findMany({
      where: { companyId: caller.companyId },
      select: MEMBER_SELECT,
      orderBy: [{ companyRole: 'asc' }, { firstName: 'asc' }],
    });
  }

  /** Invite a new user to the company or link an existing user */
  async inviteMember(callerId: string, dto: InviteMemberDto) {
    const { companyId } = await this.assertCanManage(callerId);

    // Check if user with this email already exists
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing) {
      if (existing.companyId && existing.companyId !== companyId) {
        throw new ConflictException('This user already belongs to another company');
      }
      if (existing.companyId === companyId) {
        throw new ConflictException('This user is already a member of your company');
      }
      // Link existing user to company
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          companyId,
          companyRole: 'MEMBER',
          permCreateContracts: dto.permCreateContracts ?? false,
          permReleaseCallOffs: dto.permReleaseCallOffs ?? false,
          permManageOrders: dto.permManageOrders ?? false,
          permViewFinancials: dto.permViewFinancials ?? false,
          permManageTeam: dto.permManageTeam ?? false,
        },
        select: MEMBER_SELECT,
      });
      return { member: updated, isNew: false };
    }

    // Generate temp password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const member = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        password: hashedPassword,
        userType: 'BUYER',
        status: 'ACTIVE',
        companyId,
        companyRole: 'MEMBER',
        permCreateContracts: dto.permCreateContracts ?? false,
        permReleaseCallOffs: dto.permReleaseCallOffs ?? false,
        permManageOrders: dto.permManageOrders ?? false,
        permViewFinancials: dto.permViewFinancials ?? false,
        permManageTeam: dto.permManageTeam ?? false,
      },
      select: MEMBER_SELECT,
    });

    // Send invite email (non-blocking)
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    this.email
      .sendWelcome(dto.email, dto.firstName)
      .catch(() => null);

    return { member, isNew: true, tempPassword };
  }

  /** Update a member's permission flags */
  async updatePermissions(callerId: string, targetUserId: string, dto: UpdatePermissionsDto) {
    const { companyId } = await this.assertCanManage(callerId);

    // Ensure target is in same company
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true, companyRole: true },
    });
    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('Member not found in your company');
    }
    if (target.companyRole === 'OWNER') {
      throw new BadRequestException('Cannot change permissions for the company owner');
    }

    const updateData: Record<string, boolean> = {};
    if (dto.permCreateContracts !== undefined) updateData.permCreateContracts = dto.permCreateContracts;
    if (dto.permReleaseCallOffs !== undefined) updateData.permReleaseCallOffs = dto.permReleaseCallOffs;
    if (dto.permManageOrders !== undefined) updateData.permManageOrders = dto.permManageOrders;
    if (dto.permViewFinancials !== undefined) updateData.permViewFinancials = dto.permViewFinancials;
    if (dto.permManageTeam !== undefined) updateData.permManageTeam = dto.permManageTeam;
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: MEMBER_SELECT,
    });
  }

  /** Remove a member from the company (sets companyId + permissions to null/false) */
  async removeMember(callerId: string, targetUserId: string) {
    if (callerId === targetUserId) throw new BadRequestException('You cannot remove yourself');
    const { companyId } = await this.assertCanManage(callerId);

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true, companyRole: true },
    });
    if (!target || target.companyId !== companyId) {
      throw new NotFoundException('Member not found in your company');
    }
    if (target.companyRole === 'OWNER') {
      throw new BadRequestException('Cannot remove the company owner');
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        companyId: null,
        companyRole: null,
        permCreateContracts: false,
        permReleaseCallOffs: false,
        permManageOrders: false,
        permViewFinancials: false,
        permManageTeam: false,
      },
    });
    return { ok: true };
  }
}
