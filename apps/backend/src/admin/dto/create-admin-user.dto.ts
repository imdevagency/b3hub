import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CompanyType, UserType } from '@prisma/client';

export class CreateAdminUserCompanyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  regNumber?: string;

  @IsEnum(CompanyType)
  companyType: CompanyType;
}

export class CreateAdminUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

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
  @IsBoolean()
  isCompany?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAdminUserCompanyDto)
  company?: CreateAdminUserCompanyDto;
}
