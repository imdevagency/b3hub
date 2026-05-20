import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
