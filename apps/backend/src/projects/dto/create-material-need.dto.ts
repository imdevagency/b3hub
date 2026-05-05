import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MaterialCategory } from '@prisma/client';

export class CreateMaterialNeedDto {
  @IsEnum(MaterialCategory)
  materialCategory!: MaterialCategory;

  @IsNumber()
  @Min(0.1)
  estimatedTonnes!: number;

  @IsDateString()
  neededFrom!: string;

  @IsDateString()
  neededTo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
