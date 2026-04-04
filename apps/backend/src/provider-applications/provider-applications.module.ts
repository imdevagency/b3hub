import { Module } from '@nestjs/common';
import { ProviderApplicationsController } from './provider-applications.controller';
import { ProviderApplicationsService } from './provider-applications.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ProviderApplicationsController],
  providers: [ProviderApplicationsService],
})
export class ProviderApplicationsModule {}
