import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WasteType } from '@prisma/client';

export class UpdateRecyclingCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsObject()
  coordinates?: { lat: number; lng: number } | null;

  @IsOptional()
  @IsArray()
  @IsEnum(WasteType, { each: true })
  acceptedWasteTypes?: WasteType[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100_000)
  capacity?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  certifications?: string[];

  @IsOptional()
  @IsObject()
  operatingHours?: Record<string, { open: string; close: string } | null>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
