import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedAddressDto } from './create-saved-address.dto';

export class UpdateSavedAddressDto extends PartialType(CreateSavedAddressDto) {}
