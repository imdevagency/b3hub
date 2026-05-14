import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateLoadingSlotDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  /** Day of week: 0 = Sunday, 1 = Monday … 6 = Saturday */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  /** "HH:mm" e.g. "08:00" */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  /** "HH:mm" e.g. "10:00" */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  /** How many trucks can load simultaneously in this window */
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  label?: string;
}
