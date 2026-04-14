import {
  IsString,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreateFieldPassDto {
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @IsString()
  @IsNotEmpty()
  vehiclePlate: string;

  @IsString()
  @IsOptional()
  driverName?: string;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;

  @IsString()
  @IsOptional()
  wasteClassCode?: string;

  @IsString()
  @IsOptional()
  wasteDescription?: string;

  @IsString()
  @IsOptional()
  unloadingPoint?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedTonnes?: number;

  @IsString()
  @IsOptional()
  orderId?: string;
}
