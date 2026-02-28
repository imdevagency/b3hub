import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserType } from '@prisma/client';

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

  @IsEnum(UserType)
  userType: UserType;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
