import { IsEnum } from 'class-validator';
import { SkipHireStatus } from '@prisma/client';

export class UpdateSkipHireStatusDto {
  @IsEnum(SkipHireStatus)
  status: SkipHireStatus;
}
