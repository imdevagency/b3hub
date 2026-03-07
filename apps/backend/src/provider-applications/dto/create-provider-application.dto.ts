import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateProviderApplicationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(2)
  companyName: string;

  @IsOptional()
  @IsString()
  regNumber?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsBoolean()
  appliesForSell: boolean;

  @IsBoolean()
  appliesForTransport: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  /** Set if the applicant is already a registered user */
  @IsOptional()
  @IsString()
  userId?: string;
}
