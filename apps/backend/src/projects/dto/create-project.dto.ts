import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  siteAddress?: string;

  @IsNumber()
  @Min(0)
  contractValue!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  budgetAmount?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
