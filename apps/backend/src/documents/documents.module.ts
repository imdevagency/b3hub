import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsExpiryScheduler } from './documents-expiry.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, SupabaseModule, NotificationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsExpiryScheduler],
  exports: [DocumentsService],
})
export class DocumentsModule {}
