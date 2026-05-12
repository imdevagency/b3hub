import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ApusService } from './apus.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [ApusService],
  exports: [ApusService],
})
export class ApusModule {}
