import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { CompanyRole } from '@prisma/client';

export class InviteMemberDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(CompanyRole)
  companyRole: CompanyRole;

  @IsOptional()
  @IsBoolean()
  canTransport?: boolean;

  @IsOptional()
  @IsBoolean()
  canSell?: boolean;
}
