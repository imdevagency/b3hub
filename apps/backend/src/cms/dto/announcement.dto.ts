import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AnnouncementSeverity, AnnouncementTarget } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsEnum(AnnouncementSeverity)
  severity?: AnnouncementSeverity;

  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;

  @IsOptional()
  @IsString()
  visibleFrom?: string; // ISO string

  @IsOptional()
  @IsString()
  visibleUntil?: string; // ISO string
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(AnnouncementSeverity)
  severity?: AnnouncementSeverity;

  @IsOptional()
  @IsEnum(AnnouncementTarget)
  target?: AnnouncementTarget;

  @IsOptional()
  @IsString()
  visibleFrom?: string;

  @IsOptional()
  @IsString()
  visibleUntil?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
