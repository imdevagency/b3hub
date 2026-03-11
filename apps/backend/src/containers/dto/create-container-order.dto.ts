import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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
  @IsString()
  notes?: string;
}
