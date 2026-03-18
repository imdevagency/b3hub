import {
  IsEmail,
  IsString,
  IsBoolean,
  IsOptional,
  MinLength,
} from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  // Initial permissions
  @IsBoolean()
  @IsOptional()
  permCreateContracts?: boolean;

  @IsBoolean()
  @IsOptional()
  permReleaseCallOffs?: boolean;

  @IsBoolean()
  @IsOptional()
  permManageOrders?: boolean;

  @IsBoolean()
  @IsOptional()
  permViewFinancials?: boolean;

  @IsBoolean()
  @IsOptional()
  permManageTeam?: boolean;
}
