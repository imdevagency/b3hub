import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

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

  /** 'FULL' | 'PARTIAL' | 'DAMAGED' */
  @IsString()
  @IsOptional()
  loadCondition?: string;

  @IsBoolean()
  @IsOptional()
  isPartialLoad?: boolean;

  @IsBoolean()
  @IsOptional()
  hasDamage?: boolean;

  @IsString()
  @IsOptional()
  damageNote?: string;

  @IsBoolean()
  @IsOptional()
  gradeConfirmed?: boolean;

  /** SVG path data of the recipient signature, serialized as a minimal SVG string */
  @IsString()
  @IsOptional()
  signatureSvg?: string;
}
