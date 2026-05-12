import { IsNumber, IsLatitude, IsLongitude } from 'class-validator';

export class UpdateSkipHireLocationDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}
