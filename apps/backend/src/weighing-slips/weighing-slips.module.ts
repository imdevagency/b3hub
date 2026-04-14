import { Module } from '@nestjs/common';
import { WeighingSlipsController } from './weighing-slips.controller';
import { WeighingSlipsService } from './weighing-slips.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeighingSlipsController],
  providers: [WeighingSlipsService],
  exports: [WeighingSlipsService],
})
export class WeighingSlipsModule {}
