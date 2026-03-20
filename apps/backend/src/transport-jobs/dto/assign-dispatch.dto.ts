import { IsOptional, IsString } from 'class-validator';

export class AssignDispatchDto {
  @IsString()
  driverId: string;

  @IsOptional()
  @IsString()
  vehicleId?: string;
}

export class UnassignDispatchDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
