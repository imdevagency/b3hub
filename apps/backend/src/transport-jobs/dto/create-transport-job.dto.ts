import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { TransportJobType, VehicleType } from '@prisma/client';

export class CreateTransportJobDto {
  @IsEnum(TransportJobType)
  jobType!: TransportJobType;

  // Pickup
  @IsString()
  pickupAddress!: string;

  @IsString()
  pickupCity!: string;

  @IsOptional()
  @IsString()
  pickupState?: string;

  @IsOptional()
  @IsString()
  pickupPostal?: string;

  @IsDateString()
  pickupDate!: string;

  @IsOptional()
  @IsString()
  pickupWindow?: string;

  @IsOptional()
  @IsNumber()
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  pickupLng?: number;

  // Delivery
  @IsString()
  deliveryAddress!: string;

  @IsString()
  deliveryCity!: string;

  @IsOptional()
  @IsString()
  deliveryState?: string;

  @IsOptional()
  @IsString()
  deliveryPostal?: string;

  @IsDateString()
  deliveryDate!: string;

  @IsOptional()
  @IsString()
  deliveryWindow?: string;

  @IsOptional()
  @IsNumber()
  deliveryLat?: number;

  @IsOptional()
  @IsNumber()
  deliveryLng?: number;

  // Cargo
  @IsString()
  cargoType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cargoVolume?: number;

  @IsOptional()
  @IsString()
  specialRequirements?: string;

  // Vehicle requirement
  @IsOptional()
  @IsString()
  requiredVehicleType?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  requiredVehicleEnum?: VehicleType;

  // Distance
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  // Pricing
  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerTonne?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  buyerOfferedRate?: number;

  // Optional link to an existing order
  @IsOptional()
  @IsString()
  orderId?: string;
}
