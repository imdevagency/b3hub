import {
  IsArray,
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
import { Type } from 'class-transformer';
import { WasteType } from '@prisma/client';

class CoordinatesDto {
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
}

export class CreateRecyclingCenterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  // Location
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  address!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  state!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  postalCode!: string;

  @IsOptional()
  @IsObject()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;

  // Capabilities
  @IsArray()
  @IsEnum(WasteType, { each: true })
  acceptedWasteTypes!: WasteType[];

  @IsNumber()
  @Min(0)
  @Max(100_000)
  capacity!: number; // tonnes per day

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  certifications?: string[];

  // Operating hours: {monday: {open: '08:00', close: '17:00'}, ...}
  @IsObject()
  operatingHours!: Record<string, { open: string; close: string } | null>;
}
