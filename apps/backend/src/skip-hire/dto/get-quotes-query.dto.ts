import { IsDateString, IsEnum, IsString, MinLength } from 'class-validator';
import { SkipSize } from '@prisma/client';

export class GetQuotesQueryDto {
  @IsEnum(SkipSize)
  size: SkipSize;

  @IsString()
  @MinLength(2)
  location: string;

  @IsDateString()
  date: string;
}
