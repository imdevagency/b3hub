import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  // Exactly one of these must be provided
  @IsString()
  @IsOptional()
  orderId?: string;

  @IsString()
  @IsOptional()
  skipOrderId?: string;
}
