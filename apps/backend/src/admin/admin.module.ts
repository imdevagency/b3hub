import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { ApusModule } from '../apus/apus.module';

@Module({
  imports: [PrismaModule, PaymentsModule, ApusModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
