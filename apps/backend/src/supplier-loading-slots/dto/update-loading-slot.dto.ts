import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateLoadingSlotDto } from './create-loading-slot.dto';

export class UpdateLoadingSlotDto extends PartialType(
  OmitType(CreateLoadingSlotDto, ['companyId'] as const),
) {}
