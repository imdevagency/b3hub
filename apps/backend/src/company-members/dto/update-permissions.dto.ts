import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionsDto {
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

  /** Allow this member to execute transport jobs (driver capability) */
  @IsBoolean()
  @IsOptional()
  canTransport?: boolean;
}
