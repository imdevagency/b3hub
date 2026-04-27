import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

export class AmendSkipHireDto {
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['AM', 'PM', 'ANY'])
  deliveryWindow?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}
