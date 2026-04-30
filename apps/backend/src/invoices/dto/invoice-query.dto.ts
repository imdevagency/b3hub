import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PagePaginationDto } from '../../common/dto/pagination.dto';

export class InvoiceQueryDto extends PagePaginationDto {
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'])
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

  @IsOptional()
  @IsDateString()
  updatedSince?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
