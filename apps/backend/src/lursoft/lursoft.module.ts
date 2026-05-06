import { Module } from '@nestjs/common';
import { LursoftController } from './lursoft.controller';
import { LursoftService } from './lursoft.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LursoftController],
  providers: [LursoftService],
  exports: [LursoftService],
})
export class LursoftModule {}
