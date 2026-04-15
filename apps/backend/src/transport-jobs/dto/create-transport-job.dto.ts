import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TransportJobType, VehicleType } from '@prisma/client';

export class CreateTransportJobDto {
  @IsEnum(TransportJobType)
  jobType!: TransportJobType;

  // Pickup
  @IsString()
  @MaxLength(300)
  pickupAddress!: string;

  @IsString()
  @MaxLength(100)
  pickupCity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pickupState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pickupPostal?: string;

  @IsDateString()
  pickupDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pickupWindow?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng?: number;

  // Delivery
  @IsString()
  @MaxLength(300)
  deliveryAddress!: string;

  @IsString()
  @MaxLength(100)
  deliveryCity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  deliveryPostal?: string;

  @IsDateString()
  deliveryDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryWindow?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng?: number;

  // Cargo
  @IsString()
  @MaxLength(200)
  cargoType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  cargoWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  cargoVolume?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specialRequirements?: string;

  // Vehicle requirement
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requiredVehicleType?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  requiredVehicleEnum?: VehicleType;

  // Distance
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50_000)
  distanceKm?: number;

  // Pricing
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  pricePerTonne?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000_000)
  buyerOfferedRate?: number;

  // Optional link to an existing order
  @IsOptional()
  @IsUUID()
  orderId?: string;

  // Optional project tag (disposal and standalone freight jobs)
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
