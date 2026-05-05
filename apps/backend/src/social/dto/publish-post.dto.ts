import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export type SocialPlatform = 'META' | 'LINKEDIN' | 'GOOGLE' | 'TIKTOK';

const VALID_PLATFORMS: SocialPlatform[] = ['META', 'LINKEDIN', 'GOOGLE', 'TIKTOK'];

export class PublishSocialPostDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsArray()
  @IsIn(VALID_PLATFORMS, { each: true })
  platforms: SocialPlatform[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
