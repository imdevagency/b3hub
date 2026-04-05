import { Module } from '@nestjs/common';
import { QuoteRequestsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
@Module({
  imports: [PrismaModule, NotificationsModule, EmailModule],
  controllers: [QuoteRequestsController],
  providers: [QuoteRequestsService],
  exports: [QuoteRequestsService],
})
export class QuoteRequestsModule {}
