import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { WasteType } from '@prisma/client';

export enum DisposalTruckType {
  TIPPER_SMALL = 'TIPPER_SMALL', // 10 t / 8 m³
  TIPPER_LARGE = 'TIPPER_LARGE', // 18 t / 12 m³
  ARTICULATED_TIPPER = 'ARTICULATED_TIPPER', // 26 t / 18 m³
}

export class CreateDisposalOrderDto {
  @IsString()
  pickupAddress!: string;

  @IsString()
  pickupCity!: string;

  @IsString()
  @IsOptional()
  pickupState?: string;

  @IsString()
  @IsOptional()
  pickupPostal?: string;

  @IsNumber()
  @IsOptional()
  pickupLat?: number;

  @IsNumber()
  @IsOptional()
  pickupLng?: number;

  @IsEnum(WasteType)
  wasteType!: WasteType;

  @IsEnum(DisposalTruckType)
  truckType!: DisposalTruckType;

  @IsInt()
  @Min(1)
  truckCount!: number;

  @IsNumber()
  @Min(0.1)
  estimatedWeight!: number; // tonnes

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  requestedDate!: string; // ISO date string
}
