import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CompanyRole, UserStatus, UserType } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsBoolean()
  canSell?: boolean;

  @IsOptional()
  @IsBoolean()
  canTransport?: boolean;

  @IsOptional()
  @IsBoolean()
  canSkipHire?: boolean;

  @IsOptional()
  @IsBoolean()
  canRecycle?: boolean;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  // Company linking — admin assigns user to an existing company
  @IsOptional()
  @IsString()
  companyId?: string | null;

  @IsOptional()
  @IsEnum(CompanyRole)
  companyRole?: CompanyRole | null;

  // BuyerProfile fields
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @IsString()
  paymentTerms?: string | null;
}
