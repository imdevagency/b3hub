import { IsDateString, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class GetQuotesQueryDto {
  @IsString()
  @MinLength(2)
  size: string;

  @IsString()
  @MinLength(2)
  location: string;

  @IsDateString()
  date: string;

  /** Optional buyer latitude — enables radius-based coverage checks. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  /** Optional buyer longitude — enables radius-based coverage checks. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
