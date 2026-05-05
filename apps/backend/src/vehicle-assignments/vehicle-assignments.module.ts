import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VehicleAssignmentsController } from './vehicle-assignments.controller';
import { VehicleAssignmentsService } from './vehicle-assignments.service';

@Module({
  imports: [PrismaModule],
  controllers: [VehicleAssignmentsController],
  providers: [VehicleAssignmentsService],
  exports: [VehicleAssignmentsService],
})
export class VehicleAssignmentsModule {}
