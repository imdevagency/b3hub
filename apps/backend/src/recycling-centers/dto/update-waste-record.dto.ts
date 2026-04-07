import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
  @IsString()
  @MaxLength(50)
  producedMaterialId?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  certificateUrl?: string;
}
