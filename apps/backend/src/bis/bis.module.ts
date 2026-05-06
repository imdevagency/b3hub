import { Module } from '@nestjs/common';
import { BisController } from './bis.controller';
import { BisService } from './bis.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BisController],
  providers: [BisService],
  exports: [BisService],
})
export class BisModule {}
