import {
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';
import { SurchargeType } from '@prisma/client';

export class CreateSurchargeDto {
  @IsEnum(SurchargeType)
  type: SurchargeType;

  @IsString()
  label: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsBoolean()
  @IsOptional()
  billable?: boolean;
}
