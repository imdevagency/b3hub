import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetRadiusDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  radiusKm?: number | null;
}
