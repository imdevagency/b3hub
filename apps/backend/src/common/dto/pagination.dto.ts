import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Shared DTO for paginated list endpoints.
 * Use @Query() paginationDto: PaginationDto on controllers.
 * ValidationPipe with transform:true will coerce string query params to numbers.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}

export class PagePaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
