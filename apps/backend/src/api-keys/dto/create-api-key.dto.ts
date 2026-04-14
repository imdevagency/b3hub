import { IsString, IsArray, IsOptional, ArrayMinSize, IsDateString } from 'class-validator';

const VALID_SCOPES = [
  'orders:read',
  'orders:write',
  'invoices:read',
  'transport:read',
  'materials:read',
] as const;

export type ApiKeyScope = (typeof VALID_SCOPES)[number];

export class CreateApiKeyDto {
  @IsString()
  label: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes: ApiKeyScope[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
