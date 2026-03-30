import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { UserStatus, UserType } from '@prisma/client';

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
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  // BuyerProfile fields
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number | null;

  @IsOptional()
  @IsString()
  paymentTerms?: string | null;
}
