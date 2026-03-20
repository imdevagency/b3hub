import { IsNumber } from 'class-validator';

export class RoutePolylineDto {
  @IsNumber()
  originLat!: number;

  @IsNumber()
  originLng!: number;

  @IsNumber()
  destLat!: number;

  @IsNumber()
  destLng!: number;
}
