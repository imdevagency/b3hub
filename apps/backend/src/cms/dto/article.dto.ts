import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CmsArticleType, CmsStatus } from '@prisma/client';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsEnum(CmsArticleType)
  type?: CmsArticleType;

  @IsOptional()
  @IsEnum(CmsStatus)
  status?: CmsStatus;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  translationKey?: string;

  @IsOptional()
  @IsString()
  pageKey?: string;

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsEnum(CmsArticleType)
  type?: CmsArticleType;

  @IsOptional()
  @IsEnum(CmsStatus)
  status?: CmsStatus;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  translationKey?: string;

  @IsOptional()
  @IsString()
  pageKey?: string;

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
