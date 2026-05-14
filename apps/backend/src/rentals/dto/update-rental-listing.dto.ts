import { PartialType } from '@nestjs/mapped-types';
import { CreateRentalListingDto } from './create-rental-listing.dto';

export class UpdateRentalListingDto extends PartialType(CreateRentalListingDto) {}
