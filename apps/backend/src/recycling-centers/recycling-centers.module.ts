import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecyclingCentersService } from './recycling-centers.service';
import { RecyclingCentersController } from './recycling-centers.controller';
import { DocumentsModule } from '../documents/documents.module';
import { ApusModule } from '../apus/apus.module';

@Module({
  imports: [PrismaModule, DocumentsModule, ApusModule],
  controllers: [RecyclingCentersController],
  providers: [RecyclingCentersService],
  exports: [RecyclingCentersService],
})
export class RecyclingCentersModule {}
