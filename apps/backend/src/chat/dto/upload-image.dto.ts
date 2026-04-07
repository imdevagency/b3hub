import { IsIn, IsNotEmpty, IsString } from 'class-validator';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export class UploadImageDto {
  /** Base64-encoded image (data URI or raw base64). */
  @IsString()
  @IsNotEmpty()
  base64: string;

  /** MIME type of the image. Must be one of the allowed image types. */
  @IsIn(ALLOWED_IMAGE_TYPES)
  mimeType: string;
}
