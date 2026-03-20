import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TransportExceptionType } from '@prisma/client';

export class ReportTransportExceptionDto {
  @IsEnum(TransportExceptionType)
  type: TransportExceptionType;

  @IsString()
  @MaxLength(1000)
  notes: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  /** Optional operator hint that this needs dispatcher attention */
  @IsOptional()
  @IsBoolean()
  requiresDispatchAction?: boolean;
}

export class ResolveTransportExceptionDto {
  @IsString()
  @MaxLength(1000)
  resolution: string;
}
