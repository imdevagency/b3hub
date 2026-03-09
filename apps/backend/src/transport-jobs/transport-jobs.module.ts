import { Module } from '@nestjs/common';
import { TransportJobsService } from './transport-jobs.service';
import { TransportJobsController } from './transport-jobs.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [TransportJobsController],
  providers: [TransportJobsService],
  exports: [TransportJobsService],
})
export class TransportJobsModule {}
