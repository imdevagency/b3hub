import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DriverScheduleController } from './driver-schedule.controller';
import { DriverScheduleService } from './driver-schedule.service';

@Module({
  imports: [PrismaModule],
  controllers: [DriverScheduleController],
  providers: [DriverScheduleService],
  exports: [DriverScheduleService],
})
export class DriverScheduleModule {}
