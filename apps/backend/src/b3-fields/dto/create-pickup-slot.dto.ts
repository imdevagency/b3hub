import {
  IsString,
  IsISO8601,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreatePickupSlotDto {
  @IsString()
  fieldId: string;

  @IsISO8601()
  slotStart: string;

  @IsISO8601()
  slotEnd: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  capacity?: number;
}
