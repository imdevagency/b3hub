import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateWeighingSlipDto {
  @IsString()
  fieldPassId!: string;

  @IsNumber()
  @IsPositive()
  grossTonnes!: number;

  @IsNumber()
  @Min(0)
  tareTonnes!: number;

  @IsString()
  vehiclePlate!: string;

  @IsOptional()
  @IsString()
  operatorName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
