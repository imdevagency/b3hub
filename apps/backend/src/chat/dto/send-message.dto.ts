import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  body?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  imageUrl?: string;
}
