import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ExtendSkipHireDto {
  /** Number of additional days to add to the hire period (1–90). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  additionalDays!: number;
}
