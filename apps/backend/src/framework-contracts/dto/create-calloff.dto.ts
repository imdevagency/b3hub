import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCallOffDto {
  /** Actual quantity for this call-off (tonnes / m3 / loads) */
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsDateString()
  pickupDate: string;

  @IsDateString()
  deliveryDate: string;

  /** Override pickup address from position default */
  @IsString()
  @IsOptional()
  pickupAddress?: string;

  @IsString()
  @IsOptional()
  pickupCity?: string;

  /** Override delivery address from position default */
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @IsOptional()
  deliveryCity?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
