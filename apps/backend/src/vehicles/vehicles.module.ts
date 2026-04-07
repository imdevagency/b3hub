import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesComplianceScheduler } from './vehicles-compliance.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesComplianceScheduler],
  exports: [VehiclesService],
})
export class VehiclesModule {}
