import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CarrierSettingsController } from './carrier-settings.controller';
import { CarrierSettingsService } from './carrier-settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [CarrierSettingsController],
  providers: [CarrierSettingsService],
  exports: [CarrierSettingsService],
})
export class CarrierSettingsModule {}
