/**
 * Company controller — /api/v1/company
 * Endpoints to create or update a company profile and retrieve company details.
 */
import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Company')
@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // ── Company profile ────────────────────────────────────────────────────────

  @Get('me')
  getMyCompany(@CurrentUser() user: RequestingUser) {
    return this.companyService.getMyCompany(user);
  }

  @Patch('me')
  updateMyCompany(
    @CurrentUser() user: RequestingUser,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.updateMyCompany(user, dto);
  }

  // ── Team members ───────────────────────────────────────────────────────────

  @Get('me/members')
  getMembers(@CurrentUser() user: RequestingUser) {
    return this.companyService.getMembers(user);
  }

  @Post('me/members')
  inviteMember(
    @CurrentUser() user: RequestingUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.companyService.inviteMember(user, dto);
  }

  @Patch('me/members/:memberId')
  updateMember(
    @CurrentUser() user: RequestingUser,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.companyService.updateMember(user, memberId, dto);
  }

  @Delete('me/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: RequestingUser,
    @Param('memberId') memberId: string,
  ) {
    return this.companyService.removeMember(user, memberId);
  }
}
