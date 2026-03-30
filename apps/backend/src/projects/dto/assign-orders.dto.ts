import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class AssignOrdersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderIds!: string[];
}
