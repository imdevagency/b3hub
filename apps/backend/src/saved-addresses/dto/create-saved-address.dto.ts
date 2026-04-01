import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSavedAddressDto {
  @IsString()
  @MaxLength(80)
  label: string;

  @IsString()
  @MaxLength(300)
  address: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
