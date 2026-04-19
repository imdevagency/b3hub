import { IsOptional, IsString, MaxLength } from 'class-validator';

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
