import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierLocationDto } from './create-supplier-location.dto';

export class UpdateSupplierLocationDto extends PartialType(CreateSupplierLocationDto) {}
