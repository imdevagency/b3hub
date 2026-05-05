import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EquipmentType, EquipmentStatus, BuContext } from '@prisma/client';

export class CreateEquipmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(EquipmentType)
  type: EquipmentType;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  yearManufactured: number;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @IsEnum(BuContext)
  buContext?: BuContext;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  assignedProject?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
