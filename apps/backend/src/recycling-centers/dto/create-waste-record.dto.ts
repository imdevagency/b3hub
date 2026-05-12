import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WasteType, WasteProcessingStage, RcGrade } from '@prisma/client';

export class CreateWasteRecordDto {
  // Optional link to a container order
  @IsOptional()
  @IsString()
  @MaxLength(50)
  containerOrderId?: string;

  // Optional link to a disposal order (populates bisNumber automatically)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderId?: string;

  // Waste details
  @IsEnum(WasteType)
  wasteType!: WasteType;

  @IsNumber()
  @Min(0)
  @Max(100_000)
  weight!: number; // tonnes

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  volume?: number; // m³

  // Processing results (can be filled in later via PATCH)
  @IsOptional()
  @IsDateString()
  processedDate?: string; // ISO date string

  @IsOptional()
  @IsNumber()
  @Min(0)
  recyclableWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  recyclingRate?: number; // 0-100 %

  // Output
  @IsOptional()
  @IsString()
  @MaxLength(50)
  producedMaterialId?: string;

  // Processing lifecycle
  @IsOptional()
  @IsEnum(WasteProcessingStage)
  processingStage?: WasteProcessingStage;

  @IsOptional()
  @IsEnum(RcGrade)
  rcGrade?: RcGrade;

  // Weighbridge documentation
  @IsOptional()
  @IsString()
  @MaxLength(100)
  weighbridgeTicketRef?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  weighbridgePhotoUrl?: string;

  // Compliance
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  certificateUrl?: string;
}
