import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
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
  @MaxLength(72)
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

  /**
   * Must be true — the user explicitly accepted the Terms of Service and Privacy Policy.
   * Stored as a timestamp to satisfy GDPR Art. 7 and Apple guideline 5.1.1.
   */
  @IsBoolean()
  termsAccepted: boolean;
}
