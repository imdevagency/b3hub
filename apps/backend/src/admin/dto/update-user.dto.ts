import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
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
}
