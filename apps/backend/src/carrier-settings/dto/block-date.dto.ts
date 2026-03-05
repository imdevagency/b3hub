import { IsDateString, IsOptional, IsString } from 'class-validator';

export class BlockDateDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
