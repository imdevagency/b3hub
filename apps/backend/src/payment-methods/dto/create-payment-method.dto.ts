import { IsString, IsInt, IsBoolean, IsOptional, Min, Max, Length } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @Length(1, 100)
  label: string;

  @IsString()
  @Length(1, 20)
  cardType: string; // "VISA" | "MASTERCARD" | "MAESTRO" | "OTHER"

  @IsString()
  @Length(4, 4)
  last4: string;

  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth: number;

  @IsInt()
  @Min(2024)
  @Max(2099)
  expiryYear: number;

  @IsString()
  @Length(1, 512)
  payseraToken: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
