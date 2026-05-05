import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { WasteType } from '@prisma/client';

export class CreateWasteDeclarationDto {
  @IsEnum(WasteType)
  wasteType!: WasteType;

  @IsNumber()
  @Min(0.1)
  estimatedTonnes!: number;

  @IsDateString()
  availableFrom!: string;

  @IsDateString()
  availableTo!: string;

  @IsOptional()
  @IsBoolean()
  willingToSell?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
