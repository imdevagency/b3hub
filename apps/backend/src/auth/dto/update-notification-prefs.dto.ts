import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsBoolean()
  @IsOptional()
  notifPush?: boolean;

  @IsBoolean()
  @IsOptional()
  notifOrderUpdates?: boolean;

  @IsBoolean()
  @IsOptional()
  notifJobAlerts?: boolean;

  @IsBoolean()
  @IsOptional()
  notifMarketing?: boolean;
}
