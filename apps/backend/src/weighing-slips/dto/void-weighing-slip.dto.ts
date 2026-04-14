import { IsString, IsOptional } from 'class-validator';

export class VoidWeighingSlipDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  operatorName?: string;
}
