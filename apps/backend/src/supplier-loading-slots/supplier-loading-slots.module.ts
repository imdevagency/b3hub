import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierLoadingSlotsController } from './supplier-loading-slots.controller';
import { SupplierLoadingSlotsService } from './supplier-loading-slots.service';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierLoadingSlotsController],
  providers: [SupplierLoadingSlotsService],
  exports: [SupplierLoadingSlotsService],
})
export class SupplierLoadingSlotsModule {}
