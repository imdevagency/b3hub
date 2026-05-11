import { Module } from '@nestjs/common';
import { SupplierLocationsService } from './supplier-locations.service';
import { SupplierLocationsController } from './supplier-locations.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierLocationsController],
  providers: [SupplierLocationsService],
  exports: [SupplierLocationsService],
})
export class SupplierLocationsModule {}
