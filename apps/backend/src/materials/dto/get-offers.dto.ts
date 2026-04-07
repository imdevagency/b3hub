import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory } from '@prisma/client';

export class GetOffersDto {
  @IsEnum(MaterialCategory)
  category: MaterialCategory;

  @IsNumber()
  @Min(0.1)
  @Max(1_000_000)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng?: number;
}
