import { IsString, IsNotEmpty } from 'class-validator';

export class RevokeFieldPassDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
