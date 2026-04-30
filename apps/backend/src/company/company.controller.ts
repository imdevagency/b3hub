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
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

import { ApiTags } from '@nestjs/swagger';

@ApiTags('Company')
@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // ── UR public company lookup ───────────────────────────────────────────────

  /** Public: look up a Latvian company by registration number via the UR open data API.
   *  Does not require authentication. */
  @Get('lookup/ur')
  @UseGuards(OptionalJwtAuthGuard)
  async lookupUr(@Query('regcode') regcode: string) {
    if (!regcode || regcode.replace(/\D/g, '').length !== 11) {
      throw new BadRequestException(
        'regcode must be an 11-digit Latvian registration number',
      );
    }
    const result = await this.companyService.lookupByRegcode(regcode);
    if (!result) return { found: false };
    return { found: true, ...result };
  }

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

  @Post('me/logo')
  uploadLogo(
    @CurrentUser() user: RequestingUser,
    @Body() dto: { base64: string; mimeType: string },
  ) {
    if (!user.companyId) {
      throw new ForbiddenException('You are not associated with a company');
    }
    return this.companyService.uploadLogo(
      user.companyId,
      dto.base64,
      dto.mimeType,
      user,
    );
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
