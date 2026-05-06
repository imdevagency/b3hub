import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JumisController } from './jumis.controller';
import { JumisService } from './jumis.service';

@Module({
  imports: [PrismaModule],
  controllers: [JumisController],
  providers: [JumisService],
  exports: [JumisService],
})
export class JumisModule {}
