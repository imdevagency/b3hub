import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SetPriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}
