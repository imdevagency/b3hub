import { Module } from '@nestjs/common';
import { FrameworkContractsController } from './framework-contracts.controller';
import { FrameworkContractsService } from './framework-contracts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [PrismaModule, NotificationsModule, InvoicesModule],
  controllers: [FrameworkContractsController],
  providers: [FrameworkContractsService],
})
export class FrameworkContractsModule {}
