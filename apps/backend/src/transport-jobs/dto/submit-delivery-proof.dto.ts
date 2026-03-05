import { IsString, IsOptional, IsArray } from 'class-validator';

export class SubmitDeliveryProofDto {
  @IsString()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsOptional()
  photos?: string[];
}
