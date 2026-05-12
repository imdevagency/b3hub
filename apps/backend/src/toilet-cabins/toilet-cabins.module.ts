import { Module } from '@nestjs/common';
import { ToiletCabinsService } from './toilet-cabins.service';
import { ToiletCabinsController } from './toilet-cabins.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [ToiletCabinsController],
  providers: [ToiletCabinsService],
  exports: [ToiletCabinsService],
})
export class ToiletCabinsModule {}
