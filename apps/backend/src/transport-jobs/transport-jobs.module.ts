import { Module } from '@nestjs/common';
import { TransportJobsService } from './transport-jobs.service';
import { TransportJobsController } from './transport-jobs.controller';

@Module({
  controllers: [TransportJobsController],
  providers: [TransportJobsService],
  exports: [TransportJobsService],
})
export class TransportJobsModule {}
