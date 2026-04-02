import { Module } from '@nestjs/common';
import { TransportJobsService } from './transport-jobs.service';
import { TransportJobsController } from './transport-jobs.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { UpdatesModule } from '../updates/updates.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [NotificationsModule, DocumentsModule, UpdatesModule, EmailModule],
  controllers: [TransportJobsController],
  providers: [TransportJobsService],
  exports: [TransportJobsService],
})
export class TransportJobsModule {}
