import { IsEnum } from 'class-validator';
import { ToiletCabinStatus } from '@prisma/client';

export class UpdateToiletCabinStatusDto {
  @IsEnum(ToiletCabinStatus)
  status: ToiletCabinStatus;
}
