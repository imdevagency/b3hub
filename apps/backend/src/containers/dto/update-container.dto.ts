import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ContainerSize, ContainerStatus, ContainerType } from '@prisma/client';

export class UpdateContainerDto {
  @IsOptional()
  @IsEnum(ContainerType)
  containerType?: ContainerType;

  @IsOptional()
  @IsEnum(ContainerSize)
  size?: ContainerSize;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  volume?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rentalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pickupFee?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(ContainerStatus)
  status?: ContainerStatus;
}
