import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class ReportDelayDto {
  @IsInt()
  @Min(1)
  @Max(480)
  estimatedDelayMinutes: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
