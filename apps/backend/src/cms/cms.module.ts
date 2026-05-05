import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';

@Module({
  imports: [PrismaModule],
  controllers: [CmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
