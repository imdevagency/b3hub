import { IsISO8601 } from 'class-validator';

export class ScheduleArrivalDto {
  @IsISO8601()
  plannedArrivalAt: string;
}
