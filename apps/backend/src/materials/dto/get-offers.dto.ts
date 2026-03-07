import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialCategory } from '@prisma/client';

export class GetOffersDto {
  @IsEnum(MaterialCategory)
  category: MaterialCategory;

  @IsNumber()
  @Min(0.1)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  lng?: number;
}
