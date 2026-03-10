import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
} from 'class-validator';

const VALID_ROLES = ['BUYER', 'SUPPLIER', 'CARRIER'] as const;

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  /**
   * Roles the user wants on this account.
   * BUYER is always implied. SUPPLIER/CARRIER trigger a pending provider application.
   */
  @IsOptional()
  @IsArray()
  @IsIn(VALID_ROLES, { each: true })
  roles?: string[];

  @IsOptional()
  @IsBoolean()
  isCompany?: boolean;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Company name — required when roles includes SUPPLIER or CARRIER */
  @IsOptional()
  @IsString()
  companyName?: string;

  /** Company registration number (optional) */
  @IsOptional()
  @IsString()
  regNumber?: string;
}
