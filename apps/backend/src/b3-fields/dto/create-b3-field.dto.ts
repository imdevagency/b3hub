import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  IsObject,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { B3FieldService } from '@prisma/client';

export class CreateB3FieldDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  slug: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  postalCode: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsArray()
  @IsEnum(B3FieldService, { each: true })
  services: B3FieldService[];

  @IsObject()
  openingHours: Record<string, { open: string; close: string } | null>;

  @IsOptional()
  @IsString()
  recyclingCenterId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
