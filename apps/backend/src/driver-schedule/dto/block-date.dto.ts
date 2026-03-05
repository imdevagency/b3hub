import { IsDateString, IsOptional, IsString } from 'class-validator';

export class BlockDateDto {
  /** ISO date string e.g. "2026-03-10" */
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
