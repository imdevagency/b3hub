import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecyclingCentersService } from './recycling-centers.service';
import { RecyclingCentersController } from './recycling-centers.controller';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [PrismaModule, DocumentsModule],
  controllers: [RecyclingCentersController],
  providers: [RecyclingCentersService],
  exports: [RecyclingCentersService],
})
export class RecyclingCentersModule {}
