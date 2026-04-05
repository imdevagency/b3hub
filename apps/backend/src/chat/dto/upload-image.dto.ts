import { IsNotEmpty, IsString } from 'class-validator';

export class UploadImageDto {
  /** Base64-encoded image (data URI or raw base64). */
  @IsString()
  @IsNotEmpty()
  base64: string;

  /** Optional MIME type, e.g. 'image/jpeg'. Defaults to 'image/jpeg'. */
  @IsString()
  @IsNotEmpty()
  mimeType: string;
}
