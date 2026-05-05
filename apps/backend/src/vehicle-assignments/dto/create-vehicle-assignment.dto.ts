import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { BuContext, VehicleJobType } from '@prisma/client';

export class CreateVehicleAssignmentDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsEnum(VehicleJobType)
  jobType: VehicleJobType;

  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsEnum(BuContext)
  buContext: BuContext;

  @IsDateString()
  startedAt: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
