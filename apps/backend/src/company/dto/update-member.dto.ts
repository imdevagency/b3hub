import { IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { CompanyRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(CompanyRole)
  companyRole?: CompanyRole;

  @IsOptional()
  @IsBoolean()
  canTransport?: boolean;

  @IsOptional()
  @IsBoolean()
  canSell?: boolean;
}
