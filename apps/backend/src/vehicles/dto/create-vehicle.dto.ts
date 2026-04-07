import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { VehicleType, VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString()
  @MinLength(1)
  make: string;

  @IsString()
  @MinLength(1)
  model: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  year: number;

  @IsString()
  @MinLength(2)
  licensePlate: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Load capacity in tonnes */
  @IsNumber()
  @Min(0)
  capacity: number;

  /** Total permitted gross weight in tonnes */
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxGrossWeight?: number;

  /** Volume capacity in m³ */
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeCapacity?: number;

  /** Drive type: '4WD', 'AWD', '2WD', etc. */
  @IsOptional()
  @IsString()
  driveType?: string;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  /** Insurance certificate expiry date (ISO 8601 string). */
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;

  /** Technical inspection (roadworthy) certificate expiry date (ISO 8601 string). */
  @IsOptional()
  @IsDateString()
  inspectionExpiry?: string;
}
