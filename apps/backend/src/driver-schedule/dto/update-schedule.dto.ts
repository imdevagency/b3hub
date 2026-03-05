import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScheduleDayDto {
  /** 0 = Sunday … 6 = Saturday */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  enabled!: boolean;

  /** HH:mm format, e.g. "07:00" */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:mm' })
  startTime!: string;

  /** HH:mm format, e.g. "18:00" */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:mm' })
  endTime!: string;
}

export class UpdateScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  days!: ScheduleDayDto[];

  @IsOptional()
  @IsBoolean()
  autoSchedule?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxJobsPerDay?: number | null;
}
