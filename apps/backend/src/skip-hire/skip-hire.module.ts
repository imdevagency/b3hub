import { Module } from '@nestjs/common';
import { SkipHireService } from './skip-hire.service';
import { SkipHireController } from './skip-hire.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, NotificationsModule, PaymentsModule],
  controllers: [SkipHireController],
  providers: [SkipHireService],
  exports: [SkipHireService],
})
export class SkipHireModule {}
