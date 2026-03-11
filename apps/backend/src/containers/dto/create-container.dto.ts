import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ContainerSize, ContainerType } from '@prisma/client';

export class CreateContainerDto {
  @IsEnum(ContainerType)
  containerType: ContainerType;

  @IsEnum(ContainerSize)
  size: ContainerSize;

  @IsNumber()
  @IsPositive()
  volume: number; // m³

  @IsNumber()
  @IsPositive()
  maxWeight: number; // tonnes

  @IsNumber()
  @Min(0)
  rentalPrice: number; // per day

  @IsNumber()
  @Min(0)
  deliveryFee: number;

  @IsNumber()
  @Min(0)
  pickupFee: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
