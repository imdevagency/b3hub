import { Module } from '@nestjs/common';
import { GuestOrdersService } from './guest-orders.service';
import { GuestOrdersController } from './guest-orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PayseraModule } from '../paysera/paysera.module';

@Module({
  imports: [PrismaModule, PayseraModule],
  controllers: [GuestOrdersController],
  providers: [GuestOrdersService],
  exports: [GuestOrdersService],
})
export class GuestOrdersModule {}
