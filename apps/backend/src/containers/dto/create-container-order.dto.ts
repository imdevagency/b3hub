import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { WastePurpose, WasteType } from '@prisma/client';

export class CreateContainerOrderDto {
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNumber()
  @IsPositive()
  rentalDays!: number;

  @IsEnum(WastePurpose)
  purpose!: WastePurpose;

  @IsOptional()
  @IsEnum(WasteType)
  wasteType?: WasteType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimatedWeight?: number; // tonnes

  // Delivery address
  @IsString()
  deliveryAddress!: string;

  @IsString()
  deliveryCity!: string;

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

  @IsOptional()
  @IsString()
  notes?: string;
}
