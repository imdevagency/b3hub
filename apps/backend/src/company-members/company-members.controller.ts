import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { CompanyMembersService } from './company-members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Controller('company-members')
@UseGuards(JwtAuthGuard)
export class CompanyMembersController {
  constructor(private readonly service: CompanyMembersService) {}

  /** List all members in the caller's company */
  @Get()
  listMembers(@CurrentUser() user: RequestingUser) {
    return this.service.listMembers(user.userId);
  }

  /** Invite a new member (create account or link existing user) */
  @Post('invite')
  invite(@CurrentUser() user: RequestingUser, @Body() dto: InviteMemberDto) {
    return this.service.inviteMember(user.userId, dto);
  }

  /** Update a member's permission flags */
  @Patch(':userId/permissions')
  updatePermissions(
    @CurrentUser() user: RequestingUser,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.service.updatePermissions(user.userId, targetUserId, dto);
  }

  /** Remove a member from the company */
  @Delete(':userId')
  removeMember(
    @CurrentUser() user: RequestingUser,
    @Param('userId') targetUserId: string,
  ) {
    return this.service.removeMember(user.userId, targetUserId);
  }
}
