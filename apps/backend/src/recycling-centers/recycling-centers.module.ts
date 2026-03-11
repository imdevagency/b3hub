import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecyclingCentersService } from './recycling-centers.service';
import { RecyclingCentersController } from './recycling-centers.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RecyclingCentersController],
  providers: [RecyclingCentersService],
  exports: [RecyclingCentersService],
})
export class RecyclingCentersModule {}
