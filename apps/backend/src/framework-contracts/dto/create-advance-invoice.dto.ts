import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

export class CreateAdvanceInvoiceDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
