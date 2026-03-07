import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateZoneDto {
  @IsString()
  @MinLength(2)
  city: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  surcharge?: number;
}
