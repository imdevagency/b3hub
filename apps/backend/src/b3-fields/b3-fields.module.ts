import { Module } from '@nestjs/common';
import { B3FieldsController } from './b3-fields.controller';
import { B3FieldsService } from './b3-fields.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [B3FieldsController],
  providers: [B3FieldsService],
  exports: [B3FieldsService],
})
export class B3FieldsModule {}
