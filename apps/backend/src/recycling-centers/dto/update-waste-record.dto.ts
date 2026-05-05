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
import { WasteProcessingStage, RcGrade } from '@prisma/client';

export class UpdateWasteRecordDto {
  @IsOptional()
  @IsDateString()
  processedDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recyclableWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  recyclingRate?: number;

  @IsOptional()
  @IsEnum(WasteProcessingStage)
  processingStage?: WasteProcessingStage;

  @IsOptional()
  @IsEnum(RcGrade)
  rcGrade?: RcGrade;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weighbridgeTicketRef?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  weighbridgePhotoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  producedMaterialId?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  certificateUrl?: string;
}
