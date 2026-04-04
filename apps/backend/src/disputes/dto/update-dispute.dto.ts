import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DisputeStatus } from '@prisma/client';

export class UpdateDisputeDto {
  @IsEnum(DisputeStatus)
  @IsOptional()
  status?: DisputeStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  resolution?: string;
}
