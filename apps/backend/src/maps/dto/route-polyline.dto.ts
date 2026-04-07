import { IsNumber, Max, Min } from 'class-validator';

export class RoutePolylineDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  originLng!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  destLat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  destLng!: number;
}
