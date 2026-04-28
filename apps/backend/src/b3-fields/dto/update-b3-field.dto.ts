import { PartialType } from '@nestjs/mapped-types';
import { CreateB3FieldDto } from './create-b3-field.dto';

export class UpdateB3FieldDto extends PartialType(CreateB3FieldDto) {}
