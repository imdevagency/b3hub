import { IsString, IsDateString, IsOptional, IsArray, ValidateNested, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FrameworkPositionType } from '@prisma/client';

export class CreatePositionDto {
  @IsEnum(FrameworkPositionType)
  positionType!: FrameworkPositionType;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0.01)
  agreedQty!: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsString()
  @IsOptional()
  pickupAddress?: string;

  @IsString()
  @IsOptional()
  pickupCity?: string;

  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  deliveryCity?: string;
}

export class CreateFrameworkContractDto {
  @IsString()
  title!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePositionDto)
  @IsOptional()
  positions?: CreatePositionDto[];
}
