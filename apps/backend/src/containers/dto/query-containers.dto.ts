import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ContainerSize, ContainerType } from '@prisma/client';

export class QueryContainersDto {
  @IsOptional()
  @IsEnum(ContainerType)
  containerType?: ContainerType;

  @IsOptional()
  @IsEnum(ContainerSize)
  size?: ContainerSize;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  minVolume?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  maxPrice?: number; // max rentalPrice per day

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}
