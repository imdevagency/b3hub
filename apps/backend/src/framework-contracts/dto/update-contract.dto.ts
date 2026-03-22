import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FrameworkContractStatus } from '@prisma/client';

export class UpdateFrameworkContractDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsEnum(FrameworkContractStatus)
  @IsOptional()
  status?: FrameworkContractStatus;
}
